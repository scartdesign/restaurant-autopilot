import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const stripeApi="https://api.stripe.com/v1";

function safeOrigin(req:Request){
  const value=String(req.headers.get("Origin")||"").trim();
  try{
    const url=new URL(value);
    if(url.protocol==="https:"||url.hostname==="localhost"||url.hostname==="127.0.0.1")return url.origin;
  }catch(_){}
  return "";
}
async function stripeRequest(secret:string,path:string,init?:RequestInit){
  const res=await fetch(stripeApi+path,{...init,headers:{Authorization:`Bearer ${secret}`,...(init?.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(String(data?.error?.message||`Stripe HTTP ${res.status}`));
  return data;
}
async function createStripeSession(secret:string,params:Record<string,string>){
  return stripeRequest(secret,"/checkout/sessions",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams(params),
  });
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);

  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth=req.headers.get("Authorization")||"";
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const service=createClient(url,serviceKey);
    const{data:userData,error:userError}=await userClient.auth.getUser();
    const user=userData.user;
    if(userError||!user)return json({error:"Unauthorized"},401);

    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"create_order");

    const{data:stripeConfig,error:stripeConfigError}=await service.rpc("service_stripe_config");
    if(action==="status"){
      const key=String(stripeConfig?.secret_key||"");
      const mode=key.startsWith("sk_live_")?"live":key.startsWith("sk_test_")?"test":"unknown";
      return json({ok:true,provider:"stripe",configured:Boolean(!stripeConfigError&&stripeConfig?.configured),mode});
    }

    if(action==="cancel_checkout"){
      const orderId=String(body.orderId||"").trim();
      if(!orderId)return json({error:"orderId je obavezan."},400);
      const{data:order,error:orderError}=await service.from("sales_orders").select("id,status,payment_method,payment_provider,provider_payment_status").eq("id",orderId).eq("user_id",user.id).maybeSingle();
      if(orderError||!order)return json({error:"Narudžbina nije pronađena."},404);
      if(order.status!=="pending")return json({ok:true,unchanged:true,status:order.status});
      if(order.payment_method!=="card")return json({error:"Ovo nije kartična narudžbina."},409);
      const{data:cancelled,error:cancelError}=await service.from("sales_orders").update({
        status:"cancelled",
        provider_payment_status:"cancelled_by_customer",
        admin_note:"Stripe Checkout otkazan od strane kupca",
        updated_at:new Date().toISOString()
      }).eq("id",order.id).eq("status","pending").select().single();
      if(cancelError)return json({error:cancelError.message},400);
      return json({ok:true,order:cancelled});
    }

    if(action==="confirm_stripe"){
      if(stripeConfigError||!stripeConfig?.configured)return json({error:"Stripe provider nije konfigurisan."},503);
      const sessionId=String(body.sessionId||"").trim();
      if(!sessionId.startsWith("cs_"))return json({error:"Stripe session nije validan."},400);
      const session=await stripeRequest(String(stripeConfig.secret_key),`/checkout/sessions/${encodeURIComponent(sessionId)}`);
      const orderId=String(session?.client_reference_id||session?.metadata?.order_id||"");
      if(!orderId)return json({error:"Stripe session nema order reference."},400);
      const{data:order,error:orderError}=await service.from("sales_orders").select("*").eq("id",orderId).eq("user_id",user.id).maybeSingle();
      if(orderError||!order)return json({error:"Narudžbina nije pronađena za ovaj nalog."},404);

      await service.from("sales_orders").update({
        payment_provider:"stripe",
        provider_checkout_session_id:sessionId,
        provider_payment_intent_id:typeof session?.payment_intent==="string"?session.payment_intent:null,
        provider_payment_status:String(session?.payment_status||session?.status||"unknown"),
        provider_payload:{checkout_status:session?.status||null,expires_at:session?.expires_at||null},
        updated_at:new Date().toISOString(),
      }).eq("id",order.id);

      if(session?.payment_status!=="paid"){
        return json({ok:true,paid:false,status:session?.payment_status||session?.status||"unknown",order});
      }

      const{data:activated,error:activateError}=await service.rpc("service_mark_stripe_order_paid",{
        p_order_id:order.id,
        p_checkout_session_id:sessionId,
        p_payment_intent_id:typeof session?.payment_intent==="string"?session.payment_intent:null,
        p_payment_status:String(session?.payment_status||"paid"),
      });
      if(activateError)return json({error:activateError.message},500);
      const{data:paidOrder}=await service.from("sales_orders").select("*").eq("id",order.id).single();
      return json({ok:true,paid:true,activation:activated,order:paidOrder});
    }

    const planId=String(body.planId||"").trim();
    const paymentMethod=String(body.paymentMethod||"").trim();
    const customerNote=body.customerNote?String(body.customerNote):null;
    const couponCode=body.couponCode?String(body.couponCode).trim().toUpperCase():null;
    const acceptedLegal=body.acceptedLegal===true;
    if(!planId||!paymentMethod)return json({error:"Plan i način plaćanja su obavezni."},400);

    const{data:settings,error:settingsError}=await service.from("sales_settings").select("terms_url,privacy_url,sales_open,allow_card").eq("id",1).maybeSingle();
    if(settingsError)return json({error:settingsError.message},500);
    if(settings?.sales_open===false)return json({error:"Prodaja je trenutno zatvorena."},403);
    const legalRequired=Boolean(settings?.terms_url||settings?.privacy_url);
    if(legalRequired&&!acceptedLegal)return json({error:"Potvrdi Uslove korišćenja i Politiku privatnosti pre kupovine.",code:"LEGAL_CONSENT_REQUIRED"},400);
    if(paymentMethod==="card"){
      if(!settings?.allow_card)return json({error:"Kartično plaćanje trenutno nije uključeno."},409);
      if(stripeConfigError||!stripeConfig?.configured)return json({error:"Stripe kartično plaćanje još nije konfigurisan.",code:"STRIPE_NOT_CONFIGURED"},503);
    }

    const{data:order,error}=await userClient.rpc("create_sales_order",{
      p_plan_id:planId,
      p_payment_method:paymentMethod,
      p_customer_note:customerNote,
      p_coupon_code:couponCode,
    });
    if(error)return json({error:error.message},400);
    if(!order?.id)return json({error:"Narudžbina nije kreirana."},500);

    const now=new Date().toISOString();
    const consent={
      accepted_terms_at:settings?.terms_url&&acceptedLegal?now:null,
      accepted_terms_url:settings?.terms_url||null,
      accepted_privacy_at:settings?.privacy_url&&acceptedLegal?now:null,
      accepted_privacy_url:settings?.privacy_url||null,
    };
    let{data:updated,error:updateError}=await service.from("sales_orders").update(consent).eq("id",order.id).eq("user_id",user.id).select().single();
    if(updateError)return json({error:updateError.message},500);

    if(paymentMethod!=="card")return json({ok:true,order:updated});

    const{data:plan,error:planError}=await service.from("sales_plans").select("id,name,code").eq("id",planId).single();
    if(planError||!plan)return json({error:"Paket nije pronađen za Stripe Checkout."},500);

    const origin=safeOrigin(req);
    if(!origin)return json({error:"Nije moguće odrediti bezbedan return URL za Stripe Checkout."},400);

    const amountMinor=Math.round(Number(updated.amount||0)*100);
    if(amountMinor<=0){
      const freeRef=`promo-free:${updated.id}`;
      const{error:activateError}=await service.rpc("service_mark_stripe_order_paid",{
        p_order_id:updated.id,p_checkout_session_id:freeRef,p_payment_intent_id:null,p_payment_status:"paid"
      });
      if(activateError)return json({error:activateError.message},500);
      const{data:paidOrder}=await service.from("sales_orders").select("*").eq("id",updated.id).single();
      return json({ok:true,order:paidOrder,paid:true,free:true});
    }

    const successUrl=`${origin}/?payment=stripe-success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl=`${origin}/?payment=stripe-cancel&order=${encodeURIComponent(updated.id)}`;
    const params:Record<string,string>={
      mode:"payment",
      success_url:successUrl,
      cancel_url:cancelUrl,
      client_reference_id:String(updated.id),
      customer_email:String(user.email||""),
      "line_items[0][quantity]":"1",
      "line_items[0][price_data][currency]":String(updated.currency||"EUR").toLowerCase(),
      "line_items[0][price_data][unit_amount]":String(amountMinor),
      "line_items[0][price_data][product_data][name]":`Restorapp · ${plan.name}`,
      "metadata[order_id]":String(updated.id),
      "metadata[user_id]":String(user.id),
      "metadata[plan_id]":String(plan.id),
      "payment_intent_data[metadata][order_id]":String(updated.id),
      "payment_intent_data[metadata][user_id]":String(user.id),
      billing_address_collection:"auto",
    };
    const session=await createStripeSession(String(stripeConfig.secret_key),params);
    if(!session?.id||!session?.url)return json({error:"Stripe Checkout Session nije kreiran."},502);

    const{data:sessionOrder,error:sessionUpdateError}=await service.from("sales_orders").update({
      payment_provider:"stripe",
      provider_checkout_session_id:String(session.id),
      provider_payment_status:String(session.payment_status||session.status||"unpaid"),
      provider_payload:{checkout_status:session.status||null,expires_at:session.expires_at||null},
      updated_at:new Date().toISOString(),
    }).eq("id",updated.id).select().single();
    if(sessionUpdateError)return json({error:sessionUpdateError.message},500);
    updated=sessionOrder;

    return json({ok:true,order:updated,checkout_url:String(session.url),checkout_session_id:String(session.id)});
  }catch(error){
    return json({error:error instanceof Error?error.message:"Unexpected error"},500);
  }
});
