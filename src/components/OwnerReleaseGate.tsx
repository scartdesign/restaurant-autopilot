import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Rocket, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../release-gate.css'

type OpsHealth={
  discovery:{provider_configured:boolean;provider_enabled:boolean;cron_active:boolean;recent_success:boolean}
  meta:{provider_configured:boolean;cron_active:boolean;stuck_recovery_cron_active:boolean;connected:number;failed:number;stuck_processing:number;manual_review_required:number;insights_failed:number}
  e2e:{serpapi_ready:boolean;meta_provider_ready:boolean;meta_connection_ready:boolean;meta_publish_e2e_done:boolean;meta_insights_e2e_done:boolean;blocking_steps:string[]}
}
type SalesReadiness={any_payment_ready:boolean;sales_email_ready:boolean;legal_links_ready:boolean;blockers:string[]}
type IncidentSummary={meta_failed:number;meta_manual_review:number;meta_connection_issues:number;discovery_issues:number}
type IncidentFeed={summary:IncidentSummary}
type GateCheck={id:string;label:string;detail:string;ok:boolean;critical:boolean}

const emptyOps:OpsHealth={
  discovery:{provider_configured:false,provider_enabled:false,cron_active:false,recent_success:false},
  meta:{provider_configured:false,cron_active:false,stuck_recovery_cron_active:false,connected:0,failed:0,stuck_processing:0,manual_review_required:0,insights_failed:0},
  e2e:{serpapi_ready:false,meta_provider_ready:false,meta_connection_ready:false,meta_publish_e2e_done:false,meta_insights_e2e_done:false,blocking_steps:[]},
}
const emptySales:SalesReadiness={any_payment_ready:false,sales_email_ready:false,legal_links_ready:false,blockers:[]}
const emptyIncidents:IncidentFeed={summary:{meta_failed:0,meta_manual_review:0,meta_connection_issues:0,discovery_issues:0}}

