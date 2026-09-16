import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
};

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const callbackUrl=(base:string)=>`${base}/functions/v1/meta-publisher?mode=callback`;
const graph="https://graph.facebook.com/v26.0";
const oauth="https://www.facebook.com/v26.0/dialog/oauth";
const scopes=["pages_show_list","pages_read_engagement","pages_manage_posts","read_insights","instagram_basic","instagram_content_publish","instagram_manage_insights"];

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function randomState(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function html(message:string,ok=true){
  const safe=message.replace(/[<>&"'\x60]/g,(ch)=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;","\x60":"&#96;"}[ch]||ch));
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Restaurant Autopilot · Meta</title><style>body{font-family:system-ui;background:#f5f6f1;color:#17211b;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:520px;margin:20px;padding:32px;border-radius:24px;background:white;border:1px solid #dfe5dc;box-shadow:0 24px 70px rgba(20,30,22,.12);text-align:center}.dot{width:58px;height:58px;border-radius:18px;margin:0 auto 15px;display:grid;place-items:center;background:${ok?"#e7f4d6":"#fff0eb"};font-size:28px}.card h1{margin:0 0 8px;font-size:28px}.card p{color:#68736a;line-height:1.6}.card button{border:0;border-radius:11px;padding:11px 16px;background:#17211b;color:#c9f77f;font-weight:800}</style></head><body><div class="card"><div class="dot">${ok?"✓":"!"}</div><h1>${ok?"Meta povezivanje završeno":"Meta povezivanje nije završeno"}</h1><p>${safe}</p><button onclick="window.close()">Zatvori prozor</button></div><script>try{window.opener&&window.opener.postMessage({type:"restaurant-autopilot-meta",ok:${ok}},"*")}catch(e){}</script></body></html>`,{status:ok?200:400,headers:{"Content-Type":"text/html; charset=utf-8"}});
}
class MetaApiError extends Error{
  code:number;
  subcode:number;
  status:number;
  type:string;
  constructor(message:string,{code=0,subcode=0,status=0,type=""}:{code?:number;subcode?:number;status?:number;type?:string}={}){
    super(message);this.name="MetaApiError";this.code=code;this.subcode=subcode;this.status=status;this.type=type;
  }
}
async function fetchJson(url:string,init?:RequestInit){
  const res=await fetch(url,init);
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data?.error){
    const err=data?.error||{};
    throw new MetaApiError(err?.message||data?.error_description||`Meta HTTP ${res.status}`,{
      code:Number(err?.code||0),subcode:Number(err?.error_subcode||0),status:res.status,type:String(err?.type||"")
    });
  }
  return data;
}
async function formPost(url:string,body:Record<string,string>){
  return fetchJson(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(body)});
}

