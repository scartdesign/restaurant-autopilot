import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{...corsHeaders,"Content-Type":"application/json"}
});

type DiscoveryTerm={
  id:string;
  platform:"instagram"|"facebook";
  term:string;
  country:string|null;
  city:string|null;
};

function trendQuery(term:string){
  return term
    .replace(/^#+/,"")
    .replace(/([a-zčćžšđ])([A-ZČĆŽŠĐ])/g,"$1 $2")
    .replace(/[_-]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function geoFor(row:DiscoveryTerm){
  const country=(row.country||"").toLowerCase();
  if(country.includes("serbia")||country.includes("srb"))return "RS";
  return "";
}

function anchorFor(geo:string){
  return geo==="RS"?"restoran":"restaurant";
}

function chunks<T>(items:T[],size:number){
  const out:T[][]=[];
  for(let i=0;i<items.length;i+=size)out.push(items.slice(i,i+size));
  return out;
}

function clamp(n:number,min=0,max=100){
  return Math.max(min,Math.min(max,n));
}

function relativeScore(target:number,anchor:number){
  if(target<=0&&anchor<=0)return 50;
  if(anchor<=0)return 100;
  if(target<=0)return 0;
  return Math.round(clamp((100*target)/(target+anchor)));
}

function candidateRelevance(query:string,seed:string){
  const q=query.toLowerCase();
  const s=seed.toLowerCase();
  let score=35;
  if(q.includes(s))score+=20;
  const positive=["restoran","restaurant","pizza","burger","pasta","hrana","food","roštilj","rostilj","ćevap","cevap","kafa","coffee","brunch","ručak","rucak","večera","vecera","doručak","dorucak","dostava","delivery","steak","sushi","salata","dessert","desert","kolač","kolac","piletina","chicken","riba","seafood"];
  const local=["blizu","near me","beograd","belgrade","niš","nis","novi sad","sokobanja","vracar","vračar","zemun"];
  const negative=["recept","recipe","kalor","calorie","diet","mršav","mrsav","weight loss","how to make","sastoj"];
  if(positive.some(x=>q.includes(x)))score+=20;
  if(local.some(x=>q.includes(x)))score+=15;
  if(negative.some(x=>q.includes(x)))score-=35;
  return clamp(score);
}

async function fetchRelatedQueries(apiKey:string,geo:string,seed:string){
  const params=new URLSearchParams({
    engine:"google_trends",
    q:seed,
    data_type:"RELATED_QUERIES",
    date:"today 3-m",
    api_key:apiKey,
    output:"json",
  });
  if(geo)params.set("geo",geo);
  if(geo==="RS"){
    params.set("hl","sr");
    params.set("tz","-120");
  }
  const res=await fetch("https://serpapi.com/search.json?"+params.toString(),{headers:{"Accept":"application/json"}});
  const payload=await res.json().catch(()=>({}));
  if(!res.ok||payload?.error)throw new Error(String(payload?.error||("SerpApi related queries HTTP "+res.status)));
  const rising=(Array.isArray(payload?.related_queries?.rising)?payload.related_queries.rising:[]).slice(0,8);
  const top=(Array.isArray(payload?.related_queries?.top)?payload.related_queries.top:[]).slice(0,4);
  return [
    ...rising.map((row:any)=>({type:"rising" as const,query:String(row?.query||"").trim(),value:String(row?.value||""),extracted:Number(row?.extracted_value||0)})),
    ...top.map((row:any)=>({type:"top" as const,query:String(row?.query||"").trim(),value:String(row?.value||""),extracted:Number(row?.extracted_value||0)})),
  ].filter(row=>row.query);
}

async function fetchTrendBatch(apiKey:string,geo:string,targets:string[]){
  const anchor=anchorFor(geo);
  const queries=[anchor,...targets];
  const params=new URLSearchParams({
    engine:"google_trends",
    q:queries.join(","),
    data_type:"TIMESERIES",
    date:"today 3-m",
    api_key:apiKey,
    output:"json",
  });
  if(geo)params.set("geo",geo);
  if(geo==="RS"){
    params.set("hl","sr");
    params.set("tz","-120");
  }

  const res=await fetch("https://serpapi.com/search.json?"+params.toString(),{
    headers:{"Accept":"application/json"},
  });
  const payload=await res.json().catch(()=>({}));
  if(!res.ok||payload?.error){
    throw new Error(String(payload?.error||("SerpApi HTTP "+res.status)));
  }

  const averages=Array.isArray(payload?.interest_over_time?.averages)
    ? payload.interest_over_time.averages
    : [];
  const values=queries.map((query,index)=>{
    const byIndex=averages[index];
    const byName=averages.find((row:any)=>String(row?.query||"").toLowerCase()===query.toLowerCase());
    const raw=byName?.value??byName?.extracted_value??byIndex?.value??byIndex?.extracted_value??0;
    const n=Number(raw||0);
    return Number.isFinite(n)?Math.max(0,n):0;
  });

  const anchorAverage=values[0]||0;
  return targets.map((query,index)=>({
    query,
    average:values[index+1]||0,
    anchor,
    anchorAverage,
    score:relativeScore(values[index+1]||0,anchorAverage),
  }));
}

async function recordSync(service:any,status:"success"|"skipped"|"failed",payload:any){
  const errorMessage=status==="failed"
    ? String(payload?.errors?.[0]||payload?.error||"Discovery sync failed")
    : null;
  await service.rpc("service_record_discovery_sync",{
    p_source:"serpapi_google_trends",
    p_status:status,
    p_terms_seen:Number(payload?.active_terms||0),
    p_terms_updated:Number(payload?.updated||0),
    p_error_message:errorMessage,
    p_metadata:{
      provider:"serpapi_google_trends",
      unique_queries:Number(payload?.unique_queries||0),
      api_calls:Number(payload?.api_calls||0),
      failed_batches:Number(payload?.failed_batches||0),
      candidate_api_calls:Number(payload?.candidate_api_calls||0),
      candidates_upserted:Number(payload?.candidates_upserted||0),
      verified_at:payload?.verified_at||null,
      skipped:Boolean(payload?.skipped),
      reason:payload?.reason||null,
    }
  }).catch(()=>null);
}

async function runSync(service:any,config:any){
  if(!config?.configured||!config?.api_key){
    const result={ok:true,configured:false,skipped:true,reason:"SerpApi provider is not configured",active_terms:0,updated:0,api_calls:0,failed_batches:0};
    await recordSync(service,"skipped",result);
    return result;
  }

  const{data:rows,error:termsError}=await service
    .from("discovery_terms")
    .select("id,platform,term,country,city")
    .eq("active",true)
    .order("term",{ascending:true});
  if(termsError)throw new Error(termsError.message);

  const terms=(rows||[]) as DiscoveryTerm[];
  const unique=new Map<string,{query:string;geo:string;ids:string[]}>();

  for(const row of terms){
    const query=trendQuery(row.term);
    if(!query)continue;
    const geo=geoFor(row);
    const key=geo+"|"+query.toLowerCase();
    const existing=unique.get(key);
    if(existing)existing.ids.push(row.id);
    else unique.set(key,{query,geo,ids:[row.id]});
  }

  const byGeo=new Map<string,{query:string;geo:string;ids:string[]}[]>();
  for(const item of unique.values()){
    byGeo.set(item.geo,[...(byGeo.get(item.geo)||[]),item]);
  }

  let apiCalls=0;
  let updated=0;
  let failedBatches=0;
  let candidateApiCalls=0;
  let candidatesUpserted=0;
  const errors:string[]=[];
  const verifiedAt=new Date().toISOString();

  for(const [geo,items] of byGeo){
    const anchor=anchorFor(geo);
    const direct=items.filter(item=>item.query.toLowerCase()===anchor.toLowerCase());
    for(const item of direct){
      const{error}=await service.from("discovery_terms").update({
        external_trend_score:50,
        external_source:"serpapi_google_trends",
        external_verified_at:verifiedAt,
        external_trend_meta:{query:item.query,geo:geo||"WORLDWIDE",anchor,score_basis:"anchor_self",window:"today 3-m"},
        updated_at:verifiedAt,
      }).in("id",item.ids);
      if(error)errors.push(error.message); else updated+=item.ids.length;
    }

    const targets=items.filter(item=>item.query.toLowerCase()!==anchor.toLowerCase());
    for(const batch of chunks(targets,4)){
      try{
        const results=await fetchTrendBatch(String(config.api_key),geo,batch.map(x=>x.query));
        apiCalls+=1;
        for(const result of results){
          const item=batch.find(x=>x.query===result.query);
          if(!item)continue;
          const{error}=await service.from("discovery_terms").update({
            external_trend_score:result.score,
            external_source:"serpapi_google_trends",
            external_verified_at:verifiedAt,
            external_trend_meta:{
              query:result.query,
              geo:geo||"WORLDWIDE",
              anchor:result.anchor,
              average:result.average,
              anchor_average:result.anchorAverage,
              score_basis:"relative_to_anchor",
              window:"today 3-m",
            },
            updated_at:verifiedAt,
          }).in("id",item.ids);
          if(error)errors.push(error.message); else updated+=item.ids.length;
        }
      }catch(error){
        failedBatches+=1;
        errors.push(error instanceof Error?error.message:String(error));
      }
    }
  }

  const candidateSeeds=[
    {geo:"RS",query:"restoran"},
    {geo:"RS",query:"pizza"},
    {geo:"RS",query:"burger"},
    {geo:"RS",query:"domaća hrana"},
    {geo:"",query:"restaurant"},
    {geo:"",query:"street food"},
  ];
  for(const seed of candidateSeeds){
    try{
      const related=await fetchRelatedQueries(String(config.api_key),seed.geo,seed.query);
      candidateApiCalls+=1;
      for(const row of related){
        const relevance=candidateRelevance(row.query,seed.query);
        if(relevance<45)continue;
        if(row.type==="rising"&&row.extracted>0&&row.extracted<100)continue;
        const{error}=await service.rpc("service_upsert_discovery_candidate",{
          p_provider:"serpapi_google_trends",
          p_seed_query:seed.query,
          p_query:row.query,
          p_geo:seed.geo,
          p_trend_type:row.type,
          p_trend_value:row.value,
          p_extracted_value:Math.max(0,Math.round(row.extracted||0)),
          p_relevance_score:relevance,
          p_metadata:{window:"today 3-m",discovered_at:verifiedAt},
        });
        if(error)errors.push(error.message); else candidatesUpserted+=1;
      }
    }catch(error){
      failedBatches+=1;
      errors.push(error instanceof Error?error.message:String(error));
    }
  }

  const result={
    ok:failedBatches===0,
    configured:true,
    provider:"serpapi_google_trends",
    active_terms:terms.length,
    unique_queries:unique.size,
    updated,
    api_calls:apiCalls,
    failed_batches:failedBatches,
    candidate_api_calls:candidateApiCalls,
    candidates_upserted:candidatesUpserted,
    verified_at:verifiedAt,
    errors:errors.slice(0,8),
  };
  await recordSync(service,result.ok?"success":"failed",result);
  return result;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);

  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service=createClient(supabaseUrl,serviceKey);

  try{
    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||"status");
    const{data:config,error:configError}=await service.rpc("service_discovery_provider_config");
    if(configError)return json({error:configError.message},500);

    if(action==="process_cron"){
      const supplied=req.headers.get("x-cron-secret")||"";
      if(!config?.cron_secret||supplied!==String(config.cron_secret))return json({error:"Unauthorized cron"},401);
      return json(await runSync(service,config));
    }

    const authHeader=req.headers.get("Authorization")||"";
    if(!authHeader.startsWith("Bearer "))return json({error:"Authentication required"},401);
    const client=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}}});
    const{data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user)return json({error:"Authentication required"},401);
    const{data:admin}=await service.from("app_admins").select("role").eq("user_id",user.id).eq("role","superadmin").maybeSingle();
    if(!admin)return json({error:"Forbidden"},403);

    if(action==="status"){
      const{data:status,error}=await client.rpc("admin_discovery_provider_status");
      if(error)return json({error:error.message},400);
      return json({ok:true,...status});
    }

    if(action==="sync_now"){
      return json(await runSync(service,config));
    }

    return json({error:"Unknown action"},400);
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});