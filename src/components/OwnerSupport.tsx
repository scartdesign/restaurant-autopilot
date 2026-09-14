import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Headphones, RefreshCw, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Ticket={id:string;user_id:string;restaurant_id:string|null;subject:string;category:string;priority:string;message:string;status:'open'|'in_progress'|'resolved';admin_note:string|null;created_at:string;restaurants?:{name?:string|null}|null}

export function OwnerSupport({setNotice}:{setNotice:(v:string)=>void}){
  const[tickets,setTickets]=useState<Ticket[]>([])
  const[selected,setSelected]=useState<Ticket|null>(null)
  const[note,setNote]=useState('')
  const[status,setStatus]=useState<Ticket['status']>('in_progress')
  const[working,setWorking]=useState(false)
  useEffect(()=>{void load()},[])
  async function load(){setWorking(true);const{data,error}=await supabase.from('support_tickets').select('*, restaurants(name)').order('created_at',{ascending:false});if(error)setNotice(error.message);else setTickets((data||[]) as Ticket[]);setWorking(false)}
  function open(t:Ticket){setSelected(t);setNote(t.admin_note||'');setStatus(t.status==='resolved'?'resolved':'in_progress')}
  async function save(){if(!selected)return;setWorking(true);const{error}=await supabase.rpc('admin_update_support_ticket',{p_ticket_id:selected.id,p_status:status,p_admin_note:note.trim()||null});if(error)setNotice(error.message);else{setNotice('Support zahtev je ažuriran. Kupac dobija odgovor u aplikaciji.');setSelected(null);await load()}setWorking(false)}
  const counts=useMemo(()=>({open:tickets.filter(t=>t.status==='open').length,progress:tickets.filter(t=>t.status==='in_progress').length,resolved:tickets.filter(t=>t.status==='resolved').length}),[tickets])

  return <div className="owner-support-page"><header className="email-admin-head"><div><p className="eyebrow">OWNER · CUSTOMER CARE</p><h1>Support Inbox</h1><p>Svi zahtevi kupaca na jednom mestu, sa odgovorom i statusom.</p></div><button className="secondary" onClick={()=>void load()} disabled={working}><RefreshCw size={15}/> Osveži</button></header>
    <section className="email-metrics"><div><span>Otvoreno</span><strong>{counts.open}</strong></div><div><span>U radu</span><strong>{counts.progress}</strong></div><div><span>Rešeno</span><strong>{counts.resolved}</strong></div><div><span>Ukupno</span><strong>{tickets.length}</strong></div></section>
    <section className="admin-panel support-admin-list">{tickets.length?tickets.map(t=><button key={t.id} className={`owner-support-row ${t.status}`} onClick={()=>open(t)}><div className="owner-support-icon"><Headphones size={18}/></div><div><span>{t.restaurants?.name||'Restoran'} · {t.user_id.slice(0,8)}</span><strong>{t.subject}</strong><small>{t.category} · {t.priority} · {new Date(t.created_at).toLocaleString('sr-RS')}</small></div><span className={`support-status ${t.status}`}>{t.status==='resolved'?<CheckCircle2 size={13}/>:<Clock3 size={13}/>} {t.status}</span></button>):<div className="admin-empty">Nema support zahteva.</div>}</section>
    {selected&&<div className="modal-backdrop" onMouseDown={()=>setSelected(null)}><div className="modal-card" onMouseDown={e=>e.stopPropagation()}><p className="eyebrow">SUPPORT TICKET</p><h2>{selected.subject}</h2><p className="support-admin-message">{selected.message}</p><label>Status<select value={status} onChange={e=>setStatus(e.target.value as Ticket['status'])}><option value="open">Otvoren</option><option value="in_progress">U radu</option><option value="resolved">Rešen</option></select></label><label>Odgovor kupcu<textarea rows={6} value={note} onChange={e=>setNote(e.target.value)} placeholder="Napiši odgovor koji će kupac videti u aplikaciji."/></label><div className="modal-actions"><button className="secondary" onClick={()=>setSelected(null)}>Otkaži</button><button className="primary" onClick={()=>void save()} disabled={working}><Save size={15}/> Sačuvaj odgovor</button></div></div></div>}
  </div>
}
