import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../trend-review-metrics.css'

type Metrics={
  window_days:number
  decisions:number
  approved:number
  rejected:number
  aligned:number
  overridden:number
  manual_review:number
  no_pre_review:number
  comparable_decisions:number
  alignment_rate:number|null
  recommendations:{approve:number;review:number;skip:number}
  last_decision_at:string|null
}

const empty:Metrics={window_days:90,decisions:0,approved:0,rejected:0,aligned:0,overridden:0,manual_review:0,no_pre_review:0,comparable_decisions:0,alignment_rate:null,recommendations:{approve:0,review:0,skip:0},last_decision_at:null}

export function TrendReviewMetricsCard({setNotice,version=0}:{setNotice:(value:string)=>void;version?:number}){
  const[data,setData]=useState<Metrics>(empty)
  const[loading,setLoading]=useState(true)
  useEffect(()=>{void load()},[version])
  async function load(){
    setLoading(true)
    const{data,error}=await supabase.rpc('admin_trend_review_metrics')
    if(error)setNotice(error.message)
    else if(data)setData(data as Metrics)
    setLoading(false)
  }
  return <section className="trend-review-metrics">
    <div className="trend-review-metrics-head"><div><span>OWNER REVIEW TELEMETRY</span><strong>AI preporuka naspram OWNER odluke</strong><small>Poslednjih {data.window_days} dana · analitika poverenja, bez automatskog odlučivanja.</small></div><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={13}/>{loading?'Osvežavam…':'Osveži'}</button></div>
    <div className="trend-review-metrics-grid">
      <article><span>Odluke</span><b>{data.decisions}</b><small>{data.approved} odobreno · {data.rejected} preskočeno</small></article>
      <article><span>Poklapanje</span><b>{data.alignment_rate==null?'—':`${data.alignment_rate}%`}</b><small>{data.aligned} usklađeno · {data.overridden} preglasano</small></article>
      <article><span>AI preporuke</span><b>{data.recommendations.approve}</b><small>odobri · {data.recommendations.review} proveri · {data.recommendations.skip} preskoči</small></article>
      <article><span>Ručna procena</span><b>{data.manual_review}</b><small>{data.no_pre_review} odluka bez pre-review signala</small></article>
    </div>
    <div className="trend-review-metrics-foot"><span><CheckCircle2 size={13}/> „Poklapanje“ meri samo jasne approve/skip preporuke.</span><span><XCircle size={13}/> Preglasavanje nije greška — služi da vidiš gde AI treba dalje da uči.</span><span><ShieldCheck size={13}/> Dostupno samo superadminu.</span>{data.last_decision_at&&<span>Poslednja odluka: {new Date(data.last_decision_at).toLocaleString('sr-RS')}</span>}</div>
  </section>
}
