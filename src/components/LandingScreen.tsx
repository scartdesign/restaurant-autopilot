import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, Camera, Check, ImagePlus, Palette, Play, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { SalesPlan } from '../types'

const HERO='https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1800&q=90'
const FOOD='https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1000&q=88'

export function LandingScreen({onAuth,onDemo}:{onAuth:()=>void;onDemo:()=>void}){
  const[plans,setPlans]=useState<SalesPlan[]>([])
  const[interval,setInterval]=useState<'monthly'|'yearly'>('monthly')
  useEffect(()=>{void load()},[])
  async function load(){const{data}=await supabase.from('sales_plans').select('*').eq('active',true).eq('public',true).order('sort_order');setPlans((data||[]) as SalesPlan[])}
  const visible=useMemo(()=>plans.filter(p=>p.billing_interval===interval),[plans,interval])
  function choosePlan(plan:SalesPlan){localStorage.setItem('restorapp-intended-plan',plan.code);onAuth()}
  return <div className="public-landing">
    <header className="landing-nav"><div className="landing-brand"><img src="./restorapp-logo.webp" alt="Restorapp" /></div><nav><a href="#kako-radi">Kako radi</a><a href="#paketi">Paketi</a><button className="secondary" onClick={onDemo}><Play size={15}/> Demo</button><button className="primary" onClick={onAuth}>Prijava / Registracija</button></nav></header>

    <main>
      <section className="landing-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(7,12,9,.97),rgba(7,12,9,.78) 48%,rgba(7,12,9,.18)),url(${HERO})`}}>
        <div className="landing-hero-copy"><span className="landing-kicker"><Sparkles size={15}/> AI MARKETING ZA RESTORANE</span><h1>Od menija do gotove reklame.<br/><em>Bez praznog hoda.</em></h1><p>Restorapp predlaže šta da reklamiraš, pravi tekst, AI food fotografiju ako je nemaš, uklapa logo i boje, zakazuje termin i priprema objavu za Instagram i Facebook.</p><div className="landing-hero-actions"><button className="landing-primary" onClick={onAuth}>Pokreni Autopilot <ArrowRight size={18}/></button><button className="landing-ghost" onClick={onDemo}><Play size={17}/> Pogledaj demo</button></div><div className="landing-trust"><span><ShieldCheck size={15}/> Tvoj Brand Kit</span><span><CalendarClock size={15}/> Datum i vreme</span><span><WandSparkles size={15}/> AI Copy + Food Image</span></div></div>
        <div className="landing-product-shot"><div className="landing-shot-top"><span>Creative AI</span><b>94/100</b></div><div className="landing-food-card" style={{backgroundImage:`linear-gradient(180deg,transparent,rgba(0,0,0,.72)),url(${FOOD})`}}><span>TONIGHT</span><strong>Pasta koja prodaje večeru.</strong><small>18:30 · Instagram Feed + Story</small></div><div className="landing-shot-actions"><span>Logo ✓</span><span>Boje ✓</span><span>CTA ✓</span></div></div>
      </section>

      <section id="kako-radi" className="landing-section"><div className="landing-section-head"><span className="eyebrow">KAKO RADI</span><h2>Restoran unese osnovu. Autopilot radi marketing.</h2><p>Ne moraš da budeš dizajner, copywriter ili social media manager.</p></div><div className="landing-steps">
        <article><span>01</span><Palette size={25}/><h3>Ubaci brend</h3><p>Logo, boje, grad, cilj, stil komunikacije i mreže.</p></article>
        <article><span>02</span><Camera size={25}/><h3>Dodaj meni</h3><p>Jela, cene i fotografije. Ako slike nema, AI može da napravi tri varijante.</p></article>
        <article><span>03</span><Sparkles size={25}/><h3>Dobij predlog</h3><p>AI bira šta ima smisla reklamirati, CTA, format i termin.</p></article>
        <article><span>04</span><ImagePlus size={25}/><h3>Objava je spremna</h3><p>Feed, Story, promo vizual, copy, discovery i kalendar.</p></article>
      </div></section>

      <section className="landing-dark-band"><div><span className="eyebrow">CREATIVE AUTOPILOT</span><h2>Nemaš sliku hrane? Nije blokada.</h2><p>Generiši realistične food fotografije, izaberi najbolju od tri varijante i odmah je koristi u kampanji.</p></div><div className="landing-mini-features"><span><Check/> Realistična hrana</span><span><Check/> Brand boje i logo</span><span><Check/> Feed + Story</span><span><Check/> AI prodajni tekst</span></div></section>

      <section id="paketi" className="landing-section landing-pricing"><div className="landing-section-head"><span className="eyebrow">PAKETI</span><h2>Počni jednostavno. Rasti kad ti treba više.</h2></div><div className="landing-toggle"><button className={interval==='monthly'?'active':''} onClick={()=>setInterval('monthly')}>Mesečno</button><button className={interval==='yearly'?'active':''} onClick={()=>setInterval('yearly')}>Godišnje</button></div><div className="landing-plan-grid">
        {visible.length?visible.map((p,index)=><article key={p.id} className={`landing-plan ${index===1?'featured':''}`}><span>{p.name}</span>{Number(p.trial_days||0)>0&&<em className="landing-trial-badge">{p.trial_days} dana probno</em>}<strong>{Number(p.price).toLocaleString('sr-RS')}<small> {p.currency}</small></strong><p>{p.description||'Restorapp paket'}</p><div><i><Check/> {p.max_restaurants} {p.max_restaurants===1?'restoran':'restorana'}</i><i><Check/> {p.monthly_generation_limit||'∞'} objava mesečno</i><i><Check/> Brand Kit + Visual Studio</i><i><Check/> AI preporuke i raspored</i></div><button className={index===1?'primary':'secondary'} onClick={()=>choosePlan(p)}>Izaberi {p.name}</button></article>):<div className="landing-plans-loading">Učitavam aktuelne pakete…</div>}
      </div></section>

      <section className="landing-final-cta"><div><span className="eyebrow">RESTORAPP</span><h2>Marketing koji više ne počinje pitanjem: „Šta danas da objavim?“</h2></div><button className="landing-primary" onClick={onAuth}>Napravi nalog <ArrowRight size={18}/></button></section>
    </main>
    <footer className="landing-footer"><div className="landing-brand"><RestorappLogo surface="light" tagline /></div><span>AI-assisted marketing system for restaurants.</span><div className="landing-legal-links"><a href="?legal=terms">Uslovi</a><a href="?legal=privacy">Privatnost</a><a href="?legal=ai">AI</a><a href="?legal=refund">Refund</a></div><button onClick={onAuth}>Prijava</button></footer>
  </div>
}
