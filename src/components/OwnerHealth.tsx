import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, BadgeEuro, CheckCircle2, CreditCard, Image, Mail, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

type State={
  ai:boolean
  email:boolean
  emailFrom:boolean
  bank:boolean
  legal:boolean
  salesOpen:boolean
  maintenance:boolean
  aiImages:boolean
  card:boolean
  paypal:boolean
  meta:boolean
  metaConnections:number
  publishQueued:number
  publishFailed:number
  activeCustomers:number
  pendingOrders:number
  openSupport:number
  failedEmails:number
  version:string
}

const initial:State={ai:false,email:false,emailFrom:false,bank:false,legal:false,salesOpen:true,maintenance:false,aiImages:true,card:false,paypal:false,meta:false,metaConnections:0,publishQueued:0,publishFailed:0,activeCustomers:0,pendingOrders:0,openSupport:0,failedEmails:0,version:'1.0'}

export function OwnerHealth({setNotice}:{setNotice:(v:string)=>void}){
  const[state,setState]=useState<State>(initial)
  const[working,setWorking]=useState(false)
  useEffect(()=>{void load()},[])

  async function load(){
    setWorking(true)
    const [ai,email,meta,settings,controls,subs,orders,support,failed,metaConnections,publishQueued,publishFailed]=await Promise.all([
      supabase.rpc('admin_ai_provider_status'),
      supabase.rpc('admin_email_provider_status'),
      supabase.rpc('admin_meta_provider_status'),
      supabase.from('sales_settings').select('legal_name,tax_id,bank_account,email_from,allow_card,allow_paypal,terms_url,privacy_url').eq('id',1).maybeSingle(),
      supabase.from('app_controls').select('app_version,maintenance_mode,sales_open,ai_images_enabled').eq('id',1).maybeSingle(),
      supabase.from('customer_subscriptions').select('id',{count:'exact',head:true}).in('status',['active','trialing']),
      supabase.from('sales_orders').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('support_tickets').select('id',{count:'exact',head:true}).neq('status','resolved'),
      supabase.from('notification_outbox').select('id',{count:'exact',head:true}).eq('delivery_status','failed'),
      supabase.from('social_connections').select('id',{count:'exact',head:true}).eq('status','connected'),
      supabase.from('social_publish_jobs').select('id',{count:'exact',head:true}).eq('status','queued'),
      supabase.from('social_publish_jobs').select('id',{count:'exact',head:true}).eq('status','failed'),
    ])
    const err=ai.error||email.error||meta.error||settings.error||controls.error||subs.error||orders.error||support.error||failed.error||metaConnections.error||publishQueued.error||publishFailed.error
    if(err)setNotice(err.message)
    const a=(ai.data||{}) as any, e=(email.data||{}) as any, m=(meta.data||{}) as any, s=settings.data as any, c=controls.data as any
    setState({
      ai:Boolean(a.configured),
      email:Boolean(e.configured),
      emailFrom:Boolean(s?.email_from),
      bank:Boolean(s?.bank_account),
      legal:Boolean(s?.legal_name&&s?.tax_id&&s?.terms_url&&s?.privacy_url),
      salesOpen:c?.sales_open!==false,
      maintenance:Boolean(c?.maintenance_mode),
      aiImages:c?.ai_images_enabled!==false,
      card:Boolean(s?.allow_card),
      paypal:Boolean(s?.allow_paypal),
      meta:Boolean(m.configured),
      metaConnections:metaConnections.count||0,
      publishQueued:publishQueued.count||0,
      publishFailed:publishFailed.count||0,
      activeCustomers:subs.count||0,
      pendingOrders:orders.count||0,
      openSupport:support.count||0,
      failedEmails:failed.count||0,
      version:c?.app_version||'1.0',
    })
    setWorking(false)
  }

  const checks=useMemo(()=>[
    {label:'AI provider',ok:state.ai,detail:state.ai?'OpenAI provider je podešen':'Dodaj OpenAI ključ u Creative AI OWNER delu',icon:Image},
    {label:'Transactional email',ok:state.email&&state.emailFrom,detail:state.email&&state.emailFrom?'Provider + sender su spremni':'Podesi Resend i verifikovani sender u Email Centeru',icon:Mail},
    {label:'Firma / naplata',ok:state.legal&&state.bank,detail:state.legal&&state.bank?'Pravni, bankarski i legal linkovi su uneti':'Dopuni pravni naziv, PIB, račun, uslove i privatnost',icon:BadgeEuro},
    {label:'Prodaja',ok:state.salesOpen,detail:state.salesOpen?'Kupovina paketa je otvorena':'Prodaja je trenutno zatvorena',icon:CreditCard},
    {label:'AI slike',ok:state.aiImages,detail:state.aiImages?'AI slike su dozvoljene sistemski':'AI slike su globalno ugašene',icon:Image},
    {label:'Meta publishing',ok:state.meta,detail:state.meta?`Provider spreman · ${state.metaConnections} povezanih restorana`:'Unesi Meta App ID + Secret u OWNER Controlu',icon:Send},
  ],[state])
  const score=Math.round((checks.filter(x=>x.ok).length/checks.length)*100)

  return <div className="owner-health-page">
    <header className="email-admin-head"><div><p className="eyebrow">OWNER · RELEASE READINESS</p><h1>System Health</h1><p>Jedan ekran za proveru da li je proizvod spreman za stvarne kupce i naplatu.</p></div><div className={`health-score ${score===100?'ready':''}`}><strong>{score}%</strong><span>launch readiness · v{state.version}</span></div></header>
    <section className="email-metrics"><div><span>Aktivni kupci</span><strong>{state.activeCustomers}</strong></div><div><span>Uplate čekaju</span><strong>{state.pendingOrders}</strong></div><div><span>Support otvoren</span><strong>{state.openSupport}</strong></div><div><span>Email greške</span><strong>{state.failedEmails}</strong></div></section>
    <div className="health-grid">{checks.map(({label,ok,detail,icon:Icon})=><article className={`health-card ${ok?'ok':'warn'}`} key={label}><div>{ok?<CheckCircle2 size={20}/>:<AlertTriangle size={20}/>}</div><section><span>{label}</span><strong>{ok?'SPREMNO':'AKCIJA POTREBNA'}</strong><p>{detail}</p></section><Icon size={21}/></article>)}</div>
    <section className="admin-panel health-external"><div className="admin-panel-head"><div><p className="eyebrow">SPOLJNE INTEGRACIJE</p><h2>Šta još zavisi od naloga provajdera</h2></div><Activity size={22}/></div>
      <div className="health-external-grid"><div className={state.meta?'external-ready':''}><Send size={18}/><strong>Meta auto-publish</strong><span>{state.meta?`Provider spreman · ${state.metaConnections} connected · ${state.publishQueued} queued · ${state.publishFailed} failed`:'Meta App nije konfigurisan. OAuth i publishing queue su spremni čim se unesu kredencijali.'}</span></div><div><CreditCard size={18}/><strong>Kartično plaćanje</strong><span>{state.card?'Uključeno u prodajnim podešavanjima.':'Nije uključeno — potreban je konkretan payment gateway.'}</span></div><div><BadgeEuro size={18}/><strong>PayPal</strong><span>{state.paypal?'PayPal metoda je uključena.':'PayPal trenutno nije uključen.'}</span></div><div><ShieldCheck size={18}/><strong>Maintenance</strong><span>{state.maintenance?'Aplikacija je u maintenance modu.':'Aplikacija je dostupna kupcima.'}</span></div></div>
    </section>
    <button className="secondary health-refresh" onClick={()=>void load()} disabled={working}><RefreshCw size={15}/>{working?'Proveravam…':'Ponovo proveri sistem'}</button>
  </div>
}
