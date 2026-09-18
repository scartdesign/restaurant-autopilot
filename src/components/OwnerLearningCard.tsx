import { useEffect, useMemo, useState } from 'react'
import { Brain, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../owner-learning.css'

type Row={seed_query:string;sample_count:number;approved_count:number;rejected_count:number;preference_score:number;last_decision_at:string|null}

export function OwnerLearningCard({setNotice,version=0}:{setNotice:(v:string)=>void;version?:number}){
  const[rows,setRows]=useState<Row[]>([])
  const[loading,setLoading]=useState(true)
  useEffect(()=>{void load()},[version])
  async function load(){
    setLoading(true)
    const{data,error}=await supabase.rpc('admin_discovery_review_learning_feed',{p_limit:12})
    if(error)setNotice(error.message);else setRows((data||[]) as Row[])
    setLoading(false)
  }
  const samples=useMemo(()=>rows.reduce((sum,row)=>sum+row.sample_count,0),[rows])
  return <section className="owner-learning-card">
    <div className="owner-learning-head"><div><span><Brain size={17}/> OWNER LEARNING</span><strong>AI uči iz tvojih odluka</strong><p>Preference se računa iz poslednjih 180 dana i namerno je ograničena na ±10. Tek sa više odluka može značajnije da utiče na pre-review confidence.</p></div><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={13}/>{loading?'…':'Osveži'}</button></div>
    <div className="owner-learning-summary"><span><b>{rows.length}</b> naučenih seedova</span><span><b>{samples}</b> OWNER odluka u memoriji</span><span><b>2+</b> uzorka za confidence uticaj</span><span><b>4+</b> za jači recommendation guard</span></div>
    <div className="owner-learning-list">{rows.length?rows.map(row=><div className="owner-learning-row" key={row.seed_query}><div><strong>{row.seed_query}</strong><small>{row.approved_count} odobreno · {row.rejected_count} preskočeno · {row.sample_count} uz.</small></div><span className={row.preference_score>0?'positive':row.preference_score<0?'negative':'neutral'}>{row.preference_score>0?'+':''}{row.preference_score}</span></div>):<div className="admin-empty">Još nema OWNER learning uzoraka. Prve stvarne odluke u AI pre-review queue-u će automatski početi da grade ovu memoriju.</div>}</div>
  </section>
}
