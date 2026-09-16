import { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, Circle, Clock3, Image as ImageIcon, Instagram, LayoutDashboard, Megaphone, Palette, RefreshCw, Send, Settings, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Post, Restaurant } from '../types'

type LaunchTab = 'dashboard'|'creative'|'studio'|'brand'|'publish'|'insights'|'menu'|'promotions'|'settings'|'billing'

export function LaunchCenter({restaurant,menuItems,posts,onNavigate}:{restaurant:Restaurant;menuItems:MenuItem[];posts:Post[];onNavigate:(tab:LaunchTab)=>void}){
  const[performanceCount,setPerformanceCount]=useState(0)
  const[preflight,setPreflight]=useState<any>(null)
  const[preflightLoading,setPreflightLoading]=useState(false)
  useEffect(()=>{void supabase.from('post_performance').select('id',{count:'exact',head:true}).eq('restaurant_id',restaurant.id).then(({count})=>setPerformanceCount(count||0));void runPreflight(false)},[restaurant.id,posts.length,menuItems.length])
  async function runPreflight(recordActivity=false){
    setPreflightLoading(true)
    const{data,error}=await supabase.functions.invoke('content-engine',{body:{action:'preflight',restaurantId:restaurant.id,recordActivity}})
    if(!error&&!data?.error)setPreflight(data)
    setPreflightLoading(false)
  }
  function preflightTarget(){
    const key=preflight?.blockers?.[0]?.key||preflight?.warnings?.[0]?.key
    if(key==='package'||key==='quota')return 'billing' as LaunchTab
    if(key==='menu'||key==='diversity'||key==='hero'||key==='photos')return 'menu' as LaunchTab
    return 'settings' as LaunchTab
  }
  const activeItems=menuItems.filter(i=>i.is_active)
  const photos=activeItems.filter(i=>i.image_url).length
  const photoCoverage=activeItems.length?Math.round((photos/activeItems.length)*100):0
  const heroDish=activeItems.find(i=>(i.marketing_priority||0)>=3)
  const future=posts.filter(p=>p.scheduled_for&&new Date(p.scheduled_for).getTime()>Date.now()).length
  const approved=posts.filter(p=>p.status==='approved'||p.status==='published').length
  const hoursConfigured=Boolean(restaurant.opening_hours&&Object.keys(restaurant.opening_hours).length>=7)
  const tasks=[
    {id:'brand',title:'Postavi logo i boje',detail:'Brand Kit definiše izgled svih objava.',done:Boolean(restaurant.logo_url&&restaurant.primary_color&&restaurant.secondary_color),tab:'brand' as LaunchTab,icon:Palette},
    {id:'profile',title:'Dopuni restoran',detail:'Grad, cilj, telefon i društvene mreže daju bolji AI kontekst.',done:Boolean(restaurant.city&&(restaurant.instagram||restaurant.facebook||restaurant.phone||restaurant.reservation_url)),tab:'settings' as LaunchTab,icon:Settings},
    {id:'hours',title:'Podesi radno vreme',detail:'Autopilot tada ne predlaže dolazak kada je restoran zatvoren.',done:hoursConfigured,tab:'settings' as LaunchTab,icon:Clock3},
    {id:'autoweek',title:'Uključi Autopilot nedelju',detail:restaurant.weekly_autopilot_enabled?'Nova nedelja se priprema automatski kada plan još ne postoji.':'Uključi automatsku pripremu nove nedelje bez ručnog klika.',done:Boolean(restaurant.weekly_autopilot_enabled),tab:'settings' as LaunchTab,icon:Sparkles},
    {id:'menu',title:'Dodaj najmanje 3 jela',detail:'Više jela daje bolji nedeljni plan i kampanje.',done:activeItems.length>=3,tab:'menu' as LaunchTab,icon:UtensilsCrossed},
    {id:'priority',title:'Izaberi HERO jelo',detail:heroDish?`${heroDish.name} vodi kampanje i premium preview.`:'Označi najvažnije jelo prioritetom HERO da Campaign Builder zna šta je glavni fokus.',done:Boolean(heroDish),tab:'menu' as LaunchTab,icon:Megaphone},
    {id:'photos',title:'Pokrij meni fotografijama',detail:photoCoverage>=70?`${photoCoverage}% menija ima fotografiju.`:`Trenutno ${photoCoverage}%. Dodaj realne ili AI slike hrane.`,done:photoCoverage>=70,tab:'creative' as LaunchTab,icon:ImageIcon},
    {id:'content',title:'Napravi prvi sadržaj',detail:'Autopilot treba bar 3 predloga za radni plan.',done:posts.length>=3,tab:'dashboard' as LaunchTab,icon:Sparkles},
    {id:'schedule',title:'Odobri i zakaži objave',detail:future?`${future} budućih termina · ${approved} odobreno.`:'Još nema budućih termina.',done:future>=1&&approved>=1,tab:'publish' as LaunchTab,icon:Send},
    {id:'results',title:'Zatvori performance loop',detail:performanceCount>=3?`${performanceCount} objave imaju stvarne rezultate.`:`Unesi rezultate za još ${Math.max(0,3-performanceCount)} objave da AI počne da uči iz tvog restorana.`,done:performanceCount>=3,tab:'insights' as LaunchTab,icon:BarChart3},
  ]
  const completed=tasks.filter(t=>t.done).length
  const score=Math.round((completed/tasks.length)*100)
  const next=tasks.find(t=>!t.done)

  return <div className="launch-center">
    <section className="launch-hero">
      <div><span className="creative-kicker"><Sparkles size={16}/> LAUNCH CENTER</span><h1>{score===100?'Restoran je spreman za Autopilot.':'Dovedi restoran do 100% spremnosti.'}</h1><p>Jedan ekran pokazuje šta još nedostaje da klijent može samostalno da koristi sistem bez tvoje pomoći.</p>
      <div className="launch-actions">{next?<button className="primary" onClick={()=>onNavigate(next.tab)}>Nastavi: {next.title}</button>:<button className="primary" onClick={()=>onNavigate('creative')}><Megaphone size={16}/> Napravi novu kampanju</button>}<button className="secondary" onClick={()=>onNavigate('dashboard')}><LayoutDashboard size={16}/> Otvori sadržaj</button></div></div>
      <div className="launch-score"><strong>{score}<small>%</small></strong><span>{completed}/{tasks.length} koraka završeno</span><div className="launch-ring"><i style={{'--score':score} as React.CSSProperties}/></div></div>
    </section>

    <section className={'launch-preflight '+(preflight?.status||'loading')}>
      <div className="launch-preflight-icon">{preflight?.ready||preflight?.existing?<ShieldCheck size={22}/>:<AlertTriangle size={22}/>}</div>
      <div><span>AUTO WEEK PREFLIGHT</span><strong>{preflightLoading&&!preflight?'Proveravam spremnost…':preflight?.existing?'Plan za ciljnu nedelju već postoji':preflight?.ready?'Server potvrđuje da je Autopilot spreman':'Autopilot trenutno ima blocker'}</strong><small>{preflight?.week_start?('Nedelja '+preflight.week_start+(preflight.next_week?' · sledeća':'')): 'Paket, meni, radno vreme, quota i postojeći plan se proveravaju na serveru.'}</small></div>
      <div className="launch-preflight-actions"><button className="secondary" onClick={()=>void runPreflight(true)} disabled={preflightLoading}><RefreshCw size={14}/>{preflightLoading?'Proveravam':'Ponovo proveri'}</button>{preflight&&!preflight.ready&&!preflight.existing&&<button className="primary" onClick={()=>onNavigate(preflightTarget())}>Sredi blocker</button>}</div>
    </section>

    <section className="launch-grid">
      {tasks.map(({id,title,detail,done,tab,icon:Icon},index)=><button key={id} className={`launch-task ${done?'done':''}`} onClick={()=>onNavigate(tab)}>
        <div className="launch-task-status">{done?<CheckCircle2 size={21}/>:<Circle size={21}/>}</div>
        <div className="launch-task-copy"><span>0{index+1}</span><strong>{title}</strong><p>{detail}</p></div>
        <Icon size={20}/>
      </button>)}
    </section>

    <section className="launch-bottom-grid">
      <article><span className="eyebrow">BRAND</span><strong>{restaurant.logo_url?'Logo spreman':'Logo nedostaje'}</strong><small>{restaurant.primary_color||'#17211b'} · {restaurant.secondary_color||'#b9df72'}</small><button onClick={()=>onNavigate('brand')}><Palette size={15}/> Otvori Brand Kit</button></article>
      <article><span className="eyebrow">MENI</span><strong>{activeItems.length} aktivnih jela</strong><small>{photos} sa fotografijom · {photoCoverage}% coverage</small><button onClick={()=>onNavigate('menu')}><UtensilsCrossed size={15}/> Uredi meni</button></article>
      <article><span className="eyebrow">SOCIAL</span><strong>{restaurant.instagram||restaurant.facebook?'Mreže povezane u profilu':'Dodaj mreže'}</strong><small>{restaurant.instagram?'Instagram ':''}{restaurant.facebook?'Facebook':''}</small><button onClick={()=>onNavigate('settings')}><Instagram size={15}/> Podešavanja</button></article>
      <article><span className="eyebrow">AUTOPILOT</span><strong>{restaurant.weekly_autopilot_enabled?'Auto week uključen':'Ručna nedelja'}</strong><small>{restaurant.weekly_autopilot_enabled?'Novi plan se priprema automatski':'Uključi u Podešavanjima'}</small><button onClick={()=>onNavigate('settings')}><Sparkles size={15}/> Automatizacija</button></article>
      <article><span className="eyebrow">PUBLISH</span><strong>{future} budućih objava</strong><small>{approved} odobreno / objavljeno</small><button onClick={()=>onNavigate('publish')}><Send size={15}/> Publish Center</button></article>
    </section>
  </div>
}
