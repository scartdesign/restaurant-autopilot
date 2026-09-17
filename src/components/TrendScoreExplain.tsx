import { useState } from 'react'
import { ChevronDown, ChevronUp, Gauge, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../trend-score-explain.css'

type ExplainData={
  id:string
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
}

const guardLabels:Record<string,string>={
  eligible:'Spremno za AUTO',
  low_local_effectiveness:'Zaštita: slab istorijski učinak',
  local_performance_guard:'Zaštita: slab lokalni performance',
  repeat_cooldown:'Zaštita: trend je skoro korišćen',
  below_auto_threshold:'Ispod AUTO praga 85',
  snoozed:'Prilika je odložena',
  expired:'Prilika je istekla',
  not_rising:'Nije rising signal',
  created:'Draft je već napravljen',
  dismissed:'Prilika je sklonjena',
}

function signed(value:number){return `${value>0?'+':''}${value}`}

export function TrendScoreExplain({opportunityId,setNotice}:{opportunityId:string;setNotice:(value:string)=>void}){
  const[open,setOpen]=useState(false)
  const[loading,setLoading]=useState(false)
  const[data,setData]=useState<ExplainData|null>(null)

  async function toggle(){
    if(open){setOpen(false);return}
    setOpen(true)
    if(data)return
    setLoading(true)
    const{data:result,error}=await supabase.rpc('trend_opportunity_explain',{p_id:opportunityId})
    if(error){setNotice(error.message);setOpen(false)}
    else setData(result as ExplainData)
    setLoading(false)
  }

  return <div className="trend-score-explain">
    <button type="button" className="trend-score-explain-toggle" onClick={()=>void toggle()} disabled={loading}>
      <Gauge size={13}/>{loading?'Računam…':'Zašto ovaj score?'}{open?<ChevronUp size={13}/>:<ChevronDown size={13}/>} 
    </button>
    {open&&<div className="trend-score-explain-body">
      {data?<>
        <div className="trend-score-formula">
          <div><span>Osnova</span><b>{data.estimated_base_score}</b><small>trend + relevance + menu fit</small></div>
          <div className={data.performance_boost>0?'positive':data.performance_boost<0?'negative':''}><span>Local performance</span><b>{signed(data.performance_boost)}</b><small>{data.performance_samples} uz. · istorijska povezanost</small></div>
          <div><span>Freshness</span><b>−{data.freshness_penalty}</b><small>starost trend signala</small></div>
          <div><span>Repeat</span><b>−{data.repeat_penalty}</b><small>zaštita od ponavljanja</small></div>
          <div className="final"><span>Final</span><b>{data.final_score}</b><small>/100</small></div>
        </div>
        <div className="trend-effectiveness-row"><Sparkles size={12}/><span>Effectiveness memorija</span><b>{data.effectiveness_score}/100</b><small>{data.effectiveness_samples} uzoraka</small></div>
        <div className={'trend-auto-guard '+(data.auto_guard==='eligible'?'eligible':'guarded')}>{guardLabels[data.auto_guard]||data.auto_guard.replaceAll('_',' ')}</div>
        <p>Effectiveness je istorijski signal/guard i ne sabira se direktno u score. Performance prikazuje opaženu povezanost sa ranijim rezultatima, ne dokaz uzročnosti.</p>
      </>:<div className="trend-score-explain-loading">Učitavam objašnjenje…</div>}
    </div>}
  </div>
}
