create or replace function private.trend_decision_label(p_code text)
returns text
language sql
immutable
security invoker
set search_path to ''
as $function$
  select case coalesce(p_code,'')
    when 'created' then 'draft napravljen'
    when 'would_create' then 'napravio bi draft'
    when 'eligible' then 'spremno za AUTO'
    when 'suggest_only' then 'SUGGEST režim'
    when 'off' then 'AUTO isključen'
    when 'no_opportunity' then 'nema odgovarajuće prilike'
    when 'daily_guard' then '24h zaštita'
    when 'quota_reached' then 'mesečna kvota potrošena'
    when 'no_active_plan' then 'nema aktivan paket'
    when 'no_menu_item' then 'nema aktivno jelo'
    when 'insert_failed' then 'greška pri pravljenju drafta'
    when 'local_performance_guard' then 'lokalno slab trend'
    when 'low_local_effectiveness' then 'slab istorijski učinak'
    when 'repeat_cooldown' then 'trend je skoro korišćen'
    when 'below_auto_threshold' then 'ispod AUTO praga'
    when 'snoozed' then 'prilika je odložena'
    when 'expired' then 'prilika je istekla'
    when 'not_rising' then 'nije rising trend'
    when 'provider_paused' then 'Google Trends provider je pauziran'
    when 'provider_key_missing' then 'nedostaje SerpApi ključ'
    when 'waiting_for_candidates' then 'čeka nove trend kandidate'
    when 'candidates_need_review' then 'trend kandidati čekaju odobrenje'
    when 'waiting_for_opportunities' then 'čeka prilike za sadržaj'
    when 'opportunities_guarded' then 'prilike postoje, ali ih zaštite trenutno blokiraju'
    when 'ready_suggest_only' then 'spremno, ali restorani su na SUGGEST'
    when 'ready' then 'Trend AUTO je spreman'
    else replace(coalesce(p_code,'nepoznato'),'_',' ')
  end;
$function$;

revoke all on function private.trend_decision_label(text) from public,anon,authenticated;
grant execute on function private.trend_decision_label(text) to service_role;

create or replace function public.trend_decision_label(p_code text)
returns text
language sql
immutable
security invoker
set search_path to ''
as $function$
  select case coalesce(p_code,'')
    when 'created' then 'draft napravljen'
    when 'would_create' then 'napravio bi draft'
    when 'eligible' then 'spremno za AUTO'
    when 'suggest_only' then 'SUGGEST režim'
    when 'off' then 'AUTO isključen'
    when 'no_opportunity' then 'nema odgovarajuće prilike'
    when 'daily_guard' then '24h zaštita'
    when 'quota_reached' then 'mesečna kvota potrošena'
    when 'no_active_plan' then 'nema aktivan paket'
    when 'no_menu_item' then 'nema aktivno jelo'
    when 'insert_failed' then 'greška pri pravljenju drafta'
    when 'local_performance_guard' then 'lokalno slab trend'
    when 'low_local_effectiveness' then 'slab istorijski učinak'
    when 'repeat_cooldown' then 'trend je skoro korišćen'
    when 'below_auto_threshold' then 'ispod AUTO praga'
    when 'snoozed' then 'prilika je odložena'
    when 'expired' then 'prilika je istekla'
    when 'not_rising' then 'nije rising trend'
    when 'provider_paused' then 'Google Trends provider je pauziran'
    when 'provider_key_missing' then 'nedostaje SerpApi ključ'
    when 'waiting_for_candidates' then 'čeka nove trend kandidate'
    when 'candidates_need_review' then 'trend kandidati čekaju odobrenje'
    when 'waiting_for_opportunities' then 'čeka prilike za sadržaj'
    when 'opportunities_guarded' then 'prilike postoje, ali ih zaštite trenutno blokiraju'
    when 'ready_suggest_only' then 'spremno, ali restorani su na SUGGEST'
    when 'ready' then 'Trend AUTO je spreman'
    else replace(coalesce(p_code,'nepoznato'),'_',' ')
  end;
$function$;

revoke all on function public.trend_decision_label(text) from public;
grant execute on function public.trend_decision_label(text) to anon,authenticated,service_role;
