import { useEffect, useState } from 'react'
import { Activity, CheckCircle2, RefreshCw, Send, TrendingUp, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../production-ops.css'

type Ops={
 discovery:{provider_configured:boolean;provider_enabled:boolean;cron_active:boolean;latest_status:string;latest_started_at:string|null;latest_error:string|null;latest_reason:string|null;latest_api_calls:number;latest_candidates:number;recent_success:boolean}
 meta:{provider_configured:boolean;cron_active:boolean;stuck_recovery_cron_active:boolean;connected:number;expired_connections:number;error_connections:number;queued:number;retrying:number;failed:number;processing:number;stuck_processing:number;manual_review_required:number;max_attempts_failed:number;insights_failed:number;last_published_at:string|null;auto_retry_max_attempts:number;auto_retry_backoff_minutes:number[];stuck_after_minutes:number;stuck_recovery_interval_minutes:number}
 e2e:{serpapi_ready:boolean;meta_provider_ready:boolean;meta_connection_ready:boolean;meta_publish_e2e_done:boolean;meta_insights_e2e_done:boolean;blocking_steps:string[]}
 generated_at:string
}
const empty:Ops={discovery:{provider_configured:false,provider_enabled:false,cron_active:false,latest_status:'never',latest_started_at:null,latest_error:null,latest_reason:null,latest_api_calls:0,latest_candidates:0,recent_success:false},meta:{provider_configured:false,cron_active:false,stuck_recovery_cron_active:false,connected:0,expired_connections:0,error_connections:0,queued:0,retrying:0,failed:0,processing:0,stuck_processing:0,manual_review_required:0,max_attempts_failed:0,insights_failed:0,last_published_at:null,auto_retry_max_attempts:3,auto_retry_backoff_minutes:[5,20],stuck_after_minutes:15,stuck_recovery_interval_minutes:10},e2e:{serpapi_ready:false,meta_provider_ready:false,meta_connection_ready:false,meta_publish_e2e_done:false,meta_insights_e2e_done:false,blocking_steps:[]},generated_at:''}

export function ProductionOpsCard({setNotice}:{setNotice:(v:string)=>void}){
 const[state,setState]=useState<Ops>(empty);const[loading,setLoading]=useState(true)
 useEffect(()=>{void load()},[])
 async function load(){setLoading(true);const{data,error}=await supabase.rpc('admin_production_ops_health');if(error)setNotice(error.message);else if(data)setState(data as Ops);setLoading(false)}
 const checks=[['SerpApi / Discovery',state.e2e.serpapi_ready],['Meta provider',state.e2e.meta_provider_ready],['Meta test konekcija',state.e2e.meta_connection_ready],['Meta publish E2E',state.e2e.meta_publish_e2e_done],['Meta Insights E2E',state.e2e.meta_insights_e2e_done]] as const
 return <section className="production-ops">
   <div className="production-ops-head"><div><span><Activity size={17}/> PRODUCTION OPS</span><strong>Discovery, publishing i E2E readiness</strong><p>Auto-retry ponavlja samo poznate privremene Meta API greške; maksimum {state.meta.auto_retry_max_attempts} pokušaja, sa backoff-om {state.meta.auto_retry_backoff_minutes.join(' → ')} min. Stuck recovery proverava jobove na {state.meta.stuck_recovery_interval_minutes} min i posle {state.meta.stuck_after_minutes} min ih šalje na ručnu proveru umesto slepog retry-a.</p></div><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={13}/>{loading?'Proveravam…':'Osveži'}</button></div>
   <div className="production-ops-grid"><article className={state.e2e.serpapi_ready?'ok':'warn'}><TrendingUp size={18}/><div><span>DISCOVERY</span><strong>{state.discovery.provider_configured?'Provider povezan':'SerpApi ključ nedostaje'}</strong><p>Cron {state.discovery.cron_active?'aktivan':'nije aktivan'} · poslednje: {state.discovery.latest_status} · {state.discovery.latest_api_calls} API poziva · {state.discovery.latest_candidates} kandidata</p>{state.discovery.latest_reason&&<small>{state.discovery.latest_reason}</small>}</div></article><article className={(state.meta.failed===0&&state.meta.stuck_processing===0)?'ok':'warn'}><Send size={18}/><div><span>META QUEUE</span><strong>{state.meta.connected} connected · {state.meta.retrying} retry · {state.meta.failed} failed</strong><p>{state.meta.queued} queued · {state.meta.processing} processing · {state.meta.stuck_processing} stuck · {state.meta.manual_review_required} manual review · {state.meta.insights_failed} insights grešaka · recovery cron {state.meta.stuck_recovery_cron_active?'ON':'OFF'}</p></div></article></div>
   <div className="production-e2e">{checks.map(([label,ok])=><div className={ok?'done':'todo'} key={label}>{ok?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>}<span>{label}</span><b>{ok?'SPREMNO':'ČEKA'}</b></div>)}</div>
   {state.e2e.blocking_steps?.length>0&&<div className="production-blockers"><strong>Šta još blokira pravi E2E test:</strong>{state.e2e.blocking_steps.map(step=><span key={step}>{step}</span>)}</div>}
 </section>
}
