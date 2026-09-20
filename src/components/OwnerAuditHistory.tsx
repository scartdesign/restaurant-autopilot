import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, History, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../owner-audit-history.css'

type AuditRow={
  id:string
  actor_user_id:string|null
  action:string
  entity_type:string
  entity_id:string|null
  details:Record<string,unknown>|null
  created_at:string
}

type Filter='all'|'meta'|'providers'|'trend'|'sales'

function when(value:string){
  try{return new Intl.DateTimeFormat('sr-RS',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}
  catch{return value}
}

function label(action:string){
  const map:Record<string,string>={
    meta_publish_manual_review_acknowledged:'Potvrđen Meta manual review',
    meta_publish_manual_retry_queued:'Meta retry vraćen u queue',
    meta_publish_incident_dismissed:'Meta incident zatvoren',
    meta_reconnect_owner_notified:'Vlasnik obavešten za Meta reconnect',
    meta_provider_updated:'Meta provider podešavanja izmenjena',
    stripe_provider_updated:'Stripe provider podešavanja izmenjena',
    discovery_candidate_approved:'Trend kandidat odobren',
    discovery_candidate_rejected:'Trend kandidat preskočen',
    discovery_candidate_reset:'Trend kandidat vraćen na čekanje',
  }
  return map[action]||action.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())
}

function group(action:string):Exclude<Filter,'all'>{
  if(action.startsWith('meta_publish_')||action.startsWith('meta_reconnect_'))return 'meta'
  if(action.includes('provider'))return 'providers'
  if(action.startsWith('discovery_')||action.startsWith('trend_'))return 'trend'
  return 'sales'
}

function detail(row:AuditRow){
  const d=row.details||{}
  const parts:string[]=[]
  if(typeof d.restaurant_name==='string')parts.push(d.restaurant_name)
  else if(typeof d.restaurant_id==='string')parts.push('restoran '+d.restaurant_id.slice(0,8))
  if(typeof d.platform==='string')parts.push(d.platform.toUpperCase())
  if(typeof d.provider==='string')parts.push(d.provider)
  if(typeof d.query==='string')parts.push('„'+d.query+'“')
  if(typeof d.order_number==='string')parts.push(d.order_number)
  if(typeof d.status==='string')parts.push(d.status)
  if(typeof d.manual_retry_count==='number')parts.push('manual retry '+d.manual_retry_count)
  return parts.join(' · ')||row.entity_type+(row.entity_id?' · '+row.entity_id.slice(0,12):'')
}

export function OwnerAuditHistory({setNotice}:{setNotice:(value:string)=>void}){
  const[rows,setRows]=useState<AuditRow[]>([])
  const[loading,setLoading]=useState(true)
  const[filter,setFilter]=useState<Filter>('all')
  const[unavailable,setUnavailable]=useState(false)

  useEffect(()=>{void load()},[])

  async function load(){
    setLoading(true)
    setUnavailable(false)
    const{data,error}=await supabase.rpc('admin_owner_audit_feed',{p_limit:100})
    if(error){
      setRows([])
      setUnavailable(true)
      setNotice('Audit History RPC još nije dostupan na production bazi.')
    }else setRows((data||[]) as AuditRow[])
    setLoading(false)
  }

  const visible=useMemo(()=>filter==='all'?rows:rows.filter(row=>group(row.action)===filter),[rows,filter])
  const risky=rows.filter(row=>row.action.includes('retry')||row.action.includes('incident')||row.action.includes('manual_review')).length

  return <section className="owner-audit-history">
    <header className="audit-history-hero">
      <div><span><History size={21}/></span><div><p>OWNER · ACTION HISTORY</p><h2>Audit trag svih važnih OWNER odluka.</h2><small>Read-only pregled. Retry, manual review, reconnect, provider i trend odluke ostaju vidljive sa vremenom i tehničkim kontekstom.</small></div></div>
      <div className="audit-history-head-actions"><b>{rows.length} događaja</b><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/>{loading?'Učitavam…':'Osveži'}</button></div>
    </header>

    <div className="audit-history-stats">
      <article><ShieldCheck size={16}/><div><strong>{rows.length}</strong><span>učitanih audit događaja</span></div></article>
      <article><AlertTriangle size={16}/><div><strong>{risky}</strong><span>retry / incident / review odluka</span></div></article>
      <article><CheckCircle2 size={16}/><div><strong>READ-ONLY</strong><span>ovaj ekran ništa ne menja</span></div></article>
    </div>

    <div className="audit-history-filters">
      {([['all','Sve'],['meta','Meta incidenti'],['providers','Provideri'],['trend','Trend AI'],['sales','Prodaja / ostalo']] as const).map(([id,text])=><button className={filter===id?'active':''} key={id} onClick={()=>setFilter(id)}>{text}</button>)}
    </div>

    {unavailable?<div className="audit-history-unavailable"><AlertTriangle size={18}/><div><strong>Audit feed još nije primenjen na production bazi.</strong><span>UI je spreman i bezbedan; potrebno je samo primeniti verzionisanu Supabase migraciju na Restorapp projekat.</span></div></div>:
    <div className="audit-history-list">{visible.length?visible.map(row=><article key={row.id}>
      <span className={'audit-dot '+group(row.action)}/>
      <div className="audit-history-copy"><div><strong>{label(row.action)}</strong><small>{when(row.created_at)}</small></div><p>{detail(row)}</p><span>{row.entity_type}{row.actor_user_id?' · OWNER '+row.actor_user_id.slice(0,8):' · sistem'}</span></div>
    </article>):<div className="audit-history-empty">Nema događaja za izabrani filter.</div>}</div>}
  </section>
}
