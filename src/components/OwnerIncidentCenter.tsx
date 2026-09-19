import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, ExternalLink, RefreshCw, RotateCcw, ShieldCheck, TrendingUp, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../owner-incident-center.css'

type Summary={meta_failed:number;meta_manual_review:number;meta_connection_issues:number;discovery_issues:number}
type MetaJob={
  id:string;restaurant_id:string;restaurant_name:string;post_id:string|null;post_title:string;connection_id:string;platform:string;status:string;attempt_count:number;provider_media_id:string|null;error_message:string|null;updated_at:string;created_at:string;
  manual_review_required:boolean;manual_review_acknowledged_at:string|null;manual_retry_count:number;connection_status:string|null;token_expires_at:string|null;can_retry:boolean;retry_block_reason:string|null
}
type ConnectionIssue={id:string;restaurant_id:string;restaurant_name:string;owner_id:string;status:string;page_name:string|null;instagram_username:string|null;token_expires_at:string|null;last_verified_at:string|null;updated_at:string;severity:number;reason:string}
type DiscoveryIssue={id:string;source:string;mode:string|null;status:string;started_at:string;finished_at:string|null;error_message:string|null;reason:string;api_calls:number;candidates_upserted:number;budget_exhausted:boolean}
type Feed={summary:Summary;meta_jobs:MetaJob[];connections:ConnectionIssue[];discovery:DiscoveryIssue[];generated_at:string}
const empty:Feed={summary:{meta_failed:0,meta_manual_review:0,meta_connection_issues:0,discovery_issues:0},meta_jobs:[],connections:[],discovery:[],generated_at:''}

