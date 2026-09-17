import { useEffect, useState } from 'react'
import { Gauge, RefreshCw, ShieldCheck, TrendingUp, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import '../restaurant-trend-auto-preview.css'

type TrendOpportunityPreview={
  id:string
  trend_query:string|null
  seed_query:string|null
  score:number
  auto_guard:string
  effectiveness_score:number
  effectiveness_samples:number
  performance_boost:number
  performance_samples:number
  repeat_penalty:number
  expires_at:string|null
}

type TrendAutoPreview={
  restaurant_id:string
  restaurant_name:string
  mode:'off'|'suggest'|'auto'
  decision:string
  would_create:boolean
  daily_guard:boolean
  monthly_used:number
  monthly_limit:number|null
  opportunity:TrendOpportunityPreview|null
  checked_at:string
}

const labels:Record<string,string>={
  off:'AUTO je isključen',
  suggest_only:'SUGGEST režim — AUTO neće praviti draft',
  no_opportunity:'Trenutno nema odgovarajuće trend prilike',
  would_create:'AUTO bi sada napravio draft',
  eligible:'Spremno za AUTO',
  daily_guard:'24h zaštita — draft je već pravljen',
  no_active_plan:'Nema aktivan paket',
  quota_reached:'Mesečna kvota je potrošena',
  local_performance_guard:'Lokalni učinak ovog trenda je slab',
  low_local_effectiveness:'Istorijski učinak ovog trenda je slab',
  repeat_cooldown:'Ovaj trend je skoro korišćen',
  below_auto_threshold:'Trend je ispod AUTO praga',
  snoozed:'Trend prilika je odložena',
  expired:'Trend prilika je istekla',
  not_rising:'Trend nije rising signal',
}

function decisionLabel(code:string){return labels[code]||code.replaceAll('_',' ')}

export function RestaurantTrendAutoPreview({restaurant,setNotice}:{restaurant:Restaurant;setNotice:(value:string)=>void}){
  const[preview,setPreview]=useState<TrendAutoPreview|null>(null)
  const[loading,setLoading]=useState(true)

  useEffect(()=>{void load()},[restaurant.id,restaurant.trend_autopilot_mode])

  async function load(){
    setLoading(true)
    const{data,error}=await supabase.rpc('restaurant_trend_auto_preview',{p_restaurant_id:restaurant.id})
    if(error)setNotice(error.message)
    else setPreview(data as TrendAutoPreview)
    setLoading(false)
  }

  const decision=preview?.decision||'no_opportunity'
  const opp=preview?.opportunity||null
  const positive=decision==='would_create'
  const quota=preview?.monthly_limit==null?`${preview?.monthly_used??0} / ∞`:`${preview?.monthly_used??0} / ${preview.monthly_limit}`

  return <section className="restaurant-trend-preview-wrap">
    <div className={'restaurant-trend-preview '+(positive?'ready':'guarded')}>
      <header>
        <div className="restaurant-trend-preview-title"><span><TrendingUp size={20}/></span><div><p>TREND AUTO PREVIEW</p><h3>Šta bi Autopilot uradio sada?</h3><small>Bezbedna simulacija. Ne pravi draft i nikada ne objavljuje automatski.</small></div></div>
        <button type="button" className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>{loading?'Proveravam…':'Proveri sada'}</button>
      </header>

      <div className="restaurant-trend-decision">
        <div className="restaurant-trend-decision-icon">{positive?<Zap size={21}/>:<ShieldCheck size={21}/>}</div>
        <div><span>ODLUKA</span><strong>{loading?'Proveravam AUTO pravila…':decisionLabel(decision)}</strong><small>Režim: {(preview?.mode||restaurant.trend_autopilot_mode||'suggest').toUpperCase()}</small></div>
        <div className="restaurant-trend-quota"><Gauge size={15}/><span>Mesečna potrošnja</span><b>{quota}</b></div>
      </div>

      {opp&&<div className="restaurant-trend-signal">
        <div className="restaurant-trend-signal-main"><span>NAJBOLJA TRENUTNA PRILIKA</span><strong>{opp.trend_query||opp.seed_query||'Trend signal'}</strong><small>{opp.seed_query?`seed: ${opp.seed_query}`:'lokalni trend signal'}</small></div>
        <div className="restaurant-trend-score"><b>{opp.score}</b><span>AUTO score</span></div>
        <div className="restaurant-trend-metrics"><span>Effectiveness <b>{opp.effectiveness_score??50}</b> · {opp.effectiveness_samples??0} uz.</span><span>Performance <b>{Number(opp.performance_boost||0)>=0?'+':''}{opp.performance_boost??0}</b> · {opp.performance_samples??0} uz.</span><span>Repeat kazna <b>−{opp.repeat_penalty??0}</b></span></div>
      </div>}

      {!opp&&!loading&&<div className="restaurant-trend-empty">Nema aktivne rising prilike za ovaj restoran. SUGGEST i ručni sadržaj nastavljaju da rade normalno.</div>}
    </div>
  </section>
}