function metricNumber(value:any):number{
  if(typeof value==="number"&&Number.isFinite(value))return Math.max(0,Math.round(value));
  if(typeof value==="string"&&value.trim()&&Number.isFinite(Number(value)))return Math.max(0,Math.round(Number(value)));
  if(value&&typeof value==="object")return Object.values(value).reduce((sum:number,item:any)=>sum+metricNumber(item),0);
  return 0;
}
function insightValue(payload:any,name:string):number{
  const row=(payload?.data||[]).find((item:any)=>String(item?.name||"")===name);
  return metricNumber(row?.total_value?.value??row?.values?.[0]?.value??row?.value??0);
}
async function syncMetaInsightJob(service:any,job:any,cache:Map<string,{connection:any;token:string}>){
  let auth=cache.get(String(job.connection_id));
  if(!auth){
    const{data:connection,error:connectionError}=await service.from("social_connections").select("id,status,scopes").eq("id",job.connection_id).maybeSingle();
    if(connectionError||!connection||connection.status!=="connected")throw new Error("Meta connection is not active");
    const{data:token,error:tokenError}=await service.rpc("service_get_social_token",{p_connection_id:connection.id});
    if(tokenError||!token)throw new Error("Meta token not found");
    auth={connection,token:String(token)};cache.set(String(job.connection_id),auth);
  }

  const granted=Array.isArray(auth.connection.scopes)?auth.connection.scopes.map((x:any)=>String(x)):[];
  const required=job.platform==="instagram"?["instagram_manage_insights"]:["read_insights"];
  const missing=required.filter(scope=>!granted.includes(scope));
  if(missing.length)throw new Error(`Meta Insights permission nedostaje (${missing.join(", ")}). Poveži Meta nalog ponovo da odobriš novu dozvolu.`);

  const accessToken=auth.token;
  const providerId=job.platform==="facebook"
    ? String(job.result?.post_id||job.provider_media_id||"")
    : String(job.provider_media_id||"");
  if(!providerId)throw new Error("Provider media ID is missing");

  let metrics={views:0,reach:0,likes:0,comments:0,saves:0,shares:0,clicks:0};
  if(job.platform==="instagram"){
    let insights:any;
    try{
      insights=await fetchJson(`${graph}/${providerId}/insights?${new URLSearchParams({metric:"views,reach,likes,comments,saved,shares,total_interactions",access_token:accessToken}).toString()}`);
    }catch(error){
      if(!(error instanceof MetaApiError)||error.code!==100)throw error;
      insights=await fetchJson(`${graph}/${providerId}/insights?${new URLSearchParams({metric:"views,reach,saved,shares,total_interactions",access_token:accessToken}).toString()}`);
    }
    const media=await fetchJson(`${graph}/${providerId}?${new URLSearchParams({fields:"like_count,comments_count",access_token:accessToken}).toString()}`).catch(()=>({}));
    metrics={
      views:insightValue(insights,"views"),
      reach:insightValue(insights,"reach"),
      likes:insightValue(insights,"likes")||metricNumber(media?.like_count),
      comments:insightValue(insights,"comments")||metricNumber(media?.comments_count),
      saves:insightValue(insights,"saved"),
      shares:insightValue(insights,"shares"),
      clicks:0,
    };
  }else if(job.platform==="facebook"){
    const insights=await fetchJson(`${graph}/${providerId}/insights?${new URLSearchParams({metric:"post_media_view,post_total_media_view_unique,post_clicks,post_reactions_by_type_total",access_token:accessToken}).toString()}`);
    const post=await fetchJson(`${graph}/${providerId}?${new URLSearchParams({fields:"comments.limit(0).summary(true),shares",access_token:accessToken}).toString()}`).catch(()=>({}));
    metrics={
      views:insightValue(insights,"post_media_view"),
      reach:insightValue(insights,"post_total_media_view_unique"),
      likes:insightValue(insights,"post_reactions_by_type_total"),
      comments:metricNumber(post?.comments?.summary?.total_count),
      saves:0,
      shares:metricNumber(post?.shares?.count),
      clicks:insightValue(insights,"post_clicks"),
    };
  }else throw new Error("Unsupported insights platform");

  const measuredAt=new Date().toISOString();
  const{data:existing,error:existingError}=await service.from("post_performance").select("id").eq("post_id",job.post_id).eq("platform",job.platform).maybeSingle();
  if(existingError)throw new Error(existingError.message);
  const patch={views:metrics.views,reach:metrics.reach,likes:metrics.likes,comments:metrics.comments,saves:metrics.saves,shares:metrics.shares,clicks:metrics.clicks,source:"meta",measured_at:measuredAt,updated_at:measuredAt};
  const write=existing
    ? await service.from("post_performance").update(patch).eq("id",existing.id)
    : await service.from("post_performance").insert({post_id:job.post_id,restaurant_id:job.restaurant_id,platform:job.platform,...patch});
  if(write.error)throw new Error(write.error.message);

  await service.from("social_publish_jobs").update({insights_synced_at:measuredAt,insights_error:null,updated_at:measuredAt}).eq("id",job.id);
  return metrics;
}

