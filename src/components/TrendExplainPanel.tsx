import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'
import '../trend-explain.css'

type OpportunityLite={
  id:string
  trend_query:string
  seed_query:string
  opportunity_score:number
  trend_type:'rising'|'top'
}

type ExplanationSignal={signal:string;value:number;label:string}

type ExplainRow={
  id:string
  trend_query:string
  seed_query:string
  final_score:number
  estimated_base_score:number
  performance_boost:number
  performance_samples:number
  effectiveness_score:number
  effectiveness_samples:number
  freshness_penalty:number
  repeat_penalty:number
  candidate_last_seen_at:string|null
  last_seed_used_at:string|null
  snoozed_until:string|null
  auto_guard:string
  explanation:ExplanationSignal[]
}

const guardLabels:Record<string,string>={
  eligible:'AUTO spreman',
  not_rising:'nije rising signal',
  expired:'signal je istekao',
  snoozed:'privremeno odloženo',
  low_local_effectiveness:'slab istorijski učinak',
  local_performance_guard:'slab lokalni performance',
  repeat_cooldown:'trend je skoro korišćen',
  below_auto_threshold:'ispod AUTO praga 85',
  created:'već iskorišćeno',
  dismissed:'sklonjeno',
  expired_status:'isteklo',
}

function guardLabel(value:string){return guardLabels[value]||value.replaceAll('_',' ')}
function signed(value:number){return value>0?`+${value}`:String(value)}

export function TrendExplainPanel({restaurant,setNotice}:{restaurant:Restaurant;setNotice:(value:string)=>void}){
  const[rows,setRows]=useState<ExplainRow[]>([])
  const[loading,setLoading]=useState(false)

  useEffect(()=>{void load(false)},[restaurant.id,restaurant.trend_autopilot_mode])

  async function load(manual:boolean){
    if((restaurant.trend_autopilot_mode||'suggest')==='off'){setRows([]);return}
    setLoading(true)
    const refreshed=await supabase.functions.invoke('content-engine',{body:{action:'refresh_trend_opportunities',restaurantId:restaurant.id}})
    if(refreshed.error||refreshed.data?.error){
      if(manual)setNotice(refreshed.data?.error||refreshed.error?.message||'Trend objašnjenja trenutno nisu dostupna.')
      setLoading(false)
      return
    }
    const opportunities=((refreshed.data?.opportunities||[]) as OpportunityLite[]).slice(0,4)
    const explained=await Promise.all(opportunities.map(async(item)=>{
      const{data,error}=await supabase.rpc('trend_opportunity_explain',{p_id:item.id})
      if(error||!data)return null
      return data as ExplainRow
    }))
    setRows(explained.filter(Boolean) as ExplainRow[])
    setLoading(false)
  }

  if((restaurant.trend_autopilot_mode||'suggest')==='off')return null

  return <section className="trend-explain panel">
    <div className="trend-explain-head">
      <div><p className="eyebrow">TREND RADAR · EXPLAINABILITY</p><h2>Zašto je trend dobio ovaj score?</h2><span>Score je transparentan: baza signala + lokalni performance − freshness − repeat. Effectiveness je poseban sigurnosni guard, ne skriveni dodatak score-u.</span></div>
      <button className="secondary" onClick={()=>void load(true)} disabled={loading}><RefreshCw size={13} className={loading?'spin':''}/>{loading?'Proveravam…':'Osveži'}</button>
    </div>

    {rows.length?<div className="trend-explain-grid">{rows.map(row=>{
      const eligible=row.auto_guard==='eligible'
      return <article className={'trend-explain-card '+(eligible?'eligible':'guarded')} key={row.id}>
        <div className="trend-explain-title">
          <span className="trend-explain-icon"><TrendingUp size={16}/></span>
          <div><strong>{row.trend_query}</strong><small>seed: {row.seed_query}</small></div>
          <b>{row.final_score}<small>/100</small></b>
        </div>

        <div className="trend-score-equation">
          <span><small>Baza</small><b>{row.estimated_base_score}</b></span>
          <i>+</i>
          <span className={row.performance_boost>0?'positive':row.performance_boost<0?'negative':''}><small>Performance</small><b>{signed(row.performance_boost)}</b></span>
          <i>−</i>
          <span><small>Freshness</small><b>{row.freshness_penalty}</b></span>
          <i>−</i>
          <span><small>Repeat</small><b>{row.repeat_penalty}</b></span>
          <i>=</i>
          <span className="final"><small>Score</small><b>{row.final_score}</b></span>
        </div>

        <div className="trend-explain-learning">
          <span><Sparkles size={12}/> Performance <b>{signed(row.performance_boost)}</b> · {row.performance_samples} uz.</span>
          <span><Zap size={12}/> Effectiveness <b>{row.effectiveness_score}/100</b> · {row.effectiveness_samples} uz.</span>
        </div>

        <div className={'trend-auto-guard '+(eligible?'ok':'blocked')}><ShieldCheck size={13}/><strong>{guardLabel(row.auto_guard)}</strong>{eligible?<span>rising + score 85+ i svi guardovi prolaze</span>:<span>AUTO neće napraviti draft dok ovaj uslov ne prođe.</span>}</div>
        <small className="trend-association-note">Performance i effectiveness koriste istorijsku povezanost rezultata sa trend seedom; sistem ih ne tretira kao dokaz uzročnosti.</small>
      </article>
    })}</div>:<div className="trend-explain-empty"><TrendingUp size={20}/><div><strong>{loading?'Analiziram Trend Radar…':'Još nema trenda za objašnjenje.'}</strong><span>Kada se pojavi odobrena prilika koja odgovara meniju, ovde će biti prikazan ceo score breakdown i AUTO guard.</span></div></div>}
  </section>
}
