import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Mail, RefreshCw, RotateCcw, Save, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { NotificationOutbox } from '../types'

type EmailStatus={configured:boolean;provider:string;from:string|null;sender_name:string|null}
type DispatchStatus={configured:boolean;from_ready:boolean;from:string|null;sender_name:string|null;queued:number;failed:number}

export function EmailAdmin({setNotice}:{setNotice:(v:string)=>void}){
  const[provider,setProvider]=useState<EmailStatus>({configured:false,provider:'resend',from:null,sender_name:'Restaurant Autopilot'})
  const[dispatch,setDispatch]=useState<DispatchStatus>({configured:false,from_ready:false,from:null,sender_name:'Restaurant Autopilot',queued:0,failed:0})
  const[key,setKey]=useState(''),[senderName,setSenderName]=useState('Restaurant Autopilot'),[fromEmail,setFromEmail]=useState(''),[testEmail,setTestEmail]=useState('')
  const[outbox,setOutbox]=useState<NotificationOutbox[]>([]),[working,setWorking]=useState(false)

  useEffect(()=>{void load()},[])
  async function load(){
    setWorking(true)
    const [statusRes,settingsRes,outboxRes,userRes]=await Promise.all([
      supabase.rpc('admin_email_provider_status'),
      supabase.from('sales_settings').select('email_from,email_sender_name').eq('id',1).maybeSingle(),
      supabase.from('notification_outbox').select('*').order('created_at',{ascending:false}).limit(60),
      supabase.auth.getUser(),
    ])
    const err=statusRes.error||settingsRes.error||outboxRes.error
    if(err)setNotice(err.message)
    const status=(statusRes.data||{}) as EmailStatus
    setProvider({configured:Boolean(status.configured),provider:'resend',from:status.from||null,sender_name:status.sender_name||'Restaurant Autopilot'})
    setSenderName(settingsRes.data?.email_sender_name||status.sender_name||'Restaurant Autopilot')
    setFromEmail(settingsRes.data?.email_from||status.from||'')
    setTestEmail(current=>current||userRes.data.user?.email||'')
    setOutbox((outboxRes.data||[]) as NotificationOutbox[])
    await refreshDispatch(false)
    setWorking(false)
  }
  async function refreshDispatch(show=true){
    const{data,error}=await supabase.functions.invoke('email-dispatch',{body:{action:'status'}})
    if(error){if(show)setNotice(`Email status: ${error.message}`);return}
    setDispatch(data as DispatchStatus)
  }
  async function saveSender(){
    if(!fromEmail.trim()||!fromEmail.includes('@')){setNotice('Unesi validan email pošiljaoca sa verifikovanog domena.');return}
    setWorking(true)
    const{error}=await supabase.from('sales_settings').update({email_from:fromEmail.trim(),email_sender_name:senderName.trim()||'Restaurant Autopilot'}).eq('id',1)
    if(error)setNotice(error.message);else{setNotice('Email pošiljalac je sačuvan.');await refreshDispatch(false)}
    setWorking(false)
  }
  async function saveKey(){
    if(!key.trim()){setNotice('Unesi Resend API ključ.');return}
    setWorking(true)
    const{error}=await supabase.rpc('admin_set_email_provider_key',{p_key:key.trim()})
    if(error)setNotice(error.message);else{setKey('');setProvider(p=>({...p,configured:true}));setNotice('Transactional email provider je aktiviran server-side.');await refreshDispatch(false)}
    setWorking(false)
  }
  async function action(kind:'test'|'send_queued'|'retry_failed'){
    if(kind==='test'&&!testEmail.trim()){setNotice('Unesi adresu za test email.');return}
    setWorking(true)
    const{data,error}=await supabase.functions.invoke('email-dispatch',{body:{action:kind,to:kind==='test'?testEmail.trim():undefined}})
    if(error)setNotice(error.message)
    else if((data as any)?.error)setNotice((data as any).error)
    else{
      if(kind==='test')setNotice('Test email je poslat.')
      else setNotice(`Email obrada završena: poslato ${(data as any)?.sent||0}, neuspešno ${(data as any)?.failed||0}.`)
      const{o}= {o:await supabase.from('notification_outbox').select('*').order('created_at',{ascending:false}).limit(60)}
      if(!o.error)setOutbox((o.data||[]) as NotificationOutbox[])
      await refreshDispatch(false)
    }
    setWorking(false)
  }
  const recentFailed=useMemo(()=>outbox.filter(x=>x.delivery_status==='failed').slice(0,8),[outbox])
  const recentSent=useMemo(()=>outbox.filter(x=>x.delivery_status==='sent').slice(0,8),[outbox])
  const ready=provider.configured&&Boolean(fromEmail.trim())&&dispatch.configured&&dispatch.from_ready

  return <div className="email-admin-page">
    <header className="email-admin-head"><div><p className="eyebrow">OWNER · EMAIL AUTOMATIZACIJA</p><h1>Email Center</h1><p>Narudžbine, potvrde, aktivacije licenci i podsetnici mogu da idu iz istog sistema.</p></div><div className={`email-ready ${ready?'ok':''}`}>{ready?<CheckCircle2 size={18}/>:<AlertTriangle size={18}/>}<div><strong>{ready?'Sistem spreman':'Potrebno podešavanje'}</strong><small>{ready?'Resend + pošiljalac su povezani':'Dodaj provider ključ i verifikovani sender email'}</small></div></div></header>

    <section className="email-metrics"><div><span>Čeka slanje</span><strong>{dispatch.queued||outbox.filter(x=>x.delivery_status==='queued').length}</strong></div><div><span>Neuspešno</span><strong>{dispatch.failed||recentFailed.length}</strong></div><div><span>Poslato u prikazu</span><strong>{recentSent.length}</strong></div><div><span>Provider</span><strong>{provider.configured?'ON':'OFF'}</strong></div></section>

    <div className="email-admin-grid">
      <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">1 · PROVIDER</p><h2>Resend API</h2></div><ShieldCheck size={21}/></div><div className={`email-provider-state ${provider.configured?'ready':''}`}><Mail size={21}/><div><strong>{provider.configured?'API ključ je bezbedno sačuvan':'API ključ nije podešen'}</strong><small>Ključ ide direktno u Supabase Vault i ne vraća se browseru.</small></div></div><label>Resend API ključ<input type="password" autoComplete="new-password" value={key} onChange={e=>setKey(e.target.value)} placeholder={provider.configured?'re_… samo ako menjaš postojeći ključ':'re_…'}/></label><button className="secondary full" onClick={saveKey} disabled={working||!key.trim()}><Save size={15}/>{provider.configured?'Promeni provider ključ':'Aktiviraj provider'}</button></section>

      <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">2 · POŠILJALAC</p><h2>Ime i email</h2></div><Mail size={21}/></div><label>Ime pošiljaoca<input value={senderName} onChange={e=>setSenderName(e.target.value)} placeholder="Restaurant Autopilot"/></label><label>Email pošiljaoca<input type="email" value={fromEmail} onChange={e=>setFromEmail(e.target.value)} placeholder="noreply@tvojdomen.com"/></label><p className="email-hint">Email domen mora prethodno biti verifikovan kod email provajdera.</p><button className="primary full" onClick={saveSender} disabled={working}><Save size={15}/> Sačuvaj pošiljaoca</button></section>

      <section className="admin-panel email-test-card"><div className="admin-panel-head"><div><p className="eyebrow">3 · PROVERA</p><h2>Pošalji test</h2></div><Send size={21}/></div><label>Test email<input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="tvoj@email.com"/></label><button className="secondary full" onClick={()=>void action('test')} disabled={working||!ready}><Send size={15}/> Pošalji test email</button><div className="email-run-actions"><button className="primary" onClick={()=>void action('send_queued')} disabled={working||!ready}><Send size={15}/> Pošalji čekajuće ({dispatch.queued})</button><button className="secondary" onClick={()=>void action('retry_failed')} disabled={working||!ready||dispatch.failed===0}><RotateCcw size={15}/> Ponovi neuspele</button><button className="secondary" onClick={()=>void load()} disabled={working}><RefreshCw size={15}/> Osveži</button></div></section>
    </div>

    <div className="email-log-grid"><section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">POSLEDNJE POSLATO</p><h2>Email istorija</h2></div></div><div className="email-log-list">{recentSent.length?recentSent.map(x=><div className="email-log-row sent" key={x.id}><CheckCircle2 size={16}/><div><strong>{x.subject}</strong><span>{x.recipient_email||'—'} · {new Date(x.sent_at||x.created_at).toLocaleString('sr-RS')}</span></div></div>):<div className="admin-empty">Još nema poslatih emailova.</div>}</div></section><section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">NEUSPEŠNO</p><h2>Za proveru</h2></div></div><div className="email-log-list">{recentFailed.length?recentFailed.map(x=><div className="email-log-row failed" key={x.id}><AlertTriangle size={16}/><div><strong>{x.subject}</strong><span>{x.recipient_email||'—'} · pokušaj {(x.retry_count||0)}</span><small>{x.error_message||'Provider nije prihvatio poruku.'}</small></div></div>):<div className="admin-empty">Nema neuspelih emailova.</div>}</div></section></div>
  </div>
}