export function OwnerReleaseGate({setNotice,onOpenIncidents,onOpenHealth}:{setNotice:(value:string)=>void;onOpenIncidents:()=>void;onOpenHealth:()=>void}){
  const[ops,setOps]=useState<OpsHealth>(emptyOps)
  const[sales,setSales]=useState<SalesReadiness>(emptySales)
  const[incidents,setIncidents]=useState<IncidentFeed>(emptyIncidents)
  const[loading,setLoading]=useState(true)
  const[sourceErrors,setSourceErrors]=useState<string[]>([])

  useEffect(()=>{void load()},[])

  async function load(){
    setLoading(true)
    const[opsRes,salesRes,incidentRes]=await Promise.all([
      supabase.rpc('admin_production_ops_health'),
      supabase.rpc('admin_sales_readiness'),
      supabase.rpc('admin_incident_center',{p_limit:10}),
    ])
    const errors:string[]=[]
    if(opsRes.error)errors.push('Production Ops: '+opsRes.error.message)
    else if(opsRes.data)setOps(opsRes.data as OpsHealth)
    if(salesRes.error)errors.push('Sales readiness: '+salesRes.error.message)
    else if(salesRes.data)setSales(salesRes.data as SalesReadiness)
    if(incidentRes.error)errors.push('Incident Center: '+incidentRes.error.message)
    else if(incidentRes.data)setIncidents(incidentRes.data as IncidentFeed)
    setSourceErrors(errors)
    if(errors.length)setNotice('Release Gate nije mogao da pročita sve production izvore.')
    setLoading(false)
  }

  const checks=useMemo<GateCheck[]>(()=>[
    {id:'payments',label:'Naplata',detail:'Najmanje jedan production payment tok je spreman.',ok:sales.any_payment_ready,critical:true},
    {id:'legal',label:'Legal + prodajni kontakt',detail:'Kupac ima prodajni email i pravne linkove.',ok:sales.sales_email_ready&&sales.legal_links_ready,critical:true},
    {id:'discovery',label:'Discovery',detail:'Provider i background cron su aktivni.',ok:ops.discovery.provider_configured&&ops.discovery.provider_enabled&&ops.discovery.cron_active,critical:false},
    {id:'meta-provider',label:'Meta provider',detail:'Server credentials i publish worker su spremni.',ok:ops.meta.provider_configured&&ops.meta.cron_active,critical:true},
    {id:'meta-recovery',label:'Meta recovery',detail:'Stuck-job recovery radi bez slepog retry-a.',ok:ops.meta.stuck_recovery_cron_active,critical:true},
    {id:'meta-connection',label:'Meta test konekcija',detail:'Postoji najmanje jedna validna test konekcija.',ok:ops.meta.connected>0&&ops.e2e.meta_connection_ready,critical:true},
    {id:'publish-e2e',label:'Meta publish E2E',detail:'Bar jedna realna test objava je potvrđena end-to-end.',ok:ops.e2e.meta_publish_e2e_done,critical:true},
    {id:'insights-e2e',label:'Meta Insights E2E',detail:'Insights povratna petlja je potvrđena end-to-end.',ok:ops.e2e.meta_insights_e2e_done,critical:false},
    {id:'incidents',label:'Aktivni incidenti',detail:'Nema failed/manual-review/connection/discovery incidenta koji traži odluku.',ok:(incidents.summary.meta_failed+incidents.summary.meta_manual_review+incidents.summary.meta_connection_issues+incidents.summary.discovery_issues)===0,critical:true},
  ],[ops,sales,incidents])

  const passed=checks.filter(item=>item.ok).length
  const criticalBlockers=checks.filter(item=>item.critical&&!item.ok)
  const ready=criticalBlockers.length===0&&sourceErrors.length===0
  const blockerLabels=[
    ...criticalBlockers.map(item=>item.label),
    ...(sales.blockers||[]),
    ...(ops.e2e.blocking_steps||[]),
  ].filter((item,index,all)=>all.indexOf(item)===index)

  return <section className={'release-gate '+(ready?'ready':'blocked')}>
    <header className="release-gate-hero">
      <div className="release-gate-title"><span><Rocket size={20}/></span><div><p>OWNER · RELEASE GATE</p><h2>{ready?'Restorapp je spreman za kontrolisani launch.':'Pre launch-a postoje production blokade.'}</h2><small>Jedan pregled prodaje, Meta publishinga, recovery zaštite, Discovery-ja i aktivnih incidenata. Ovaj ekran ništa ne objavljuje i ne menja podatke.</small></div></div>
      <div className="release-gate-score"><strong>{passed}/{checks.length}</strong><span>provera spremno</span><b>{ready?'GO':'HOLD'}</b></div>
    </header>

    <div className="release-gate-actions">
      <button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>{loading?'Proveravam…':'Proveri ponovo'}</button>
      <button className="secondary" onClick={onOpenHealth}><ShieldCheck size={14}/> Production Ops</button>
      <button className="secondary" onClick={onOpenIncidents}><AlertTriangle size={14}/> Incident Center</button>
    </div>

    <div className="release-gate-grid">{checks.map(item=><article className={item.ok?'pass':item.critical?'block':'warn'} key={item.id}>
      {item.ok?<CheckCircle2 size={17}/>:<AlertTriangle size={17}/>}
      <div><strong>{item.label}</strong><span>{item.detail}</span></div>
      <b>{item.ok?'PASS':item.critical?'BLOCK':'WAIT'}</b>
    </article>)}</div>

    {!ready&&<div className="release-gate-blockers"><strong>Pre puštanja reši:</strong>{blockerLabels.length?blockerLabels.map(item=><span key={item}>{item}</span>):<span>Production izvori nisu kompletno dostupni.</span>}</div>}
    {sourceErrors.length>0&&<div className="release-gate-errors">{sourceErrors.map(item=><span key={item}>{item}</span>)}</div>}
  </section>
}