function when(value:string|null){if(!value)return '—';try{return new Intl.DateTimeFormat('sr-RS',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch{return value}}
function retryBlockLabel(reason:string|null){
  if(reason==='provider_media_exists')return 'Meta već ima media ID — proveri objavu pre bilo kakvog retry-a'
  if(reason==='attempt_limit')return 'ukupan retry limit je dostignut'
  if(reason==='manual_retry_limit')return 'OWNER manual retry limit je dostignut'
  if(reason==='token_expired')return 'Meta token je istekao'
  if(reason==='connection_not_connected')return 'Meta konekcija nije povezana'
  if(reason==='manual_review_not_acknowledged')return 'manual review još nije potvrđen'
  return 'server safety guard'
}

export function OwnerIncidentCenter({setNotice,onOpenTrend}:{setNotice:(value:string)=>void;onOpenTrend:()=>void}){
  const[data,setData]=useState<Feed>(empty)
  const[loading,setLoading]=useState(true)
  const[working,setWorking]=useState('')
  useEffect(()=>{void load()},[])

  async function load(){
    setLoading(true)
    const{data:payload,error}=await supabase.rpc('admin_incident_center',{p_limit:40})
    if(error)setNotice(error.message)
    else if(payload)setData(payload as Feed)
    setLoading(false)
  }

  async function action(id:string,rpc:'admin_acknowledge_meta_manual_review'|'admin_queue_meta_retry'|'admin_dismiss_meta_publish_incident'){
    if(rpc==='admin_acknowledge_meta_manual_review'&&!window.confirm('Potvrđuješ da si proverio Meta nalog i da nema već objavljene duple objave?'))return
    if(rpc==='admin_queue_meta_retry'&&!window.confirm('Vrati ovaj job u Meta queue? Objavljivanje će zatim odraditi background worker.'))return
    if(rpc==='admin_dismiss_meta_publish_incident'&&!window.confirm('Zatvori incident bez retry-a? Job ostaje failed u istoriji, ali više neće biti u Incident Center-u.'))return
    setWorking(id+rpc)
    const{error}=await supabase.rpc(rpc,{p_job_id:id})
    if(error)setNotice(error.message)
    else{
      if(rpc==='admin_acknowledge_meta_manual_review')setNotice('Manual review je potvrđen. Retry je sada dozvoljen.')
      if(rpc==='admin_queue_meta_retry')setNotice('Meta job je vraćen u queue. Background worker će ga bezbedno obraditi.')
      if(rpc==='admin_dismiss_meta_publish_incident')setNotice('Incident je zatvoren i ostaje sačuvan u audit istoriji.')
      await load()
    }
    setWorking('')
  }

  async function notifyReconnect(id:string){
    setWorking(id+'notify')
    const{data:result,error}=await supabase.rpc('admin_notify_meta_reconnect',{p_connection_id:id})
    if(error)setNotice(error.message)
    else setNotice(result?.already_sent?'Vlasnik je već obavešten u poslednja 24 sata.':'Vlasniku restorana je poslata in-app poruka za Meta reconnect.')
    await load()
    setWorking('')
  }

  const total=useMemo(()=>data.summary.meta_failed+data.summary.meta_connection_issues+data.summary.discovery_issues,[data.summary])

  return <div className="owner-incident-center">
    <header className="incident-hero">
      <div><span><ShieldCheck size={22}/></span><div><p>OWNER · INCIDENT CENTER</p><h2>Problemi koji traže odluku, na jednom mestu.</h2><small>Retry je dvostepen za rizične Meta incidente, reconnect ide vlasniku restorana, a svaka OWNER akcija ostaje u audit logu.</small></div></div>
      <div className="incident-hero-actions"><b className={total?'attention':'clear'}>{total} aktivno</b><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>{loading?'Proveravam…':'Osveži'}</button></div>
    </header>

    <section className="incident-summary">
      <article className={data.summary.meta_manual_review?'danger':'ok'}><span><AlertTriangle size={17}/> Manual review</span><strong>{data.summary.meta_manual_review}</strong><small>Meta jobovi koje ne ponavljamo naslepo</small></article>
      <article className={data.summary.meta_failed?'warn':'ok'}><span><XCircle size={17}/> Failed Meta</span><strong>{data.summary.meta_failed}</strong><small>aktivni publish incidenti</small></article>
      <article className={data.summary.meta_connection_issues?'warn':'ok'}><span><BellRing size={17}/> Meta konekcije</span><strong>{data.summary.meta_connection_issues}</strong><small>expired / error / ističe uskoro</small></article>
      <article className={data.summary.discovery_issues?'warn':'ok'}><span><TrendingUp size={17}/> Discovery</span><strong>{data.summary.discovery_issues}</strong><small>problematični run-ovi u 14 dana</small></article>
    </section>

    <section className="incident-panel">
      <div className="incident-panel-head"><div><p>META PUBLISHING</p><h3>Failed i manual-review jobovi</h3></div><span>{data.meta_jobs.length} prikazano</span></div>
      <div className="incident-list">{data.meta_jobs.length?data.meta_jobs.map(job=>{
        const ack=Boolean(job.manual_review_acknowledged_at)
        const busy=working.startsWith(job.id)
        return <article className={'incident-row '+(job.manual_review_required?'critical':'')} key={job.id}>
          <div className="incident-main">
            <div className="incident-badges"><span className="platform">{job.platform.toUpperCase()}</span>{job.manual_review_required&&<span className="manual">MANUAL REVIEW</span>}{ack&&<span className="ack"><CheckCircle2 size={11}/> PROVERENO</span>}</div>
            <strong>{job.restaurant_name} · {job.post_title}</strong>
            <p>{job.error_message||'Meta publish nije uspeo.'}</p>
            <small>Pokušaja {job.attempt_count} · manual retry {job.manual_retry_count}/2 · izmena {when(job.updated_at)} · konekcija {job.connection_status||'n/a'}</small>
          </div>
          <div className="incident-actions">
            {job.manual_review_required&&!ack&&<button className="primary" disabled={busy} onClick={()=>void action(job.id,'admin_acknowledge_meta_manual_review')}><ShieldCheck size={14}/> Potvrdi proveru</button>}
            {(!job.manual_review_required||ack)&&job.can_retry&&<button className="primary" disabled={busy} onClick={()=>void action(job.id,'admin_queue_meta_retry')}><RotateCcw size={14}/> Vrati u queue</button>}
            {!job.can_retry&&(!job.manual_review_required||ack)&&<span className="incident-blocked">Retry blokiran · {retryBlockLabel(job.retry_block_reason)}</span>}
            <button className="secondary" disabled={busy} onClick={()=>void action(job.id,'admin_dismiss_meta_publish_incident')}><XCircle size={14}/> Zatvori incident</button>
          </div>
        </article>
      }):<div className="incident-empty"><CheckCircle2 size={24}/><strong>Nema aktivnih Meta publish incidenata.</strong><span>Failed i recovered-stuck jobovi će se pojaviti ovde automatski.</span></div>}</div>
    </section>

    <section className="incident-panel">
      <div className="incident-panel-head"><div><p>META CONNECTIONS</p><h3>Konekcije koje traže vlasnika restorana</h3></div><span>{data.connections.length} aktivno</span></div>
      <div className="incident-connection-grid">{data.connections.length?data.connections.map(row=><article key={row.id}>
        <div><span className={'connection-status '+row.status}>{row.status.toUpperCase()}</span><strong>{row.restaurant_name}</strong><p>{row.reason}</p><small>{row.page_name||'Facebook page nije potvrđen'}{row.instagram_username?' · @'+row.instagram_username:''}</small><small>Token: {when(row.token_expires_at)} · provereno: {when(row.last_verified_at)}</small></div>
        <button className="primary" disabled={working===row.id+'notify'} onClick={()=>void notifyReconnect(row.id)}><BellRing size={14}/> Obavesti vlasnika</button>
      </article>):<div className="incident-empty compact"><CheckCircle2 size={21}/><strong>Meta konekcije su čiste.</strong></div>}</div>
    </section>

    <section className="incident-panel">
      <div className="incident-panel-head"><div><p>DISCOVERY / SERPAPI</p><h3>Run-ovi koji nisu završili uspešno</h3></div><button className="secondary" onClick={onOpenTrend}><ExternalLink size={14}/> Trend Intelligence</button></div>
      <div className="incident-discovery-list">{data.discovery.length?data.discovery.map(row=><article key={row.id}><span className={'discovery-status '+row.status}>{row.status.toUpperCase()}</span><div><strong>{row.reason||row.error_message||'Discovery run nije uspeo'}</strong><small>{when(row.started_at)} · {row.api_calls} API poziva · {row.candidates_upserted} kandidata{row.budget_exhausted?' · budžet potrošen':''}</small></div></article>):<div className="incident-empty compact"><CheckCircle2 size={21}/><strong>Nema Discovery problema u poslednjih 14 dana.</strong></div>}</div>
    </section>
  </div>
}
