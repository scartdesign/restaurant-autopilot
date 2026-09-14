import { Bell, CheckCheck, CheckCircle2, Clock3, Mail, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { NotificationOutbox } from '../types'

export function NotificationsCenter({setNotice}:{setNotice:(v:string)=>void}){
  const[items,setItems]=useState<NotificationOutbox[]>([])
  const[working,setWorking]=useState(false)
  useEffect(()=>{void load()},[])
  async function load(){setWorking(true);const{data,error}=await supabase.from('notification_outbox').select('*').eq('visible_in_app',true).order('created_at',{ascending:false}).limit(100);if(error)setNotice(error.message);else setItems((data||[]) as NotificationOutbox[]);setWorking(false)}
  async function markRead(id:number){const{error}=await supabase.from('notification_outbox').update({read_at:new Date().toISOString()}).eq('id',id);if(error)setNotice(error.message);else setItems(cur=>cur.map(x=>x.id===id?{...x,read_at:new Date().toISOString()}:x))}
  async function markAll(){const ids=items.filter(x=>!x.read_at).map(x=>x.id);if(!ids.length)return;const{error}=await supabase.from('notification_outbox').update({read_at:new Date().toISOString()}).in('id',ids);if(error)setNotice(error.message);else{setItems(cur=>cur.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));setNotice('Sva obaveštenja su označena kao pročitana.')}}
  const unread=useMemo(()=>items.filter(x=>!x.read_at).length,[items])
  return <div className="notifications-page">
    <header className="email-admin-head"><div><p className="eyebrow">NALOG · OBAVEŠTENJA</p><h1>Centar obaveštenja</h1><p>Uplate, aktivacije, produženja, podrška i važna sistemska obaveštenja na jednom mestu.</p></div><div className="notification-actions"><button className="secondary" onClick={()=>void load()} disabled={working}><RefreshCw size={15}/> Osveži</button><button className="primary" onClick={()=>void markAll()} disabled={!unread}><CheckCheck size={15}/> Pročitaj sve ({unread})</button></div></header>
    <section className="notification-summary"><div><Bell size={18}/><span>Nepročitano</span><strong>{unread}</strong></div><div><Mail size={18}/><span>Ukupno</span><strong>{items.length}</strong></div><div><CheckCircle2 size={18}/><span>Pročitano</span><strong>{items.length-unread}</strong></div></section>
    <section className="notification-list">{items.length?items.map(item=><article key={item.id} className={'notification-card '+(!item.read_at?'unread':'')} onClick={()=>!item.read_at&&void markRead(item.id)}><div className="notification-icon">{item.read_at?<CheckCircle2 size={18}/>:<Bell size={18}/>}</div><div><span>{kind(item.kind)}</span><strong>{item.subject}</strong><p>{item.body}</p><small><Clock3 size={12}/> {new Date(item.created_at).toLocaleString('sr-RS')}{item.delivery_status==='sent'?' · email poslat':''}</small></div>{!item.read_at&&<i/>}</article>):<div className="admin-empty">Nema obaveštenja.</div>}</section>
  </div>
}
function kind(v:string){const map:Record<string,string>={order_created:'Narudžbina',order_paid:'Uplata',trial_started:'Trial',license_activated:'Licenca',subscription_expiring:'Pretplata ističe',subscription_expired:'Pretplata',admin_note:'Poruka podrške'};return map[v]||'Sistem'}
