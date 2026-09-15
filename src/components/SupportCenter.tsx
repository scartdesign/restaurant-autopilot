import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Headphones, LifeBuoy, Send, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'

type Ticket={id:string;subject:string;category:string;priority:string;message:string;status:'open'|'in_progress'|'resolved';admin_note:string|null;created_at:string;updated_at:string}
const categories=[['creative','Creative AI / dizajn'],['publishing','Objave / Publish'],['billing','Plaćanje / licenca'],['account','Nalog / pristup'],['bug','Greška u programu'],['other','Ostalo']]

export function SupportCenter({restaurant,setNotice}:{restaurant:Restaurant;setNotice:(v:string)=>void}){
  const[tickets,setTickets]=useState<Ticket[]>([])
  const[form,setForm]=useState({subject:'',category:'creative',priority:'normal',message:''})
  const[working,setWorking]=useState(false)

  useEffect(()=>{void load()},[])
  async function load(){const{data,error}=await supabase.from('support_tickets').select('*').order('created_at',{ascending:false});if(error)setNotice(error.message);else setTickets((data||[]) as Ticket[])}
  async function submit(e:FormEvent){e.preventDefault();if(form.subject.trim().length<3||form.message.trim().length<5){setNotice('Upiši naslov i malo detaljniji opis problema.');return}setWorking(true);const{data:user}=await supabase.auth.getUser();if(!user.user){setNotice('Sesija je istekla. Prijavi se ponovo.');setWorking(false);return}const{data:ticket,error}=await supabase.from('support_tickets').insert({user_id:user.user.id,restaurant_id:restaurant.id,subject:form.subject.trim(),category:form.category,priority:form.priority,message:form.message.trim()}).select('id').single();if(error)setNotice(error.message);else{if(ticket?.id)await supabase.functions.invoke('email-dispatch',{body:{action:'send_support_ticket',ticketId:ticket.id}}).catch(()=>null);setForm({subject:'',category:'creative',priority:'normal',message:''});setNotice('Zahtev je poslat podršci. Status pratiš ovde.');await load()}setWorking(false)}
  const open=useMemo(()=>tickets.filter(t=>t.status!=='resolved').length,[tickets])

  return <div className="support-page">
    <section className="support-hero"><div><span className="creative-kicker"><LifeBuoy size={16}/> PODRŠKA</span><h1>Pomoć bez traženja po porukama.</h1><p>Klijent prijavljuje problem direktno iz programa, a OWNER ga vidi u svom Support Inbox-u.</p></div><div className="support-stat"><strong>{open}</strong><span>aktivnih zahteva</span></div></section>
    <div className="support-layout">
      <form className="support-form panel" onSubmit={submit}><div className="admin-panel-head"><div><p className="eyebrow">NOVI ZAHTEV</p><h2>Pošalji podršci</h2></div><Headphones size={22}/></div>
        <label>Naslov<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Npr. AI slika se ne generiše"/></label>
        <div className="support-form-grid"><label>Kategorija<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Prioritet<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Nizak</option><option value="normal">Normalan</option><option value="high">Visok</option></select></label></div>
        <label>Opis<textarea rows={7} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Napiši šta si radio, šta si očekivao i šta se desilo."/></label>
        <button className="primary full" disabled={working}><Send size={16}/>{working?'Šaljem…':'Pošalji zahtev'}</button>
      </form>
      <section className="support-list panel"><div className="admin-panel-head"><div><p className="eyebrow">MOJI ZAHTEVI</p><h2>Istorija podrške</h2></div><Wrench size={22}/></div>
        {tickets.length?tickets.map(t=><article className={`support-ticket ${t.status}`} key={t.id}><div className="support-ticket-head"><div><span>{label(t.category)} · {t.priority}</span><strong>{t.subject}</strong></div><Status status={t.status}/></div><p>{t.message}</p>{t.admin_note&&<div className="support-reply"><b>Odgovor podrške</b><span>{t.admin_note}</span></div>}<small>{new Date(t.created_at).toLocaleString('sr-RS')}</small></article>):<div className="admin-empty">Još nema zahteva za podršku.</div>}
      </section>
    </div>
  </div>
}

function Status({status}:{status:Ticket['status']}){return <span className={`support-status ${status}`}>{status==='resolved'?<CheckCircle2 size={13}/>:<Clock3 size={13}/>} {status==='open'?'otvoren':status==='in_progress'?'u radu':'rešen'}</span>}
function label(v:string){return categories.find(([x])=>x===v)?.[1]||v}
