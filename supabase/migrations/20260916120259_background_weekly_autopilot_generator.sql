create or replace function private.background_weekly_autopilot(p_force boolean default false, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant record;
  v_item record;
  v_plan_id uuid;
  v_week_start date;
  v_local_now timestamp;
  v_local_hour int;
  v_local_dow int;
  v_frequency int;
  v_generation_limit int;
  v_generated_this_month int;
  v_created_restaurants int := 0;
  v_created_posts int := 0;
  v_skipped_existing int := 0;
  v_skipped_subscription int := 0;
  v_skipped_quota int := 0;
  v_skipped_menu int := 0;
  v_candidates jsonb := '[]'::jsonb;
  v_index int;
  v_day_offset int;
  v_day_key text;
  v_open jsonb;
  v_open_time time;
  v_close_time time;
  v_publish_time time;
  v_scheduled timestamptz;
  v_caption text;
  v_title text;
  v_cta text;
  v_hashtags text[];
  v_item_count int;
  v_owner uuid;
begin
  for v_restaurant in
    select r.*
    from public.restaurants r
    where r.weekly_autopilot_enabled = true
      and r.onboarding_completed = true
    order by r.created_at
  loop
    begin
      v_local_now := now() at time zone coalesce(nullif(v_restaurant.timezone,''),'Europe/Belgrade');
    exception when others then
      v_local_now := now() at time zone 'Europe/Belgrade';
    end;

    v_local_hour := extract(hour from v_local_now)::int;
    v_local_dow := extract(isodow from v_local_now)::int;

    if not p_force and not (v_local_dow = 1 and v_local_hour = 6) then
      continue;
    end if;

    v_week_start := date_trunc('week', v_local_now)::date;
    v_owner := v_restaurant.owner_id;

    if exists(
      select 1 from public.content_plans cp
      where cp.restaurant_id = v_restaurant.id
        and cp.week_start = v_week_start
    ) then
      v_skipped_existing := v_skipped_existing + 1;
      continue;
    end if;

    select coalesce(s.custom_generation_limit,p.monthly_generation_limit)
      into v_generation_limit
    from public.customer_subscriptions s
    left join public.sales_plans p on p.id=s.plan_id
    where s.user_id=v_owner
      and s.status in ('active','trialing')
      and s.starts_at <= now()
      and (s.expires_at is null or s.expires_at > now())
    order by s.created_at desc
    limit 1;

    if not found then
      v_skipped_subscription := v_skipped_subscription + 1;
      continue;
    end if;

    select count(*)::int
      into v_generated_this_month
    from public.posts po
    join public.restaurants rr on rr.id=po.restaurant_id
    where rr.owner_id=v_owner
      and po.created_at >= date_trunc('month',now());

    v_frequency := greatest(3,least(7,coalesce(v_restaurant.posting_frequency,5)));

    if v_generation_limit is not null
       and v_generated_this_month + v_frequency > v_generation_limit then
      v_skipped_quota := v_skipped_quota + 1;
      continue;
    end if;

    select count(*)::int
      into v_item_count
    from public.menu_items mi
    where mi.restaurant_id=v_restaurant.id
      and mi.is_active=true;

    if v_item_count = 0 then
      v_skipped_menu := v_skipped_menu + 1;
      continue;
    end if;

    if p_dry_run then
      v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
        'restaurant_id',v_restaurant.id,
        'name',v_restaurant.name,
        'week_start',v_week_start,
        'frequency',v_frequency,
        'active_menu_items',v_item_count,
        'generated_this_month',v_generated_this_month,
        'generation_limit',v_generation_limit
      ));
      continue;
    end if;

    insert into public.content_plans(restaurant_id,week_start,status)
    values(v_restaurant.id,v_week_start,'generated')
    on conflict(restaurant_id,week_start) do nothing
    returning id into v_plan_id;

    if v_plan_id is null then
      v_skipped_existing := v_skipped_existing + 1;
      continue;
    end if;

    for v_index in 0..v_frequency-1 loop
      select mi.*
        into v_item
      from public.menu_items mi
      left join lateral (
        select count(*)::int recent_uses
        from public.posts pp
        where pp.restaurant_id=v_restaurant.id
          and pp.menu_item_id=mi.id
          and pp.created_at >= now()-interval '30 days'
      ) usage on true
      where mi.restaurant_id=v_restaurant.id
        and mi.is_active=true
      order by
        case when mi.marketing_priority=3 then 0
             when mi.marketing_priority=2 then 1
             when mi.marketing_priority=1 then 2
             else 3 end,
        coalesce(usage.recent_uses,0),
        md5(mi.id::text || ':' || v_index::text)
      offset (v_index % v_item_count)
      limit 1;

      if v_item.id is null then
        continue;
      end if;

      v_day_offset := case
        when v_frequency <= 3 then (array[0,2,4])[v_index+1]
        when v_frequency = 4 then (array[0,1,3,5])[v_index+1]
        when v_frequency = 5 then (array[0,1,2,4,5])[v_index+1]
        when v_frequency = 6 then (array[0,1,2,3,4,5])[v_index+1]
        else v_index
      end;

      for _shift in 0..6 loop
        v_day_offset := mod(v_day_offset,7);
        v_day_key := (array['mon','tue','wed','thu','fri','sat','sun'])[v_day_offset+1];
        v_open := coalesce(v_restaurant.opening_hours->v_day_key,'{}'::jsonb);
        exit when coalesce((v_open->>'enabled')::boolean,true);
        v_day_offset := v_day_offset + 1;
      end loop;

      begin
        v_open_time := coalesce(nullif(v_open->>'open','')::time,time '09:00');
        v_close_time := coalesce(nullif(v_open->>'close','')::time,time '22:00');
      exception when others then
        v_open_time := time '09:00';
        v_close_time := time '22:00';
      end;

      v_publish_time := case
        when v_index % 3 = 1 then time '11:30'
        when v_index % 3 = 2 then time '17:30'
        else time '18:30'
      end;

      if v_publish_time < v_open_time + interval '30 minutes' then
        v_publish_time := v_open_time + interval '30 minutes';
      end if;
      if v_publish_time > v_close_time - interval '30 minutes' then
        v_publish_time := greatest(v_open_time + interval '30 minutes',v_close_time - interval '30 minutes');
      end if;

      begin
        v_scheduled := ((v_week_start + v_day_offset)::date + v_publish_time) at time zone coalesce(nullif(v_restaurant.timezone,''),'Europe/Belgrade');
      exception when others then
        v_scheduled := ((v_week_start + v_day_offset)::date + v_publish_time) at time zone 'Europe/Belgrade';
      end;

      v_title := case
        when v_item.marketing_priority=3 then 'HERO · '||v_item.name
        when v_index % 3 = 2 then 'Probaj '||v_item.name
        else v_item.name
      end;

      v_cta := case coalesce(v_restaurant.social_goal,'reservations')
        when 'delivery' then 'Poruči danas.'
        when 'walk_ins' then 'Svrati danas.'
        when 'awareness' then 'Sačuvaj i podeli.'
        else 'Rezerviši svoje mesto.'
      end;

      v_caption := trim(both ' ' from concat(
        v_item.name,
        case when nullif(v_item.description,'') is not null then ' — '||v_item.description else '' end,
        case when nullif(v_restaurant.city,'') is not null then '. Vidimo se u '||v_restaurant.city else '' end,
        '. ',v_cta
      ));

      v_hashtags := array[
        '#'||regexp_replace(coalesce(v_restaurant.name,'restoran'),'[^[:alnum:]]','','g'),
        '#'||regexp_replace(coalesce(v_restaurant.city,'lokalno'),'[^[:alnum:]]','','g'),
        '#restoran',
        '#hrana'
      ];

      insert into public.posts(
        restaurant_id,content_plan_id,menu_item_id,post_type,scheduled_for,
        title,caption,cta,hashtags,visual_brief,status,generation_meta,
        platform_content,discovery_score,seo_keywords
      )
      values(
        v_restaurant.id,v_plan_id,v_item.id,
        case when v_index % 5 = 3 then 'story'
             when v_index % 5 = 4 then 'promotion'
             else 'feed' end,
        v_scheduled,
        v_title,
        v_caption,
        v_cta,
        v_hashtags,
        'Koristi fotografiju jela, brend boje i čitljiv CTA. Zadrži prirodan, premium izgled.',
        'draft',
        jsonb_build_object(
          'engine','restaurant-autopilot-db-cron-v1',
          'generation_source','weekly_autopilot_background',
          'needs_ai_polish',true,
          'marketing_priority',coalesce(v_item.marketing_priority,0),
          'generated_at',now(),
          'image_url',v_item.image_url,
          'background_generated',true
        ),
        jsonb_build_object(
          'instagram',jsonb_build_object('caption',v_caption,'hashtags',v_hashtags),
          'facebook',jsonb_build_object('caption',v_caption)
        ),
        case when nullif(v_restaurant.city,'') is null then 45 else 70 end,
        array_remove(array[
          lower(v_item.name),
          lower(coalesce(v_restaurant.city,'')),
          lower(coalesce(v_restaurant.cuisine_type,''))
        ],'')
      );

      v_created_posts := v_created_posts + 1;
    end loop;

    insert into public.autopilot_activity(
      restaurant_id,user_id,event_type,title,summary,metadata
    )
    values(
      v_restaurant.id,
      v_owner,
      'weekly_plan_created',
      'Background AUTO WEEK je napravio plan',
      v_frequency||' draft objava · nedelja '||v_week_start||' · AI polish čeka prvo otvaranje aplikacije.',
      jsonb_build_object(
        'source','weekly_autopilot_background',
        'content_plan_id',v_plan_id,
        'week_start',v_week_start,
        'posts',v_frequency,
        'needs_ai_polish',true
      )
    );

    insert into public.notification_outbox(
      user_id,recipient_email,kind,subject,body,payload,delivery_status,visible_in_app
    )
    select
      v_owner,u.email,'weekly_plan_ready',
      'Nova Autopilot nedelja je spremna',
      'Background Autopilot je pripremio novu nedelju za '||v_restaurant.name||'. Otvori aplikaciju da pregledaš i AI-doradiš tekstove.',
      jsonb_build_object(
        'restaurant_id',v_restaurant.id,
        'content_plan_id',v_plan_id,
        'week_start',v_week_start,
        'background',true
      ),
      'in_app',true
    from auth.users u
    where u.id=v_owner;

    v_created_restaurants := v_created_restaurants + 1;
  end loop;

  return jsonb_build_object(
    'ok',true,
    'dry_run',p_dry_run,
    'force',p_force,
    'created_restaurants',v_created_restaurants,
    'created_posts',v_created_posts,
    'skipped_existing',v_skipped_existing,
    'skipped_subscription',v_skipped_subscription,
    'skipped_quota',v_skipped_quota,
    'skipped_menu',v_skipped_menu,
    'candidates',v_candidates,
    'ran_at',now()
  );
end;
$function$;

revoke all on function private.background_weekly_autopilot(boolean,boolean) from public;
revoke all on function private.background_weekly_autopilot(boolean,boolean) from anon;
revoke all on function private.background_weekly_autopilot(boolean,boolean) from authenticated;
grant execute on function private.background_weekly_autopilot(boolean,boolean) to postgres;

do $block$
begin
  perform cron.unschedule('restaurant-autopilot-weekly-background');
exception when others then
  null;
end;
$block$;

select cron.schedule(
  'restaurant-autopilot-weekly-background',
  '7 * * * *',
  'select private.background_weekly_autopilot(false,false);'
);
