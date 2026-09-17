import { useEffect, useState } from 'react'
import { Activity, Gauge, RefreshCw, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../trend-intelligence-owner.css'

type IntelligenceHealth={
  effectiveness:{learned_seeds:number;restaurants:number;strong_positive:number;strong_negative:number;high_confidence:number;fresh_30d:number;stale_180d:number}
  opportunities:{pending:number;eligible_auto:number;repeat_cooldown:number;low_effectiveness_guard:number;local_performance_guard:number;below_auto_threshold:number;snoozed:number}
  sources:{manual_seeds:number;auto_profile_enabled:boolean;provider_enabled:boolean;daily_calls_used:number}
  generated_at:string
}
type Readiness={
  status:string;provider_configured:boolean;provider_enabled:boolean;manual_seeds:number;auto_profile_seeds_enabled:boolean
  per_sync_call_limit:number;candidate_seed_limit:number;estimated_candidate_call_budget:number;estimated_term_call_budget:number
  daily_call_limit:number;daily_calls_used:number;estimated_monthly_call_ceiling:number
  candidates:{pending:number;approved:number;rejected:number;pre_approve:number;pre_review:number;pre_skip:number}
  opportunities:{pending:number;eligible_auto:number}
  modes:Record<string,number>;generated_at:string
}
type DryRunRow={
  restaurant_id:string;restaurant_name:string;mode:string;decision:string;would_create:boolean
  opportunity_id:string|null;trend_query:string|null;seed_query:string|null;opportunity_score:number|null
  effectiveness_score:number|null;effectiveness_samples:number|null;performance_boost:number|null;performance_samples:number|null
  repeat_penalty:number|null;monthly_used:number;monthly_limit:number|null;daily_guard:boolean
}

const emptyHealth:IntelligenceHealth={
  effectiveness:{learned_seeds:0,restaurants:0,strong_positive:0,strong_negative:0,high_confidence:0,fresh_30d:0,stale_180d:0},
  opportunities:{pending:0,eligible_auto:0,repeat_cooldown:0,low_effectiveness_guard:0,local_performance_guard:0,below_auto_threshold:0,snoozed:0},
  sources:{manual_seeds:0,auto_profile_enabled:false,provider_enabled:false,daily_calls_used:0},generated_at:''
}
const emptyReadiness:Readiness={
  status:'loading',provider_configured:false,provider_enabled:false,manual_seeds:0,auto_profile_seeds_enabled:false,
  per_sync_call_limit:0,candidate_seed_limit:0,estimated_candidate_call_budget:0,estimated_term_call_budget:0,
  daily_call_limit:0,daily_calls_used:0,estimated_monthly_call_ceiling:0,
  candidates:{pending:0,approved:0,rejected:0,pre_approve:0,pre_review:0,pre_skip:0},opportunities:{pending:0,eligible_auto:0},modes:{},generated_at:''
}

const labels:Record<string,string>={
  created:'draft napravljen',would_create:'napravio bi draft',eligible:'spremno za AUTO',suggest_only:'SUGGEST režim',off:'AUTO isključen',
  no_opportunity:'nema odgovarajuće prilike',daily_guard:'24h zaštita',quota_reached:'mesečna kvota potrošena',no_active_plan:'nema aktivan paket',no_menu_item:'nema aktivno jelo za AUTO',
  local_performance_guard:'lokalno slab trend',low_local_effectiveness:'slab istorijski učinak',repeat_cooldown:'trend je skoro korišćen',
  below_auto_threshold:'ispod AUTO praga',snoozed:'prilika je odložena',provider_paused:'Google Trends provider je pauziran',
  provider_key_missing:'nedostaje SerpApi ključ',waiting_for_candidates:'čeka nove trend kandidate',candidates_need_review:'trend kandidati čekaju odobrenje',
  waiting_for_opportunities:'čeka prilike za sadržaj',opportunities_guarded:'prilike postoje, ali ih zaštite trenutno blokiraju',
  ready_suggest_only:'spremno, ali restorani su na SUGGEST',ready:'Trend AUTO je spreman',loading:'proveravam sistem'
}
function label(code:string){return labels[code]||code.replaceAll('_',' ')}

export function TrendIntelligenceOwner({setNotice}:{setNotice:(value:string)=>void}){
  const[health,setHealth]=useState<IntelligenceHealth>(emptyHealth)
  const[readiness,setReadiness]=useState<Readiness>(emptyReadiness)
  const[dryRun,setDryRun]=useState<DryRunRow[]>([])
  const[loading,setLoading]=useState(true)

  useEffect(()=>{void load()},[])

  async function load(){
    setLoading(true)
    const[h,r,d]=await Promise.all([
      supabase.rpc('admin_trend_intelligence_health'),
      supabase.rpc('admin_trend_provider_readiness'),
      supabase.rpc('admin_trend_auto_dry_run',{p_limit:50}),
    ])
    const error=h.error||r.error||d.error
    if(error)setNotice(error.message)
    if(h.data)setHealth(h.data as IntelligenceHealth)
    if(r.data)setReadiness(r.data as Readiness)
    if(d.data)setDryRun((d.data||[]) as DryRunRow[])
    setLoading(false)
  }

  const ready=readiness.status==='ready'||readiness.status==='ready_suggest_only'
  const remaining=Math.max(0,(readiness.daily_call_limit||0)-(readiness.daily_calls_used||0))
  const candidateBudget=Math.max(0,readiness.estimated_candidate_call_budget||0)
  const termBudget=Math.max(0,readiness.estimated_term_call_budget||0)
  const splitTotal=Math.max(1,candidateBudget+termBudget)
  const candidatePct=Math.round(candidateBudget/splitTotal*100)

  return <div className="trend-intelligence-owner">
    <header className="trend-intel-hero">
      <div><span><TrendingUp size={22}/></span><div><p>TREND INTELLIGENCE</p><h1>AUTO odluke, learning i readiness</h1><small>Jedno mesto za proveru šta sistem zna, šta ga blokira i šta bi AUTO uradio — bez automatskog objavljivanja.</small></div></div>
      <button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?'Osvežavam…':'Osveži'}</button>
    </header>

    <section className={'trend-readiness '+(ready?'ready':'attention')}>
      <div className="trend-readiness-icon">{ready?<ShieldCheck size={24}/>:<Gauge size={24}/>}</div>
      <div><span>PROVIDER READINESS</span><strong>{label(readiness.status)}</strong><small>{readiness.provider_configured?'SerpApi ključ je postavljen.':'SerpApi ključ nije postavljen.'} Provider je {readiness.provider_enabled?'dozvoljen':'pauziran'}.</small></div>
      <div className="trend-readiness-budget"><b>{remaining}</b><span>API poziva preostalo danas</span><small>limit {readiness.daily_call_limit}/dan · teorijski plafon {readiness.estimated_monthly_call_ceiling}/30 dana</small></div>
    </section>

    <section className="trend-budget-split">
      <div className="trend-budget-copy"><span>API BUDŽET PO SYNC-U</span><strong>{readiness.per_sync_call_limit} poziva maksimalno</strong><small>Novi trend kandidati imaju rezervisan deo budžeta, pa ih TIMESERIES scoring više ne može potpuno izgurati.</small></div>
      <div className="trend-budget-meter" aria-label={`Candidate discovery ${candidateBudget}, trend scoring ${termBudget}`}>
        <div className="trend-budget-bar"><span style={{width:`${candidatePct}%`}}/></div>
        <div className="trend-budget-legend"><span><i/>Candidate discovery <b>{candidateBudget}</b></span><span><i/>Trend scoring <b>{termBudget}</b></span></div>
        <small>candidate seed limit {readiness.candidate_seed_limit} · stvarna potrošnja može biti manja ako nema dovoljno seedova ili termina</small>
      </div>
    </section>

    <section className="trend-intel-grid">
      <article className="trend-intel-card"><span><Sparkles size={18}/> Learning memorija</span><strong>{health.effectiveness.learned_seeds}</strong><p>naučenih seedova iz {health.effectiveness.restaurants} restorana</p><div><b>{health.effectiveness.high_confidence}</b> visoko poverenje · <b>{health.effectiveness.strong_positive}</b> jaki pozitivni · <b>{health.effectiveness.strong_negative}</b> jaki negativni</div></article>
      <article className="trend-intel-card"><span><Zap size={18}/> AUTO spremno</span><strong>{health.opportunities.eligible_auto}</strong><p>rising prilika trenutno prolazi sve guardove</p><div><b>{health.opportunities.pending}</b> pending · <b>{health.opportunities.below_auto_threshold}</b> ispod praga · <b>{health.opportunities.snoozed}</b> odloženo</div></article>
      <article className="trend-intel-card"><span><Activity size={18}/> Zaštite</span><strong>{health.opportunities.repeat_cooldown+health.opportunities.low_effectiveness_guard+health.opportunities.local_performance_guard}</strong><p>prilika trenutno zadržano zaštitnim pravilima</p><div><b>{health.opportunities.repeat_cooldown}</b> repeat · <b>{health.opportunities.low_effectiveness_guard}</b> effectiveness · <b>{health.opportunities.local_performance_guard}</b> performance</div></article>
      <article className="trend-intel-card"><span><Gauge size={18}/> Trend pipeline</span><strong>{readiness.candidates.approved}</strong><p>odobrenih kandidata · {readiness.candidates.pending} pending</p><div><b>{readiness.candidates.pre_approve}</b> preporuka odobri · <b>{readiness.candidates.pre_review}</b> proveri · <b>{readiness.candidates.pre_skip}</b> preskoči</div></article>
    </section>

    <section className="admin-panel trend-dry-panel">
      <div className="admin-panel-head"><div><p className="eyebrow">AUTO DRY RUN</p><h2>Šta bi AUTO uradio sada</h2></div><span className="admin-counter">{dryRun.filter(row=>row.would_create).length} bi napravilo draft</span></div>
      <p className="trend-dry-note">Simulacija ne pravi objavu i ništa ne menja. Prikazuje isti tip odluke koji worker koristi pre kreiranja drafta.</p>
      <div className="trend-dry-list">{dryRun.length?dryRun.map(row=><article className={'trend-dry-row '+(row.would_create?'ready':'guarded')} key={row.restaurant_id}>
        <div className="trend-dry-main"><strong>{row.restaurant_name}</strong><span>{row.mode.toUpperCase()} · {label(row.decision)}</span>{row.trend_query&&<small>{row.trend_query}{row.seed_query?` · seed ${row.seed_query}`:''}</small>}</div>
        <div className="trend-dry-score"><b>{row.opportunity_score??'—'}</b><span>score</span></div>
        <div className="trend-dry-meta"><span>Effectiveness <b>{row.effectiveness_score??50}</b> · {row.effectiveness_samples??0} uz.</span><span>Performance <b>{Number(row.performance_boost||0)>=0?'+':''}{row.performance_boost??0}</b> · {row.performance_samples??0} uz.</span><span>Repeat <b>−{row.repeat_penalty??0}</b></span></div>
        <div className="trend-dry-quota"><span>Mesec</span><b>{row.monthly_used}/{row.monthly_limit??'∞'}</b></div>
      </article>):<div className="admin-empty">Nema restorana u SUGGEST/AUTO režimu za dry-run pregled.</div>}</div>
    </section>

    {!readiness.provider_configured&&<section className="trend-intel-callout"><ShieldCheck size={18}/><div><strong>Trend pipeline je bez spoljnog signala</strong><span>Curated bank i lokalni performance learning rade, ali novi Google Trends kandidati neće stizati dok SerpApi ključ nije podešen u OWNER Control → System.</span></div></section>}
  </div>
}