async function publishJobWithService(service:any,job:any,actorUserId?:string|null){
  const{data:conn}=await service.from("social_connections").select("*").eq("id",job.connection_id).maybeSingle();
  const{data:post}=await service.from("posts").select("*").eq("id",job.post_id).maybeSingle();
  if(!conn||conn.status!=="connected")throw new Error("Meta connection is not active");
  if(!post)throw new Error("Post not found");
  const{data:token,error:tokenError}=await service.rpc("service_get_social_token",{p_connection_id:conn.id});
  if(tokenError||!token)throw new Error("Meta token not found");
  const imageUrl=String(post.generation_meta?.image_url||"");
  const platform=String(job.platform);
  const platformCopy=post.platform_content?.[platform]?.caption;
  const hashtags=platform==="instagram"&&Array.isArray(post.hashtags)?post.hashtags.join(" "):"";
  const caption=[String(platformCopy||post.caption||""),hashtags].filter(Boolean).join("\n\n").trim();

  let result:any;
  if(platform==="facebook"){
    if(!conn.page_id)throw new Error("Facebook Page nije izabrana");
    result=imageUrl
      ? await formPost(`${graph}/${conn.page_id}/photos`,{url:imageUrl,caption,published:"true",access_token:String(token)})
      : await formPost(`${graph}/${conn.page_id}/feed`,{message:caption,access_token:String(token)});
  }else if(platform==="instagram"){
    if(!conn.instagram_business_account_id)throw new Error("Instagram Business/Creator nalog nije povezan sa izabranom stranicom");
    if(!imageUrl)throw new Error("Instagram objava zahteva javno dostupnu fotografiju");
    if(post.post_type==="story")throw new Error("Automatski Instagram Story još nije uključen; koristi Feed/Reel workflow.");
    const container=await formPost(`${graph}/${conn.instagram_business_account_id}/media`,{image_url:imageUrl,caption,access_token:String(token)});
    if(!container.id)throw new Error("Instagram media container nije kreiran");
    result=await formPost(`${graph}/${conn.instagram_business_account_id}/media_publish`,{creation_id:String(container.id),access_token:String(token)});
  }else throw new Error("Unsupported platform");

  await service.from("social_publish_jobs").update({
    status:"published",provider_media_id:String(platform==="facebook"?(result?.post_id||result?.id||""):(result?.id||"")),result,
    error_message:null,published_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq("id",job.id);

  const{count:unfinished}=await service.from("social_publish_jobs").select("id",{count:"exact",head:true}).eq("post_id",post.id).neq("status","published").neq("status","cancelled");
  if((unfinished||0)===0)await service.from("posts").update({status:"published"}).eq("id",post.id);

  await service.from("autopilot_activity").insert({
    restaurant_id:job.restaurant_id,user_id:actorUserId||conn.user_id,event_type:"publish_success",
    title:"Objava je poslata na Meta",summary:`${platform==="instagram"?"Instagram":"Facebook"} · ${post.title||"objava"}`,
    metadata:{job_id:job.id,post_id:post.id,platform,provider_media_id:result?.id||null}
  });
  return result;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service=createClient(supabaseUrl,serviceKey);
  const url=new URL(req.url);

  try{
    if(req.method==="GET"&&url.searchParams.get("mode")==="callback"){
      const error=url.searchParams.get("error_description")||url.searchParams.get("error");
      if(error)return html(error,false);
      const code=url.searchParams.get("code")||"";
      const state=url.searchParams.get("state")||"";
      if(!code||!state)return html("Nedostaje OAuth code/state.",false);

      const stateHash=await sha256(state);
      const{data:oauthState,error:stateError}=await service.from("meta_oauth_states").select("*").eq("state_hash",stateHash).is("used_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
      if(stateError||!oauthState)return html("OAuth state je istekao ili nije validan.",false);
      await service.from("meta_oauth_states").update({used_at:new Date().toISOString()}).eq("id",oauthState.id);

      const{data:config,error:configError}=await service.rpc("service_meta_config");
      if(configError||!config?.configured)return html("Meta provider nije konfigurisan u OWNER delu.",false);

      const redirectUri=callbackUrl(supabaseUrl);
      const token=await fetchJson(`${graph}/oauth/access_token?${new URLSearchParams({client_id:config.app_id,client_secret:config.app_secret,redirect_uri:redirectUri,code}).toString()}`);
      let userToken=String(token.access_token||"");
      let expiresIn=Number(token.expires_in||0);

      try{
        const long=await fetchJson(`${graph}/oauth/access_token?${new URLSearchParams({grant_type:"fb_exchange_token",client_id:config.app_id,client_secret:config.app_secret,fb_exchange_token:userToken}).toString()}`);
        if(long.access_token)userToken=String(long.access_token);
        if(long.expires_in)expiresIn=Number(long.expires_in);
      }catch(_){/* short-lived token remains usable */}

      const permissionData=await fetchJson(`${graph}/me/permissions?${new URLSearchParams({access_token:userToken}).toString()}`).catch(()=>({data:[]}));
      const granted=(permissionData.data||[]).filter((p:any)=>p.status==="granted").map((p:any)=>String(p.permission));

      const pages=await fetchJson(`${graph}/me/accounts?${new URLSearchParams({fields:"id,name,access_token,tasks,instagram_business_account{id,username}",limit:"100",access_token:userToken}).toString()}`);
      const candidates=(pages.data||[]).map((p:any)=>({
        id:String(p.id||""),
        name:String(p.name||""),
        instagram_business_account:p.instagram_business_account?{id:String(p.instagram_business_account.id||""),username:String(p.instagram_business_account.username||"")}:null,
        tasks:Array.isArray(p.tasks)?p.tasks:[],
      })).filter((p:any)=>p.id);

      const expiresAt=expiresIn?new Date(Date.now()+expiresIn*1000).toISOString():null;
      const{data:connection,error:upsertError}=await service.from("social_connections").upsert({
        restaurant_id:oauthState.restaurant_id,
        user_id:oauthState.user_id,
        provider:"meta",
        status:candidates.length===1?"connected":candidates.length>1?"pending_page_selection":"error",
        page_id:candidates.length===1?candidates[0].id:null,
        page_name:candidates.length===1?candidates[0].name:null,
        instagram_business_account_id:candidates.length===1?(candidates[0].instagram_business_account?.id||null):null,
        instagram_username:candidates.length===1?(candidates[0].instagram_business_account?.username||null):null,
        scopes:granted,
        token_expires_at:expiresAt,
        connection_meta:{page_candidates:candidates.map((p:any)=>({id:p.id,name:p.name,instagram_business_account:p.instagram_business_account,tasks:p.tasks}))},
        connected_at:candidates.length===1?new Date().toISOString():null,
        last_verified_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
      },{onConflict:"restaurant_id,provider"}).select().single();
      if(upsertError||!connection)return html(upsertError?.message||"Konekcija nije sačuvana.",false);

      if(candidates.length===1){
        const pageRaw=(pages.data||[]).find((p:any)=>String(p.id)===candidates[0].id);
        const pageToken=String(pageRaw?.access_token||userToken);
        await service.rpc("service_store_social_token",{p_connection_id:connection.id,p_token:pageToken,p_expires_at:expiresAt});
        await service.from("autopilot_activity").insert({restaurant_id:oauthState.restaurant_id,user_id:oauthState.user_id,event_type:"social_connected",title:"Meta nalog je povezan",summary:`${candidates[0].name}${candidates[0].instagram_business_account?.username?` · @${candidates[0].instagram_business_account.username}`:""}`,metadata:{page_id:candidates[0].id,instagram_business_account_id:candidates[0].instagram_business_account?.id||null}});
        return html(`Povezana je stranica „${candidates[0].name}“${candidates[0].instagram_business_account?.username?` i Instagram @${candidates[0].instagram_business_account.username}`:""}.`);
      }

      if(candidates.length>1){
        await service.rpc("service_store_social_token",{p_connection_id:connection.id,p_token:userToken,p_expires_at:expiresAt});
        return html(`Pronađeno je ${candidates.length} Facebook stranica. Vrati se u Restaurant Autopilot i izaberi stranicu za ovaj restoran.`);
      }
      return html("Na Meta nalogu nije pronađena Facebook stranica kojom možeš da upravljaš.",false);
    }

    let body:any={};
    if(req.method==="POST")body=await req.json().catch(()=>({}));
    const action=String(body.action||"status");

    if(action==="process_queue"){
      const supplied=req.headers.get("x-cron-secret")||"";
      const{data:expected,error:secretError}=await service.rpc("service_publish_cron_secret");
      if(secretError||!expected||supplied!==String(expected))return json({error:"Unauthorized cron"},401);

      const now=new Date().toISOString();
      const{data:due,error:dueError}=await service.from("social_publish_jobs").select("*").eq("status","queued").lte("publish_at",now).order("publish_at",{ascending:true}).limit(25);
      if(dueError)return json({error:dueError.message},400);
      let published=0,failed=0;
      const results:any[]=[];
      for(const job of due||[]){
        const{data:locked}=await service.from("social_publish_jobs").update({status:"processing",attempt_count:Number(job.attempt_count||0)+1,updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","queued").select("id").maybeSingle();
        if(!locked)continue;
        try{
          const result=await publishJobWithService(service,job,null);
          published+=1;results.push({job_id:job.id,status:"published",provider_media_id:result?.id||null});
        }catch(error){
          const message=error instanceof Error?error.message:String(error);
          failed+=1;
          await service.from("social_publish_jobs").update({status:"failed",error_message:message.slice(0,1000),updated_at:new Date().toISOString()}).eq("id",job.id);
          const{data:conn}=await service.from("social_connections").select("user_id").eq("id",job.connection_id).maybeSingle();
          await service.from("autopilot_activity").insert({restaurant_id:job.restaurant_id,user_id:conn?.user_id||null,event_type:"publish_failed",title:"Meta publishing nije uspeo",summary:message.slice(0,300),metadata:{job_id:job.id,post_id:job.post_id,platform:job.platform}});
          results.push({job_id:job.id,status:"failed",error:message});
        }
      }
      return json({ok:true,processed:(due||[]).length,published,failed,results});
    }

    if(action==="process_insights"){
      const supplied=req.headers.get("x-cron-secret")||"";
      const{data:expected,error:secretError}=await service.rpc("service_publish_cron_secret");
      if(secretError||!expected||supplied!==String(expected))return json({error:"Unauthorized cron"},401);
      const limit=Math.max(1,Math.min(Number(body.limit||40),100));
      const cutoff=new Date(Date.now()-90*86400000).toISOString();
      const{data:jobs,error:jobsError}=await service.from("social_publish_jobs").select("*")
        .eq("status","published").not("provider_media_id","is",null).gte("published_at",cutoff)
        .order("insights_synced_at",{ascending:true,nullsFirst:true}).order("published_at",{ascending:false}).limit(limit);
      if(jobsError)return json({error:jobsError.message},400);
      const cache=new Map<string,{connection:any;token:string}>();
      let synced=0,failed=0,skipped=0;
      const results:any[]=[];
      for(const job of jobs||[]){
        if(job.insights_synced_at&&Date.now()-new Date(job.insights_synced_at).getTime()<5*60*60*1000){skipped+=1;continue}
        try{
          const metrics=await syncMetaInsightJob(service,job,cache);
          synced+=1;results.push({job_id:job.id,platform:job.platform,status:"synced",metrics});
        }catch(error){
          const message=error instanceof Error?error.message:String(error);
          failed+=1;
          await service.from("social_publish_jobs").update({insights_error:message.slice(0,1000),insights_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id);
          results.push({job_id:job.id,platform:job.platform,status:"failed",error:message});
        }
      }
      return json({ok:true,processed:(jobs||[]).length,synced,failed,skipped,results});
    }

    const authHeader=req.headers.get("Authorization")||"";
    if(!authHeader.startsWith("Bearer "))return json({error:"Authentication required"},401);
    const client=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}}});
    const{data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user)return json({error:"Authentication required"},401);

    const restaurantId=String(body.restaurantId||"");
    if(!restaurantId)return json({error:"restaurantId is required"},400);
    const{data:restaurant,error:restaurantError}=await client.from("restaurants").select("id,name,owner_id").eq("id",restaurantId).maybeSingle();
    if(restaurantError||!restaurant)return json({error:"Restaurant not found"},404);

    const{data:config}=await service.rpc("service_meta_config");
    const{data:connection}=await service.from("social_connections").select("id,restaurant_id,status,page_id,page_name,instagram_business_account_id,instagram_username,token_expires_at,scopes,connection_meta,last_verified_at,connected_at,updated_at").eq("restaurant_id",restaurantId).eq("provider","meta").maybeSingle();

    if(action==="status"){
      const expired=Boolean(connection?.token_expires_at&&new Date(connection.token_expires_at).getTime()<Date.now());
      if(expired&&connection?.status==="connected")await service.from("social_connections").update({status:"expired",updated_at:new Date().toISOString()}).eq("id",connection.id);
      const grantedScopes=Array.isArray(connection?.scopes)?connection.scopes.map((x:any)=>String(x)):[];
      const missingInsightsScopes=["read_insights",...(connection?.instagram_business_account_id?["instagram_manage_insights"]:[])].filter(scope=>!grantedScopes.includes(scope));
      return json({ok:true,provider_configured:Boolean(config?.configured),connection:connection?{...connection,status:expired?"expired":connection.status}:null,insights_ready:Boolean(connection&&connection.status==="connected"&&missingInsightsScopes.length===0),missing_insights_scopes:missingInsightsScopes,callback_url:callbackUrl(supabaseUrl)});
    }

    if(action==="verify_connection"){
      if(!connection||connection.status==="disconnected")return json({error:"Meta nalog nije povezan."},409);
      if(!connection.page_id)return json({error:"Facebook stranica nije izabrana."},409);
      const{data:token,error:tokenError}=await service.rpc("service_get_social_token",{p_connection_id:connection.id});
      if(tokenError||!token)return json({error:"Meta token nije dostupan. Poveži nalog ponovo."},409);
      try{
        const page=await fetchJson(`${graph}/${connection.page_id}?${new URLSearchParams({
          fields:"id,name,instagram_business_account{id,username}",
          access_token:String(token)
        }).toString()}`);
        const patch={
          status:"connected",
          page_name:String(page?.name||connection.page_name||""),
          instagram_business_account_id:page?.instagram_business_account?.id?String(page.instagram_business_account.id):null,
          instagram_username:page?.instagram_business_account?.username?String(page.instagram_business_account.username):null,
          last_verified_at:new Date().toISOString(),
          updated_at:new Date().toISOString()
        };
        await service.from("social_connections").update(patch).eq("id",connection.id);
        return json({ok:true,status:"connected",page_name:patch.page_name,instagram_username:patch.instagram_username,last_verified_at:patch.last_verified_at});
      }catch(error){
        const metaError=error instanceof MetaApiError?error:null;
        const nextStatus=metaError?.code===190?"expired":"error";
        await service.from("social_connections").update({status:nextStatus,last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",connection.id);
        return json({error:error instanceof Error?error.message:String(error),status:nextStatus,meta_code:metaError?.code||null},409);
      }
    }

    if(action==="start"){
      if(!config?.configured)return json({error:"Meta App još nije konfigurisan u OWNER delu.",code:"META_PROVIDER_NOT_CONFIGURED"},409);
      const rawState=randomState();
      const stateHash=await sha256(rawState);
      await service.from("meta_oauth_states").delete().eq("user_id",user.id).lt("expires_at",new Date().toISOString());
      const{error:stateInsertError}=await service.from("meta_oauth_states").insert({restaurant_id:restaurantId,user_id:user.id,state_hash:stateHash,redirect_to:String(body.redirectTo||"").slice(0,500)});
      if(stateInsertError)return json({error:stateInsertError.message},400);
      const authorize=new URL(oauth);
      authorize.searchParams.set("client_id",String(config.app_id));
      authorize.searchParams.set("redirect_uri",callbackUrl(supabaseUrl));
      authorize.searchParams.set("state",rawState);
      authorize.searchParams.set("response_type","code");
      authorize.searchParams.set("scope",scopes.join(","));
      return json({ok:true,authorization_url:authorize.toString(),callback_url:callbackUrl(supabaseUrl),scopes});
    }

    if(action==="select_page"){
      if(!connection)return json({error:"Meta connection not found"},404);
      const pageId=String(body.pageId||"");
      if(!pageId)return json({error:"pageId is required"},400);
      const{data:userToken,error:tokenError}=await service.rpc("service_get_social_token",{p_connection_id:connection.id});
      if(tokenError||!userToken)return json({error:"Meta token not found"},409);
      const pages=await fetchJson(`${graph}/me/accounts?${new URLSearchParams({fields:"id,name,access_token,tasks,instagram_business_account{id,username}",limit:"100",access_token:String(userToken)}).toString()}`);
      const page=(pages.data||[]).find((p:any)=>String(p.id)===pageId);
      if(!page)return json({error:"Izabrana stranica više nije dostupna na Meta nalogu."},404);
      const expiresAt=connection.token_expires_at||null;
      await service.rpc("service_store_social_token",{p_connection_id:connection.id,p_token:String(page.access_token||userToken),p_expires_at:expiresAt});
      const{error:updateError}=await service.from("social_connections").update({
        status:"connected",page_id:String(page.id),page_name:String(page.name||""),instagram_business_account_id:page.instagram_business_account?.id?String(page.instagram_business_account.id):null,instagram_username:page.instagram_business_account?.username?String(page.instagram_business_account.username):null,connected_at:new Date().toISOString(),last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }).eq("id",connection.id);
      if(updateError)return json({error:updateError.message},400);
      await service.from("autopilot_activity").insert({restaurant_id:restaurantId,user_id:user.id,event_type:"social_connected",title:"Meta nalog je povezan",summary:`${page.name||"Facebook stranica"}${page.instagram_business_account?.username?` · @${page.instagram_business_account.username}`:""}`,metadata:{page_id:String(page.id),instagram_business_account_id:page.instagram_business_account?.id||null}});
      return json({ok:true});
    }

    if(action==="disconnect"){
      if(connection){
        await service.rpc("service_delete_social_token",{p_connection_id:connection.id});
        await service.from("social_connections").update({status:"disconnected",page_id:null,page_name:null,instagram_business_account_id:null,instagram_username:null,updated_at:new Date().toISOString()}).eq("id",connection.id);
      }
      return json({ok:true});
    }

    if(action==="sync_insights"){
      if(!connection||connection.status!=="connected")return json({error:"Prvo poveži Meta nalog."},409);
      const cutoff=new Date(Date.now()-90*86400000).toISOString();
      const{data:jobs,error:jobsError}=await service.from("social_publish_jobs").select("*")
        .eq("restaurant_id",restaurantId).eq("status","published").not("provider_media_id","is",null)
        .gte("published_at",cutoff).order("published_at",{ascending:false}).limit(50);
      if(jobsError)return json({error:jobsError.message},400);
      const cache=new Map<string,{connection:any;token:string}>();
      let synced=0,failed=0;
      const results:any[]=[];
      for(const job of jobs||[]){
        try{
          const metrics=await syncMetaInsightJob(service,job,cache);
          synced+=1;results.push({job_id:job.id,platform:job.platform,status:"synced",metrics});
        }catch(error){
          const message=error instanceof Error?error.message:String(error);
          failed+=1;
          await service.from("social_publish_jobs").update({insights_error:message.slice(0,1000),insights_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id);
          results.push({job_id:job.id,platform:job.platform,status:"failed",error:message});
        }
      }
      return json({ok:true,processed:(jobs||[]).length,synced,failed,results});
    }

    if(action==="sync_schedule"){
      const updates=Array.isArray(body.updates)?body.updates.slice(0,100):[];
      const ids=[...new Set(updates.map((row:any)=>String(row.postId||"")).filter(Boolean))];
      if(!ids.length)return json({ok:true,updated:0});
      const{data:owned,error:ownedError}=await client.from("posts").select("id").eq("restaurant_id",restaurantId).in("id",ids);
      if(ownedError)return json({error:ownedError.message},400);
      const allowed=new Set((owned||[]).map((row:any)=>String(row.id)));
      let changed=0;
      for(const row of updates){
        const postId=String(row.postId||"");
        const publishAt=String(row.publishAt||"");
        if(!allowed.has(postId)||!publishAt)continue;
        const{data:jobs,error:updateError}=await service.from("social_publish_jobs")
          .update({publish_at:publishAt,updated_at:new Date().toISOString()})
          .eq("post_id",postId).eq("restaurant_id",restaurantId).eq("status","queued").select("id");
        if(updateError)return json({error:updateError.message},400);
        changed+=(jobs||[]).length;
      }
      return json({ok:true,updated:changed});
    }

    if(action==="queue"){
      if(!connection||connection.status!=="connected")return json({error:"Prvo poveži Meta nalog."},409);
      const postId=String(body.postId||"");
      const platforms=Array.isArray(body.platforms)?body.platforms.filter((x:any)=>x==="facebook"||x==="instagram"):[];
      if(!postId||!platforms.length)return json({error:"postId i platforms su obavezni"},400);
      const{data:post,error:postError}=await client.from("posts").select("*").eq("id",postId).eq("restaurant_id",restaurantId).maybeSingle();
      if(postError||!post)return json({error:"Post not found"},404);
      if(!["approved","published"].includes(post.status))return json({error:"Objava mora biti odobrena pre Meta publishing-a."},409);
      const publishAt=body.publishNow?new Date().toISOString():String(body.publishAt||post.scheduled_for||new Date().toISOString());
      const jobs:any[]=[];
      for(const platform of platforms){
        const{data:existing}=await service.from("social_publish_jobs").select("*").eq("post_id",postId).eq("platform",platform).neq("status","cancelled").maybeSingle();
        if(existing){
          if(existing.status==="queued"&&String(existing.publish_at)!==publishAt){
            const{data:updated,error:updateExistingError}=await service.from("social_publish_jobs")
              .update({publish_at:publishAt,updated_at:new Date().toISOString()}).eq("id",existing.id).select().single();
            if(updateExistingError)return json({error:updateExistingError.message},400);
            jobs.push(updated||existing);
          }else jobs.push(existing);
          continue;
        }
        const{data:job,error:jobError}=await service.from("social_publish_jobs").insert({restaurant_id:restaurantId,post_id:postId,connection_id:connection.id,platform,status:"queued",publish_at:publishAt}).select().single();
        if(jobError)return json({error:jobError.message},400);
        jobs.push(job);
        await service.from("autopilot_activity").insert({restaurant_id:restaurantId,user_id:user.id,event_type:"publish_queued",title:"Meta objava je zakazana",summary:`${platform==="instagram"?"Instagram":"Facebook"} · ${post.title||"objava"}`,metadata:{job_id:job.id,post_id:postId,platform,publish_at:publishAt}});
      }
      const results:any[]=[];
      if(body.publishNow){
        for(const job of jobs){
          if(job.status==="published"){results.push({job_id:job.id,already_published:true});continue}
          await service.from("social_publish_jobs").update({status:"processing",attempt_count:Number(job.attempt_count||0)+1,updated_at:new Date().toISOString()}).eq("id",job.id);
          try{results.push({job_id:job.id,result:await publishJobWithService(service,job,user.id)});}
          catch(error){
            const message=error instanceof Error?error.message:String(error);
            if(error instanceof MetaApiError&&error.code===190){
              await service.from("social_connections").update({status:"expired",last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",job.connection_id);
            }
            await service.from("social_publish_jobs").update({status:"failed",error_message:message,updated_at:new Date().toISOString()}).eq("id",job.id);
            await service.from("autopilot_activity").insert({restaurant_id:restaurantId,user_id:user.id,event_type:"publish_failed",title:"Meta publishing nije uspeo",summary:message.slice(0,300),metadata:{job_id:job.id,post_id:job.post_id,platform:job.platform}});
            results.push({job_id:job.id,error:message});
          }
        }
      }
      return json({ok:true,jobs,results});
    }

    if(action==="cancel_job"){
      const jobId=String(body.jobId||"");
      if(!jobId)return json({error:"jobId is required"},400);
      const{data:job,error:jobError}=await service.from("social_publish_jobs").select("id,status,post_id,platform").eq("id",jobId).eq("restaurant_id",restaurantId).maybeSingle();
      if(jobError||!job)return json({error:"Publish job not found"},404);
      if(job.status==="published")return json({error:"Objavljena Meta objava ne može da se otkaže iz queue-a."},409);
      if(job.status==="processing")return json({error:"Objava se upravo šalje i više ne može bezbedno da se otkaže."},409);
      const{error:cancelError}=await service.from("social_publish_jobs").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",job.id);
      if(cancelError)return json({error:cancelError.message},400);
      return json({ok:true,job_id:job.id});
    }

    if(action==="retry_job"){
      const jobId=String(body.jobId||"");
      const{data:job}=await service.from("social_publish_jobs").select("*").eq("id",jobId).eq("restaurant_id",restaurantId).maybeSingle();
      if(!job)return json({error:"Publish job not found"},404);
      await service.from("social_publish_jobs").update({status:"processing",attempt_count:Number(job.attempt_count||0)+1,error_message:null,updated_at:new Date().toISOString()}).eq("id",job.id);
      try{return json({ok:true,result:await publishJobWithService(service,job,user.id)});}
      catch(error){
        const message=error instanceof Error?error.message:String(error);
        if(error instanceof MetaApiError&&error.code===190){
          await service.from("social_connections").update({status:"expired",last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",job.connection_id);
        }
        await service.from("social_publish_jobs").update({status:"failed",error_message:message,updated_at:new Date().toISOString()}).eq("id",job.id);
        return json({error:message},400);
      }
    }

    return json({error:"Unknown action"},400);
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
