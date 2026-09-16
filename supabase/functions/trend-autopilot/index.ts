import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{...corsHeaders,"Content-Type":"application/json"},
});

const clean=(v:string="")=>v.replace(/\s+/g," ").trim();
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const uniq=(xs:string[])=>[...new Set(xs.map(x=>clean(x)).filter(Boolean))];

function tagPart(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,m=>m==="Đ"?"Dj":"dj").replace(/[^a-zA-Z0-9\u0400-\u04FF]/g,"");
}
function hashtag(value:string){const x=tagPart(value);return x?"#"+x:""}

function ctaFor(r:any){
  if(r.social_goal==="reservations")return r.reservation_url?"Rezerviši sto":"Rezerviši sto na vreme";
  if(r.social_goal==="delivery")return "Poruči svoj favorit";
  if(r.social_goal==="walk_ins")return "Svrati danas";
  return "Sačuvaj za sledeći dolazak";
}
function templateFor(r:any){
  if(r.brand_style==="premium"||r.tone==="premium")return "luxe";
  if(r.brand_style==="fast_food"||r.tone==="direct")return "bold";
  if(r.brand_style==="traditional"||r.tone==="traditional")return "editorial";
  return "minimal";
}
function captionFor(r:any,item:any){
  const city=r.city||"gradu";
  const desc=clean(item?.description||"Sveže pripremljeno i spremno za tvoj sto.");
  const price=item?.price?" "+item.price+" "+(item.currency||"RSD")+".":"";
  return "Tražiš gde jesti u "+city+"? "+item.name+" je dobar razlog da svratiš. "+desc+price+" "+ctaFor(r)+".";
}
function visualBrief(r:any,item:any){
  return "1080x1350 feed. "+(r.brand_style||"modern")+" stil. Hero fotografija jela "+item.name+", premium tipografija, minimalan tekst, bez generičkog AI izgleda.";
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);

  const url=Deno.env.get("SUPABASE_URL")!;
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service=createClient(url,serviceKey);

  try{
    const body=await req.json().catch(()=>({}));
    if(String(body?.action||"")!=="process_cron")return json({error:"Unknown action"},400);

    const{data:cfg,error:cfgError}=await service.rpc("service_discovery_provider_config");
    if(cfgError)return json({error:cfgError.message},500);
    const supplied=req.headers.get("x-cron-secret")||"";
    if(!cfg?.cron_secret||supplied!==String(cfg.cron_secret))return json({error:"Unauthorized cron"},401);

    const now=new Date();
    const nowIso=now.toISOString();
    const monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
    const dayAgo=new Date(now.getTime()-86400000).toISOString();

    const{data:autoRestaurants,error:restaurantError}=await service.from("restaurants")
      .select("*")
      .eq("trend_autopilot_mode","auto");
    if(restaurantError)throw new Error(restaurantError.message);
    if(!autoRestaurants?.length)return json({ok:true,restaurants:0,created:0,skipped:0});

    const restaurantIds=autoRestaurants.map((r:any)=>r.id);
    const ownerIds=uniq(autoRestaurants.map((r:any)=>String(r.owner_id)));

    const[
      {data:opportunityRows,error:opportunityError},
      {data:recentTrendPosts,error:recentError},
      {data:ownerRestaurants,error:ownerRestaurantsError},
      {data:subscriptions,error:subscriptionsError},
      {data:admins,error:adminsError},
    ]=await Promise.all([
      service.from("trend_content_opportunities")
        .select("*")
        .in("restaurant_id",restaurantIds)
        .eq("status","pending")
        .eq("trend_type","rising")
        .gte("opportunity_score",85)
        .gt("expires_at",nowIso)
        .order("opportunity_score",{ascending:false}),
      service.from("posts")
        .select("id,restaurant_id,generation_meta,created_at")
        .in("restaurant_id",restaurantIds)
        .gte("created_at",dayAgo),
      service.from("restaurants")
        .select("id,owner_id")
        .in("owner_id",ownerIds),
      service.from("customer_subscriptions")
        .select("id,user_id,plan_id,status,starts_at,expires_at,custom_generation_limit,created_at")
        .in("user_id",ownerIds)
        .in("status",["active","trialing"])
        .order("created_at",{ascending:false}),
      service.from("app_admins")
        .select("user_id,role")
        .in("user_id",ownerIds),
    ]);
    if(opportunityError)throw new Error(opportunityError.message);
    if(recentError)throw new Error(recentError.message);
    if(ownerRestaurantsError)throw new Error(ownerRestaurantsError.message);
    if(subscriptionsError)throw new Error(subscriptionsError.message);
    if(adminsError)throw new Error(adminsError.message);

    const allRestaurantIds=(ownerRestaurants||[]).map((r:any)=>r.id);
    const{data:monthPosts,error:monthPostsError}=allRestaurantIds.length
      ? await service.from("posts").select("id,restaurant_id").in("restaurant_id",allRestaurantIds).gte("created_at",monthStart)
      : {data:[],error:null};
    if(monthPostsError)throw new Error(monthPostsError.message);

    const planIds=uniq((subscriptions||[]).map((s:any)=>String(s.plan_id||"")).filter(Boolean));
    const{data:plans,error:plansError}=planIds.length
      ? await service.from("sales_plans").select("id,monthly_generation_limit,features").in("id",planIds)
      : {data:[],error:null};
    if(plansError)throw new Error(plansError.message);

    const ownerByRestaurant=new Map((ownerRestaurants||[]).map((r:any)=>[String(r.id),String(r.owner_id)]));
    const monthCountByOwner=new Map<string,number>();
    for(const post of monthPosts||[]){
      const owner=ownerByRestaurant.get(String(post.restaurant_id));
      if(owner)monthCountByOwner.set(owner,(monthCountByOwner.get(owner)||0)+1);
    }
    const recentAutoRestaurants=new Set(
      (recentTrendPosts||[])
        .filter((p:any)=>String(p.generation_meta?.generation_source||"")==="trend_autopilot_auto")
        .map((p:any)=>String(p.restaurant_id))
    );
    const planMap=new Map((plans||[]).map((p:any)=>[String(p.id),p]));
    const adminOwners=new Set((admins||[]).filter((a:any)=>a.role==="superadmin").map((a:any)=>String(a.user_id)));

    const activeSubByOwner=new Map<string,any>();
    for(const sub of subscriptions||[]){
      const owner=String(sub.user_id);
      if(activeSubByOwner.has(owner))continue;
      const starts=new Date(sub.starts_at).getTime();
      const expires=sub.expires_at?new Date(sub.expires_at).getTime():Number.POSITIVE_INFINITY;
      if(starts<=now.getTime()&&expires>now.getTime())activeSubByOwner.set(owner,sub);
    }

    const topOpportunityByRestaurant=new Map<string,any>();
    for(const opp of opportunityRows||[]){
      const id=String(opp.restaurant_id);
      if(!topOpportunityByRestaurant.has(id))topOpportunityByRestaurant.set(id,opp);
    }

    let created=0,skipped=0;
    const results:any[]=[];

    for(const restaurant of autoRestaurants){
      const restaurantId=String(restaurant.id);
      const ownerId=String(restaurant.owner_id);
      const opp=topOpportunityByRestaurant.get(restaurantId);
      if(!opp){skipped+=1;results.push({restaurant_id:restaurantId,status:"no_opportunity"});continue}
      if(recentAutoRestaurants.has(restaurantId)){skipped+=1;results.push({restaurant_id:restaurantId,status:"daily_guard"});continue}

      const isAdmin=adminOwners.has(ownerId);
      const sub=activeSubByOwner.get(ownerId);
      if(!isAdmin&&!sub){skipped+=1;results.push({restaurant_id:restaurantId,status:"no_active_plan"});continue}

      let limit:number|null=null;
      if(!isAdmin){
        const plan=planMap.get(String(sub.plan_id||""));
        const raw=sub.custom_generation_limit??plan?.monthly_generation_limit??null;
        limit=raw===null||raw===undefined?null:Number(raw);
      }
      const used=monthCountByOwner.get(ownerId)||0;
      if(limit!==null&&used>=limit){skipped+=1;results.push({restaurant_id:restaurantId,status:"quota_reached"});continue}

      let item:any=null;
      if(opp.menu_item_id){
        const{data}=await service.from("menu_items").select("*").eq("id",opp.menu_item_id).eq("restaurant_id",restaurantId).eq("is_active",true).maybeSingle();
        item=data;
      }
      if(!item){
        const{data}=await service.from("menu_items").select("*").eq("restaurant_id",restaurantId).eq("is_active",true).order("marketing_priority",{ascending:false}).order("updated_at",{ascending:false}).limit(1).maybeSingle();
        item=data;
      }
      if(!item){skipped+=1;results.push({restaurant_id:restaurantId,status:"no_menu_item"});continue}

      const caption=captionFor(restaurant,item);
      const cta=ctaFor(restaurant);
      const tags=uniq([
        hashtag(restaurant.name),
        hashtag(restaurant.city||""),
        hashtag(restaurant.cuisine_type||""),
        hashtag(item.name),
      ]).filter(Boolean).slice(0,7);
      const keywords=uniq([
        String(opp.trend_query||""),
        item.name,
        restaurant.city||"",
        restaurant.cuisine_type||"",
      ]).slice(0,9);
      const template=templateFor(restaurant);
      const title=item.name;
      const visual={
        template,
        format:"feed",
        headline:title,
        subline:clean(item.description||opp.reason||"").slice(0,118),
        cta,
        image_url:item.image_url||null,
        photo_position:"center",
        overlay:Number(restaurant.default_overlay_strength??0.68),
        primary_color:restaurant.primary_color||"#17211b",
        accent_color:restaurant.secondary_color||"#b9df72",
        logo_visible:restaurant.default_logo_visible!==false,
        logo_position:restaurant.default_logo_position||"top-right",
        logo_size:restaurant.default_logo_size||"m",
        logo_badge:restaurant.default_logo_badge||"white",
        copy_position:"bottom",
        font_pair:template==="luxe"?"editorial":"modern",
        price_visible:Boolean(item.price),
      };

      const{data:post,error:postError}=await service.from("posts").insert({
        restaurant_id:restaurantId,
        content_plan_id:null,
        menu_item_id:item.id,
        post_type:"feed",
        scheduled_for:null,
        title,
        caption,
        cta,
        hashtags:tags,
        seo_keywords:keywords,
        discovery_score:clamp(Number(opp.opportunity_score||85),0,99),
        platform_content:{
          instagram:{caption,hashtags:tags,keywords,strategy:"auto trend draft + local intent + owner-approved trend"},
          facebook:{caption,hashtags:tags.slice(0,3),keywords:keywords.slice(0,4),strategy:"auto trend draft + local intent"},
        },
        visual_brief:visualBrief(restaurant,item),
        status:"draft",
        generation_meta:{
          engine:"restaurant-autopilot-v29",
          generation_source:"trend_autopilot_auto",
          trend_opportunity_id:opp.id,
          trend_query:opp.trend_query,
          trend_seed:opp.seed_query,
          trend_score:opp.opportunity_score,
          trend_performance_boost:Number(opp.performance_boost||0),
          trend_performance_samples:Number(opp.performance_samples||0),
          trend_type:opp.trend_type,
          pillar:opp.recommended_pillar||"local_discovery",
          variation:0,
          image_url:item.image_url||null,
          generated_at:nowIso,
          format:"4:5",
          learning_signal:{approved_trend_boost:Math.min(45,Math.max(1,Number(opp.opportunity_score||85)-50))},
          visual_design:visual,
        },
      }).select().single();

      if(postError||!post){skipped+=1;results.push({restaurant_id:restaurantId,status:"insert_failed",error:postError?.message||"unknown"});continue}

      await service.from("trend_content_opportunities").update({
        status:"created",
        created_post_id:post.id,
        updated_at:new Date().toISOString(),
      }).eq("id",opp.id).eq("restaurant_id",restaurantId);

      await service.from("autopilot_activity").insert({
        restaurant_id:restaurantId,
        user_id:ownerId,
        event_type:"trend_auto_draft_created",
        title:"Trend Autopilot je pripremio draft",
        summary:item.name+" · "+opp.trend_query+" · čeka tvoje odobrenje.",
        metadata:{opportunity_id:opp.id,post_id:post.id,menu_item_id:item.id,opportunity_score:opp.opportunity_score,performance_boost:Number(opp.performance_boost||0),performance_samples:Number(opp.performance_samples||0)},
      });

      const{data:profile}=await service.from("customer_profiles").select("email").eq("user_id",ownerId).maybeSingle();
      await service.from("notification_outbox").insert({
        user_id:ownerId,
        recipient_email:profile?.email||null,
        kind:"trend_draft_ready",
        subject:"Trend Autopilot je pripremio novi draft",
        body:"Jak rising signal „"+opp.trend_query+"“ je iskorišćen za "+item.name+". Draft čeka tvoju proveru i odobrenje.",
        payload:{restaurant_id:restaurantId,opportunity_id:opp.id,post_id:post.id,menu_item_id:item.id,trend_query:opp.trend_query,opportunity_score:opp.opportunity_score},
        delivery_status:"in_app",
        visible_in_app:true,
      });

      created+=1;
      monthCountByOwner.set(ownerId,used+1);
      recentAutoRestaurants.add(restaurantId);
      results.push({restaurant_id:restaurantId,status:"created",post_id:post.id,opportunity_id:opp.id});
    }

    return json({ok:true,restaurants:autoRestaurants.length,created,skipped,results});
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});