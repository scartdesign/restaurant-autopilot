import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const esc=(v:string)=>v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
const nl2br=(v:string)=>esc(v).replace(/\n/g,"<br/>");

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth=req.headers.get("Authorization")||"";
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const service=createClient(url,serviceKey);
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"status");

    let user:any=null;
    let isAdmin=false;

    if(action==="cron_send_queue"){
      const supplied=req.headers.get("x-cron-secret")||"";
      const{data:expected,error:secretError}=await service.rpc("service_email_cron_secret");
      if(secretError||!expected||supplied!==String(expected))return json({error:"Unauthorized cron"},401);
      isAdmin=true;
    }else{
      const {data:userData,error:userError}=await userClient.auth.getUser();
      user=userData.user;
      if(userError||!user)return json({error:"Unauthorized"},401);
      const {data:admin}=await service.from("app_admins").select("role").eq("user_id",user.id).eq("role","superadmin").maybeSingle();
      isAdmin=Boolean(admin);
    }

    const adminOnly=new Set(["status","retry_failed","send_queue","send_one","cron_send_queue"]);
    if(adminOnly.has(action)&&!isAdmin)return json({error:"Forbidden"},403);

    const {data:keyData,error:keyError}=await service.rpc("internal_email_provider_key");
    const apiKey=typeof keyData==="string"?keyData:"";
    const {data:settings,error:settingsError}=await service.from("sales_settings").select("email_from,email_sender_name,support_email,sales_email").eq("id",1).maybeSingle();
    if(settingsError) return json({error:settingsError.message},500);
    const senderEmail=String(settings?.email_from||"").trim();
    const senderName=String(settings?.email_sender_name||"Restaurant Autopilot").trim()||"Restaurant Autopilot";

    if(action==="status"){
      return json({ok:true,provider:"resend",configured:Boolean(apiKey),sender_ready:Boolean(senderEmail),sender_email:senderEmail||null});
    }
    if(!apiKey||keyError){
      if(action==="cron_send_queue")return json({ok:true,skipped:true,reason:"EMAIL_PROVIDER_NOT_CONFIGURED"});
      return json({error:"Resend API ključ nije podešen.",code:"EMAIL_PROVIDER_NOT_CONFIGURED"},503);
    }
    if(!senderEmail){
      if(action==="cron_send_queue")return json({ok:true,skipped:true,reason:"EMAIL_FROM_MISSING"});
      return json({error:"U OWNER podešavanjima upiši Email from adresu sa verifikovanog domena.",code:"EMAIL_FROM_MISSING"},400);
    }

    if(action==="retry_failed"){
      const {error}=await service.from("notification_outbox").update({delivery_status:"queued",error_message:null}).eq("delivery_status","failed").lt("retry_count",4);
      if(error) return json({error:error.message},500);
      return json({ok:true});
    }

    if(!["send_queue","send_one","send_my_queue","send_support_ticket","cron_send_queue"].includes(action)) return json({error:"Unknown action"},400);
    const limit=Math.max(1,Math.min(50,Number(body.limit||20)));
    let rows:any[]=[];
    let rowsError:any=null;

    if(action==="send_my_queue"){
      const result=await service.from("notification_outbox").select("*").eq("user_id",user.id).eq("delivery_status","queued").not("recipient_email","is",null).order("created_at",{ascending:true}).limit(limit);
      rows=result.data||[]; rowsError=result.error;
    }else if(action==="send_support_ticket"){
      const ticketId=String(body.ticketId||"").trim();
      if(!ticketId) return json({error:"ticketId is required"},400);
      const {data:ticket}=await service.from("support_tickets").select("id,user_id").eq("id",ticketId).eq("user_id",user.id).maybeSingle();
      if(!ticket) return json({error:"Support ticket not found"},404);
      const result=await service.from("notification_outbox").select("*").eq("kind","support_created").eq("delivery_status","queued").not("recipient_email","is",null).order("created_at",{ascending:false}).limit(25);
      rows=(result.data||[]).filter((row:any)=>String(row.payload?.support_ticket_id||"")===ticketId).slice(0,1); rowsError=result.error;
    }else{
      let query=service.from("notification_outbox").select("*").eq("delivery_status","queued").not("recipient_email","is",null).order("created_at",{ascending:true}).limit(limit);
      if(action==="send_one"){
        const id=Number(body.id||0);
        if(!id) return json({error:"id is required"},400);
        query=service.from("notification_outbox").select("*").eq("id",id).eq("delivery_status","queued").not("recipient_email","is",null).limit(1);
      }
      const result=await query; rows=result.data||[]; rowsError=result.error;
    }
    if(rowsError) return json({error:rowsError.message},500);

    const results:any[]=[];
    for(const row of rows||[]){
      const recipient=String(row.recipient_email||"").trim();
      if(!recipient) continue;
      const html='<!doctype html><html><body style="margin:0;background:#f5f6f1;font-family:Arial,sans-serif;color:#1d261f"><div style="max-width:640px;margin:0 auto;padding:28px 16px"><div style="background:#17211b;color:#fff;border-radius:18px;padding:24px"><div style="font-size:12px;letter-spacing:.08em;color:#c9ef83;font-weight:700">RESTAURANT AUTOPILOT</div><h1 style="font-size:24px;margin:10px 0 18px">'+esc(String(row.subject||"Restaurant Autopilot"))+'</h1><div style="font-size:15px;line-height:1.65;color:#edf2ed">'+nl2br(String(row.body||""))+'</div></div><div style="padding:14px 4px;color:#798279;font-size:11px">Automatska servisna poruka Restaurant Autopilot sistema.</div></div></body></html>';
      const send=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer "+apiKey,
          "Idempotency-Key":"restaurant-autopilot-outbox-"+row.id
        },
        body:JSON.stringify({
          from:senderName+" <"+senderEmail+">",
          to:[recipient],
          subject:String(row.subject||"Restaurant Autopilot"),
          text:String(row.body||""),
          html,
        })
      });
      const data=await send.json().catch(()=>({}));
      if(send.ok){
        await service.from("notification_outbox").update({
          delivery_status:"sent",
          sent_at:new Date().toISOString(),
          provider_message_id:data?.id||null,
          error_message:null
        }).eq("id",row.id);
        results.push({id:row.id,ok:true,provider_message_id:data?.id||null});
      }else{
        await service.from("notification_outbox").update({
          delivery_status:"failed",
          error_message:String(data?.message||data?.error?.message||"Email send failed").slice(0,800),
          retry_count:Number(row.retry_count||0)+1
        }).eq("id",row.id);
        results.push({id:row.id,ok:false,error:data?.message||data?.error?.message||"Email send failed"});
      }
    }
    return json({ok:true,processed:results.length,sent:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length,results});
  }catch(error){
    return json({error:error instanceof Error?error.message:"Unexpected error"},500);
  }
});