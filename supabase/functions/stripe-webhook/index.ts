import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});

function hex(bytes:ArrayBuffer){
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function timingSafeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let out=0;
  for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}
async function sign(secret:string,payload:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload)));
}
async function verifyStripeSignature(rawBody:string,header:string,secret:string){
  const pieces=header.split(",").map(v=>v.trim());
  const timestamp=pieces.find(v=>v.startsWith("t="))?.slice(2)||"";
  const signatures=pieces.filter(v=>v.startsWith("v1=")).map(v=>v.slice(3));
  const ts=Number(timestamp);
  if(!Number.isFinite(ts)||!signatures.length)return false;
  if(Math.abs(Math.floor(Date.now()/1000)-ts)>300)return false;
  const expected=await sign(secret,`${timestamp}.${rawBody}`);
  return signatures.some(sig=>timingSafeEqual(sig,expected));
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);

  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service=createClient(supabaseUrl,serviceKey);

  try{
    const{data:config,error:configError}=await service.rpc("service_stripe_config");
    if(configError||!config?.configured)return json({error:"Stripe provider nije konfigurisan."},503);

    const rawBody=await req.text();
    const signature=req.headers.get("Stripe-Signature")||"";
    const valid=await verifyStripeSignature(rawBody,signature,String(config.webhook_secret));
    if(!valid)return json({error:"Invalid Stripe signature"},400);

    const event=JSON.parse(rawBody);
    const eventId=String(event?.id||"");
    const eventType=String(event?.type||"");
    if(!eventId||!eventType)return json({error:"Invalid Stripe event"},400);

    const object=event?.data?.object||{};
    const orderId=String(object?.client_reference_id||object?.metadata?.order_id||"")||null;

    const{error:insertError}=await service.from("payment_webhook_events").insert({
      id:eventId,provider:"stripe",event_type:eventType,order_id:orderId,status:"received"
    });
    if(insertError){
      if(String(insertError.code)==="23505")return json({received:true,duplicate:true});
      return json({error:insertError.message},500);
    }

    try{
      if(eventType==="checkout.session.completed"||eventType==="checkout.session.async_payment_succeeded"){
        if(!orderId)throw new Error("Stripe event nema order reference.");
        const sessionId=String(object?.id||"");
        const paymentIntent=typeof object?.payment_intent==="string"?object.payment_intent:null;
        const paymentStatus=String(object?.payment_status||"unknown");

        await service.from("sales_orders").update({
          payment_provider:"stripe",
          provider_checkout_session_id:sessionId||null,
          provider_payment_intent_id:paymentIntent,
          provider_payment_status:paymentStatus,
          provider_payload:{checkout_status:object?.status||null,expires_at:object?.expires_at||null},
          updated_at:new Date().toISOString()
        }).eq("id",orderId);

        if(paymentStatus==="paid"){
          const{error:activateError}=await service.rpc("service_mark_stripe_order_paid",{
            p_order_id:orderId,
            p_checkout_session_id:sessionId,
            p_payment_intent_id:paymentIntent,
            p_payment_status:paymentStatus
          });
          if(activateError)throw new Error(activateError.message);
        }
      }else if(eventType==="checkout.session.expired"||eventType==="checkout.session.async_payment_failed"){
        if(orderId){
          await service.from("sales_orders").update({
            payment_provider:"stripe",
            provider_checkout_session_id:String(object?.id||"")||null,
            provider_payment_intent_id:typeof object?.payment_intent==="string"?object.payment_intent:null,
            provider_payment_status:eventType==="checkout.session.expired"?"expired":"failed",
            provider_payload:{checkout_status:object?.status||null,expires_at:object?.expires_at||null},
            updated_at:new Date().toISOString()
          }).eq("id",orderId).eq("status","pending");
        }
      }

      await service.from("payment_webhook_events").update({status:"processed",processed_at:new Date().toISOString(),error_message:null}).eq("id",eventId);
      return json({received:true});
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      await service.from("payment_webhook_events").update({status:"failed",error_message:message.slice(0,800),processed_at:new Date().toISOString()}).eq("id",eventId);
      return json({error:message},500);
    }
  }catch(error){
    return json({error:error instanceof Error?error.message:"Unexpected error"},500);
  }
});
