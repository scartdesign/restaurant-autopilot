import { useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { AlertTriangle, ArrowLeft, BarChart3, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Copy, Facebook, Hash, Image as ImageIcon, Instagram, LayoutDashboard, LayoutTemplate, MapPin, Megaphone, Menu as MenuIcon, MousePointerClick, Palette, Pencil, Plus, RefreshCw, Rocket, Save, Search, Send, Settings, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, Upload, UtensilsCrossed, X, Zap } from 'lucide-react'
import { VisualStudio } from './VisualStudio'
import { BrandKit } from './BrandKit'
import { DemoOwner } from './DemoOwner'
import { RestorappDashboardV2 } from './RestorappDashboardV2'
import { RestorappSidebarLogo } from './RestorappSidebarLogo'
import { RestaurantTemplateCanvas, type RestaurantTemplateId } from './RestaurantTemplateCanvas'
import { defaultItemSlots, defaultTextSlots, templateSlotConfig, type TemplateItemSlot } from '../template-slot-config'
import { baseFontOptions, baseFontStack, defaultBaseFont, scriptFontOptions, scriptFontStack, type BaseFontId, type ScriptFontId } from '../template-fonts'
import type { MenuItem, Post, Restaurant } from '../types'
import '../simple-content-studio.css'

type DemoTab = 'content' | 'launch' | 'studio' | 'brand' | 'publish' | 'insights' | 'menu' | 'promotions' | 'settings' | 'owner'

const food = {
  pizza: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1500&q=88',
  pasta: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=88',
  tiramisu: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=88',
  salad: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=88',
  lasagna: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=1200&q=88',
}

const demoLogo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="42" fill="#ffffff"/><circle cx="100" cy="100" r="72" fill="#173a2b"/><path d="M58 113c21-46 63-58 88-28-14 0-25 8-31 22 17-7 31-3 39 8-28 28-72 29-96-2Z" fill="#e7c35f"/><text x="100" y="78" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="700" fill="#fff">BN</text></svg>')}`

const demoPosts = [
  { type: 'FEED', day: 'pon, 14. sep', time: '18:30', title: 'Pizza Capricciosa', caption: 'Veče zaslužuje nešto posebno. Capricciosa iz peći, sa mozzarellom, šunkom i pečurkama.', status: 'approved', score: 94, image: food.pizza, ig: ['#BellaNapoli','#BeogradFood','#GdeJestiBeograd','#PizzaLovers','#ItalianFood'], fb: ['#BellaNapoli','#BeogradFood','#Pizza'], keywords: ['pizza Beograd','italijanski restoran Beograd'] },
  { type: 'STORY', day: 'uto, 15. sep', time: '11:30', title: 'Sveža Carbonara', caption: 'Kremasta, sveža i spremna za ručak. Danas biramo Carbonaru.', status: 'approved', score: 91, image: food.pasta, ig: ['#BellaNapoli','#BeogradEats','#Carbonara','#PastaLovers','#ItalianCuisine'], fb: ['#BellaNapoli','#BeogradEats','#PastaLovers'], keywords: ['carbonara Beograd','pasta Beograd'] },
  { type: 'FEED', day: 'čet, 17. sep', time: '18:30', title: 'Tiramisu', caption: 'Espresso, mascarpone i kakao. Klasik koji ne traži objašnjenje.', status: 'draft', score: 93, image: food.tiramisu, ig: ['#BellaNapoli','#BeogradFood','#Tiramisu','#DessertLovers','#ItalianFood'], fb: ['#BellaNapoli','#BeogradFood','#Tiramisu'], keywords: ['tiramisu Beograd','italijanski desert'] },
  { type: 'PROMO', day: 'sub, 19. sep', time: '17:30', title: 'Vikend pasta', caption: '20% popusta na paste u petak i subotu od 18h. Rezervišite svoj sto.', status: 'draft', score: 96, image: food.lasagna, ig: ['#BellaNapoli','#GdeJestiBeograd','#PastaLovers','#VikendBeograd'], fb: ['#BellaNapoli','#BeogradEats','#PastaLovers'], keywords: ['vikend Beograd','pasta akcija'] },
]

const demoMenuCards = [
  { name: 'Pizza Capricciosa', category: 'Pizza', price: '890 RSD', image: food.pizza },
  { name: 'Carbonara', category: 'Pasta', price: '940 RSD', image: food.pasta },
  { name: 'Tiramisu', category: 'Desert', price: '520 RSD', image: food.tiramisu },
  { name: 'Sezonska salata', category: 'Predjelo', price: '690 RSD', image: food.salad },
  { name: 'Lasagne della casa', category: 'Glavno jelo', price: '1.090 RSD', image: food.lasagna },
]

const demoRestaurant: Restaurant = {
  id: 'demo-restaurant', owner_id: 'demo', name: 'Bella Napoli', city: 'Beograd', neighborhood: 'Vračar', country: 'Serbia', timezone: 'Europe/Belgrade', phone: '+381 11 555 2026', website: 'https://example.com', instagram: '@bellanapoli', facebook: 'Bella Napoli Beograd', cuisine_type: 'Italijanska', brand_style: 'premium', primary_color: '#173a2b', secondary_color: '#e7c35f', logo_url: demoLogo, description: 'Prava italijanska priča u tvom gradu.', target_audience: 'Parovi, porodice i ljubitelji italijanske kuhinje', social_goal: 'reservations', hashtag_mode: 'smart', language: 'sr', tone: 'premium', posting_frequency: 5, reservation_url: 'https://example.com/reservations', onboarding_completed: true,
  default_logo_visible: true, default_logo_position: 'top-right', default_logo_size: 'm', default_logo_badge: 'white', default_overlay_strength: .64,
}

const demoMenu: MenuItem[] = [
  { id: 'demo-pizza', restaurant_id: 'demo-restaurant', name: 'Pizza Capricciosa', description: 'Pelat, mozzarella, šunka, pečurke i masline.', category: 'Pizza', price: 890, currency: 'RSD', image_url: food.pizza, marketing_priority: 3, is_active: true },
  { id: 'demo-carbonara', restaurant_id: 'demo-restaurant', name: 'Carbonara', description: 'Guanciale, jaje, pecorino i sveže mleven biber.', category: 'Pasta', price: 940, currency: 'RSD', image_url: food.pasta, marketing_priority: 2, is_active: true },
]

const demoVisualPosts: Post[] = [
  { id: 'demo-post', restaurant_id: 'demo-restaurant', content_plan_id: null, menu_item_id: 'demo-pizza', promotion_id: null, post_type: 'feed', scheduled_for: '2026-09-14T16:30:00.000Z', title: 'Pizza Capricciosa', caption: 'Veče zaslužuje nešto posebno. Capricciosa iz peći, sa mozzarellom, šunkom i pečurkama. Rezervišite svoj sto.', cta: 'Rezerviši sto', hashtags: ['#BellaNapoli','#BeogradFood','#GdeJestiBeograd','#PizzaLovers','#ItalianFood'], visual_brief: 'Premium feed 4:5 sa fotografijom pizze.', status: 'approved', generation_meta: { image_url: food.pizza, engine: 'smart-discovery-v3' }, platform_content: { instagram: { caption: 'Veče zaslužuje nešto posebno.', hashtags: ['#BellaNapoli','#BeogradFood','#GdeJestiBeograd','#PizzaLovers','#ItalianFood'] }, facebook: { caption: 'Capricciosa iz peći. Rezervišite svoj sto.', hashtags: ['#BellaNapoli','#BeogradFood'] } }, discovery_score: 94, seo_keywords: ['pizza Beograd','italijanski restoran Beograd'] },
]

export function DemoScreen({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<DemoTab>(() => { const value = window.location.hash.replace('#','') as DemoTab; return ['content','launch','studio','brand','publish','insights','menu','promotions','settings','owner'].includes(value) ? value : 'content' })
  const [approved, setApproved] = useState<string[]>(['Pizza Capricciosa', 'Sveža Carbonara'])
  const [toast, setToast] = useState('')
  const [demoMoreOpen,setDemoMoreOpen]=useState(false)

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2300)
  }

  return (
    <div className="app-shell demo-shell wow-demo-shell">
      <aside className="sidebar sidebar-pro">
        <div>
          <div className="brand-mark brand-mark-restorapp"><RestorappSidebarLogo /></div>
          <div className="restaurant-chip"><img className="sidebar-logo" src={demoLogo} alt="" /><div><strong>Bella Napoli</strong><small>Vračar · Beograd</small></div></div>
          <div className="autopilot-status"><span className="live-dot" /> AUTOPILOT ACTIVE · AUTO WEEK ON</div>
          <nav className="simple-primary-nav demo-simple-nav">
            <button className={tab === 'launch' ? 'nav-active' : ''} onClick={() => {setTab('launch');setDemoMoreOpen(false)}}><Rocket size={18} /> Početna</button>
            <button className={tab === 'content' ? 'nav-active' : ''} onClick={() => {setTab('content');setDemoMoreOpen(false)}}><CalendarDays size={18} /> Sadržaj</button>
            <button className={tab === 'publish' ? 'nav-active' : ''} onClick={() => {setTab('publish');setDemoMoreOpen(false)}}><Send size={18} /> Objave</button>
            <button className={tab === 'menu' ? 'nav-active' : ''} onClick={() => {setTab('menu');setDemoMoreOpen(false)}}><UtensilsCrossed size={18} /> Meni</button>
            <button className={tab === 'settings' ? 'nav-active' : ''} onClick={() => {setTab('settings');setDemoMoreOpen(false)}}><Settings size={18} /> Podešavanja</button>
            <button className="simple-nav-more" onClick={()=>setDemoMoreOpen(value=>!value)}><MenuIcon size={18}/> Više</button>
          </nav>
          {demoMoreOpen&&<div className="demo-more-menu">
            <button onClick={()=>{setTab('studio');setDemoMoreOpen(false)}}><ImageIcon size={17}/> Slike</button>
            <button onClick={()=>{setTab('brand');setDemoMoreOpen(false)}}><Palette size={17}/> Brend</button>
            <button onClick={()=>{setTab('insights');setDemoMoreOpen(false)}}><BarChart3 size={17}/> Rezultati</button>
            <button onClick={()=>{setTab('promotions');setDemoMoreOpen(false)}}><Megaphone size={17}/> Kampanje</button>
            <button onClick={()=>{setTab('owner');setDemoMoreOpen(false)}}><ShieldCheck size={17}/> OWNER demo</button>
          </div>}
        </div>
        <button className="logout" onClick={onExit}><ArrowLeft size={18} /> Nazad na prijavu</button>
      </aside>

      <main className="main-area">
        <div className="restorapp-topbar demo-restorapp-topbar"><div className="restorapp-topbar-copy"><span>Live product demo</span><strong>Bella Napoli</strong><small>Vračar · Beograd · Premium</small></div><div className="restorapp-topbar-actions"><div className="restorapp-profile-chip demo-profile-chip"><img src={demoLogo} alt="Bella Napoli"/><div><strong>Bella Napoli</strong><small>Demo restoran</small></div></div></div></div>
        
        {tab === 'content' && <DemoContent notify={notify} setTab={setTab} />}
        {tab === 'launch' && <DemoLaunch notify={notify} setTab={setTab} />}
        {tab === 'studio' && <VisualStudio restaurant={demoRestaurant} posts={demoVisualPosts} menuItems={demoMenu} setNotice={notify} onChanged={async()=>{}} />}
        {tab === 'brand' && <BrandKit restaurant={demoRestaurant} menuItems={demoMenu} onSaved={async () => {}} setNotice={notify} demo />}
        {tab === 'publish' && <DemoPublish notify={notify} />}
        {tab === 'menu' && <DemoMenu />}
        {tab === 'promotions' && <DemoPromotions notify={notify} />}
        {tab === 'settings' && <DemoSettings />}
        {tab === 'owner' && <DemoOwner notify={notify} />}
      </main>
      {toast && <div className="app-toast">{toast}</div>}
    </div>
  )
}

function DemoLaunch({notify,setTab}:{notify:(value:string)=>void;setTab:(tab:DemoTab)=>void}) {
  const[firstSuccess,setFirstSuccess]=useState<'new'|'ready'>('new')
  const tasks=[
    ['Postavi logo i boje','Brand Kit je spreman.','brand',Palette],
    ['Dopuni restoran','Grad, cilj i kontakt su podešeni.','settings',Settings],
    ['Podesi radno vreme','7/7 dana ima definisano radno vreme.','settings',Clock3],
    ['Poveži Meta publishing','Bella Napoli Facebook · @bellanapoli.','publish',Send],
    ['Uključi Autopilot nedelju','Nova nedelja se priprema automatski.','settings',Sparkles],
    ['Dodaj najmanje 3 jela','5 aktivnih jela u meniju.','menu',UtensilsCrossed],
    ['Izaberi HERO jelo','Pizza Capricciosa vodi kampanje.','menu',Megaphone],
    ['Pokrij meni fotografijama','80% menija ima fotografiju.','studio',ImageIcon],
    ['Napravi prvi sadržaj','4 predloga su spremna.','content',Sparkles],
    ['Odobri i zakaži objave','2 buduća termina · 2 odobreno.','publish',Send],
    ['Zatvori performance loop','4 objave imaju stvarne rezultate.','insights',BarChart3],
  ] as const
  return <div className="launch-center demo-launch-center">
    <section className="launch-hero restorapp-launch-hero has-image" style={{backgroundImage:`linear-gradient(90deg,rgba(7,20,15,.97),rgba(7,20,15,.76) 52%,rgba(7,20,15,.20)),url(${food.pizza})`}}>
      <div><span className="creative-kicker"><Sparkles size={16}/> LAUNCH CENTER DEMO</span><h1>Restoran je spreman za Autopilot.</h1><p>Sada Launch Center proverava i stvarnu Meta konekciju, ne samo Instagram/Facebook tekst u profilu.</p><div className="launch-actions"><button className="primary" onClick={()=>setTab('publish')}><Send size={16}/> Otvori Publish Center</button><button className="secondary" onClick={()=>setTab('content')}><LayoutDashboard size={16}/> Otvori sadržaj</button></div></div>
      <div className="launch-score"><strong>100<small>%</small></strong><span>11/11 koraka završeno</span><div className="launch-ring"><i style={{'--score':100} as CSSProperties}/></div></div>
    </section>

    <section className={'rd2-first-success '+(firstSuccess==='ready'?'success':'ready')}>
      <div className="rd2-first-success-icon">{firstSuccess==='ready'?<CheckCircle2 size={22}/>:<Rocket size={22}/>}</div>
      <div className="rd2-first-success-copy"><span>FIRST SUCCESS DEMO</span><strong>{firstSuccess==='ready'?'Prva Autopilot nedelja je spremna za pregled.':'Simuliraj prvi uspeh novog restorana.'}</strong><p>{firstSuccess==='ready'?'5 objava je napravljeno bez realnog API poziva ili trošenja kvote. Sledeći korak je pregled i prvo odobravanje.':'U produkciji isti klik prvo radi server preflight, zatim pravi nedelju, raspored i AI polish. Ako postoji blocker, korisnika vodi direktno na rešenje.'}</p><div className="rd2-first-success-facts"><span className="ok">3 aktivna jela</span><span className="ok">HERO: Pizza Capricciosa</span><span className="ok">3 fotografije</span></div></div>
      <div className="rd2-first-success-actions">{firstSuccess==='ready'?<button className="rd2-primary" onClick={()=>setTab('content')}><CheckCircle2 size={16}/> Pregledaj objave</button>:<button className="rd2-primary" onClick={()=>{setFirstSuccess('ready');notify('Demo: server preflight je prošao i prva nedelja sa 5 objava je spremna.')}}><Rocket size={16}/> Pokreni prvu nedelju</button>}<button className="rd2-first-success-link" onClick={()=>setTab('menu')}>Meni</button></div>
    </section>

    <section className="launch-preflight ready">
      <div className="launch-preflight-icon"><ShieldCheck size={22}/></div><div><span>AUTO WEEK PREFLIGHT</span><strong>Server potvrđuje da je Autopilot spreman</strong><small>Paket, meni, radno vreme, quota i postojeći plan su provereni.</small></div><div className="launch-preflight-actions"><button className="secondary" onClick={()=>notify('Demo: AUTO WEEK preflight je ponovo proverio sve uslove.')}><RefreshCw size={14}/> Ponovo proveri</button></div>
    </section>

    <section className="launch-preflight ready">
      <div className="launch-preflight-icon"><ShieldCheck size={22}/></div><div><span>META PUBLISH READINESS</span><strong>Direktno Meta objavljivanje je povezano</strong><small>Bella Napoli Facebook · @bellanapoli · token važi. Facebook Page i Instagram Business su potvrđeni.</small></div><div className="launch-preflight-actions"><button className="secondary" onClick={()=>notify('Demo: Meta konekcija je validna i spremna za direktno objavljivanje.')}><RefreshCw size={14}/> Ponovo proveri</button><button className="primary" onClick={()=>setTab('publish')}>Publish Center</button></div>
    </section>

    <section className="launch-grid">{tasks.map(([title,detail,tab,Icon],index)=><button className="launch-task done" key={title} onClick={()=>setTab(tab as DemoTab)}><div className="launch-task-status"><CheckCircle2 size={21}/></div><div className="launch-task-copy"><span>{String(index+1).padStart(2,'0')}</span><strong>{title}</strong><p>{detail}</p></div><Icon size={20}/></button>)}</section>

    <section className="launch-bottom-grid">
      <article><span className="eyebrow">META PUBLISH</span><strong>Direktno objavljivanje povezano</strong><small>Bella Napoli Facebook · @bellanapoli</small><button onClick={()=>setTab('publish')}><Instagram size={15}/> Publish Center</button></article>
      <article><span className="eyebrow">AUTOPILOT</span><strong>Auto week uključen</strong><small>Novi plan se priprema automatski</small><button onClick={()=>setTab('settings')}><Sparkles size={15}/> Automatizacija</button></article>
      <article><span className="eyebrow">MENI</span><strong>5 aktivnih jela</strong><small>4 sa fotografijom · 80% coverage</small><button onClick={()=>setTab('menu')}><UtensilsCrossed size={15}/> Uredi meni</button></article>
      <article><span className="eyebrow">PUBLISH</span><strong>2 buduće objave</strong><small>2 odobreno / objavljeno</small><button onClick={()=>setTab('publish')}><Send size={15}/> Publish Center</button></article>
    </section>
  </div>
}

type DemoContentTemplate={id:RestaurantTemplateId;name:string;category:string;kicker:string;note:string;badge?:string}
const demoContentTemplates:DemoContentTemplate[]=[
  {id:'luxe',name:'Good Morning',category:'Premium',kicker:"TODAY'S MENU",note:'Tamni premium dizajn.',badge:'TOP'},
  {id:'editorial',name:'Today’s Menu Curve',category:'Breakfast',kicker:'GOOD MORNING',note:'Elegantni food layout.',badge:'TOP'},
  {id:'hero-menu',name:'Today’s Menu Circle',category:'Signature',kicker:'GRILLED SPECIAL',note:'Jedno jelo u prvom planu.',badge:'TOP'},
  {id:'minimal',name:'Breakfast Special',category:'Modern',kicker:'FRESH TODAY',note:'Čisto i moderno.'},
  {id:'bold',name:'Today’s Menu Discount',category:'Promo',kicker:'SPECIAL OFFER',note:'Jak promo layout.'},
  {id:'poster',name:'Grilled Special',category:'Story',kicker:"CHEF'S CHOICE",note:'Poster za story i event.'},
  {id:'split',name:'Breakfast Card',category:'Menu',kicker:"TODAY'S MENU",note:'Slika + tekst zona.'},
  {id:'promo-badge',name:'Food Menu Grid',category:'Promo',kicker:'WEEKEND SPECIAL',note:'Veliki promo badge.'},
  {id:'premium-grid',name:'Diagonal Today’s Menu',category:'Menu',kicker:'FOOD MENU',note:'Setovi i tasting meni.'},
  {id:'bold-offer',name:'Pizza Special',category:'Campaign',kicker:'LIMITED OFFER',note:'Velika tipografija.'},
  {id:'lunch-time',name:'Annual Mega Sale',category:'Lunch',kicker:'LUNCH TIME',note:'Dnevni meni i ručak.'},
  {id:'family',name:'Today’s Special Menu',category:'Restaurant',kicker:'TODAY SPECIAL',note:'Topao restoran layout.'},
] as const

type DemoDish={id:string;name:string;price:string;description:string;category:string;image:string}
type DemoDesign={id:string;dishId:string;title:string;text:string;template:RestaurantTemplateId;image:string;price:string;badge:string;primary:string;accent:string;baseFont:BaseFontId;scriptFont:ScriptFontId;textSlots:Record<string,string>;itemSlots:TemplateItemSlot[]}

const demoColorPalettes=[
  {name:'Teal',primary:'#073c38',accent:'#ef7d3a'},
  {name:'Black Gold',primary:'#171411',accent:'#d4ad63'},
  {name:'Burgundy',primary:'#561f2b',accent:'#f0d1b1'},
  {name:'Olive',primary:'#455039',accent:'#e7c98a'},
  {name:'Navy',primary:'#16334a',accent:'#ef8169'},
]

function DemoContent({notify,setTab}:{notify:(value:string)=>void;setTab:(tab:DemoTab)=>void}) {
  const[studioTab,setStudioTab]=useState<'dishes'|'templates'|'posts'>('dishes')
  const[dishes,setDishes]=useState<DemoDish[]>([
    {id:'pizza',name:'Pizza Capricciosa',price:'890 RSD',description:'Pelat, mozzarella, šunka i pečurke.',category:'PIZZA',image:food.pizza},
    {id:'pasta',name:'Sveža Carbonara',price:'940 RSD',description:'Guanciale, jaje, pecorino i sveža pasta.',category:'PASTA',image:food.pasta},
    {id:'tiramisu',name:'Tiramisu',price:'520 RSD',description:'Mascarpone, espresso i kakao.',category:'DESERT',image:food.tiramisu},
    {id:'salad',name:'Garden Special',price:'690 RSD',description:'Sveže povrće, avokado i house dressing.',category:'FRESH',image:food.salad},
  ])
  const[dishForm,setDishForm]=useState({name:'',price:'',description:'',category:''})
  const[editingDishId,setEditingDishId]=useState('')
  const[dishPhoto,setDishPhoto]=useState(food.lasagna)
  const[selectedDishId,setSelectedDishId]=useState('pizza')
  const[template,setTemplate]=useState<RestaurantTemplateId>('luxe')
  const[headline,setHeadline]=useState('Pizza Capricciosa')
  const[text,setText]=useState('Hrskavo testo, mozzarella i miris peći. Rezerviši svoj sto večeras.')
  const[priceText,setPriceText]=useState('890 RSD')
  const[badge,setBadge]=useState('')
  const[cta,setCta]=useState('Rezerviši sto')
  const[primaryColor,setPrimaryColor]=useState('#073c38')
  const[accentColor,setAccentColor]=useState('#ef7d3a')
  const[baseFont,setBaseFont]=useState<BaseFontId>('elegant-serif')
  const[scriptFont,setScriptFont]=useState<ScriptFontId>('signature')
  const[textSlots,setTextSlots]=useState<Record<string,string>>(()=>defaultTextSlots('luxe'))
  const[itemSlots,setItemSlots]=useState<TemplateItemSlot[]>(()=>defaultItemSlots('luxe'))
  const[format,setFormat]=useState<'feed'|'story'>('feed')
  const[designs,setDesigns]=useState<DemoDesign[]>(()=>demoPosts.map((post,index)=>({
    id:'demo-'+index,dishId:index===0?'pizza':index===1?'pasta':index===2?'tiramisu':'salad',
    title:post.title,text:post.caption,template:(['luxe','editorial','minimal','bold'][index] as RestaurantTemplateId),image:post.image,
    price:index===0?'890 RSD':index===1?'940 RSD':index===2?'520 RSD':'690 RSD',badge:post.type==='PROMO'?'20% OFF':'',primary:'#073c38',accent:'#ef7d3a',baseFont:defaultBaseFont((['luxe','editorial','minimal','bold'][index] as RestaurantTemplateId)),scriptFont:'signature',textSlots:defaultTextSlots((['luxe','editorial','minimal','bold'][index] as RestaurantTemplateId)),itemSlots:defaultItemSlots((['luxe','editorial','minimal','bold'][index] as RestaurantTemplateId)),
  })))
  const[editingDesignId,setEditingDesignId]=useState('')
  const selectedDish=dishes.find(item=>item.id===selectedDishId)||dishes[0]||{id:'empty',name:'Dodaj jelo',price:'',description:'',category:'JELO',image:food.lasagna}
  const selectedTemplateConfig=templateSlotConfig[template]

  function chooseDishPhoto(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0]
    if(!file)return
    if(!file.type.startsWith('image/')){notify('Izaberi fotografiju.');return}
    setDishPhoto(URL.createObjectURL(file))
  }
  function addDish(event:FormEvent){
    event.preventDefault()
    if(!dishForm.name.trim()){notify('Upiši naziv jela.');return}
    const next={id:editingDishId||'dish-'+Date.now(),name:dishForm.name.trim(),price:dishForm.price.trim()||'—',description:dishForm.description.trim(),category:dishForm.category.trim().toUpperCase()||'JELO',image:dishPhoto}
    if(editingDishId){
      setDishes(current=>current.map(item=>item.id===editingDishId?next:item))
      setEditingDishId('')
      setDishForm({name:'',price:'',description:'',category:''})
      notify('Demo: izmene jela su sačuvane.')
    }else{
      setDishes(current=>[next,...current])
      setDishForm({name:'',price:'',description:'',category:''})
      startDish(next)
      notify('Demo: jelo je dodato. Sada izaberi šablon.')
    }
  }
  function startDish(item:DemoDish){
    setSelectedDishId(item.id);setHeadline(item.name);setText(item.description);setPriceText(item.price);setBadge('');setTemplate('luxe');setPrimaryColor('#073c38');setAccentColor('#ef7d3a');setBaseFont(defaultBaseFont('luxe'));setScriptFont('signature');setTextSlots({...defaultTextSlots('luxe'),smallDesc:item.description,buttonText:'Rezerviši sto'});setItemSlots(defaultItemSlots('luxe'));setEditingDesignId('');setStudioTab('templates')
    window.scrollTo({top:0,behavior:'smooth'})
  }
  function chooseDemoTemplate(next:RestaurantTemplateId){
    setTemplate(next)
    const slots=defaultTextSlots(next)
    if('overlayTitle' in slots)slots.overlayTitle=headline
    if('smallDesc' in slots)slots.smallDesc=text||slots.smallDesc
    if('whiteCardText' in slots)slots.whiteCardText=text||slots.whiteCardText
    if('footerText' in slots)slots.footerText=text||slots.footerText
    if('smallCta' in slots)slots.smallCta=cta
    if('buttonText' in slots)slots.buttonText=cta
    setTextSlots(slots)
    setItemSlots(defaultItemSlots(next))
  }
  function saveDesign(){
    if(!headline.trim()){notify('Upiši naslov.');return}
    const data={id:editingDesignId||'design-'+Date.now(),dishId:selectedDish.id,title:headline.trim(),text:text.trim(),template,image:selectedDish.image,price:priceText,badge,primary:primaryColor,accent:accentColor,baseFont,scriptFont,textSlots:{...textSlots},itemSlots:itemSlots.map(item=>({...item}))}
    setDesigns(current=>editingDesignId?current.map(item=>item.id===editingDesignId?data:item):[data,...current])
    setEditingDesignId('');setStudioTab('posts')
    notify('Demo: objava je sačuvana.')
  }
  function editDesign(item:DemoDesign){
    const dish=dishes.find(entry=>entry.id===item.dishId)||selectedDish
    setSelectedDishId(dish.id);setHeadline(item.title);setText(item.text);setPriceText(item.price);setBadge(item.badge);setTemplate(item.template);setPrimaryColor(item.primary);setAccentColor(item.accent);setBaseFont(item.baseFont);setScriptFont(item.scriptFont);setTextSlots({...item.textSlots});setItemSlots(item.itemSlots.map(entry=>({...entry})));setEditingDesignId(item.id);setStudioTab('templates')
    window.scrollTo({top:0,behavior:'smooth'})
  }
  function duplicateDesign(item:DemoDesign){
    setDesigns(current=>[{...item,id:'copy-'+Date.now(),title:item.title+' Copy'},...current])
    notify('Demo: objava je duplirana.')
  }

  return <div className="dish-template-studio demo-dish-template-studio">
    <header className="dts-header"><div><span>RESTORAPP CONTENT</span><h1>Od jela do objave za minut.</h1><p>Dodaj jelo, izaberi gotov restoran dizajn i upiši tekst. Nema crtanja i nema komplikovanog editora.</p></div><div className="dts-mini-flow"><b>1</b> Jelo <ChevronRight size={13}/><b>2</b> Šablon <ChevronRight size={13}/><b>3</b> Objava</div></header>

    <nav className="dts-tabs">
      <button className={studioTab==='dishes'?'active':''} onClick={()=>setStudioTab('dishes')}><UtensilsCrossed size={17}/><span>Jela</span><b>{dishes.length}</b></button>
      <button className={studioTab==='templates'?'active':''} onClick={()=>setStudioTab('templates')}><LayoutTemplate size={17}/><span>Šabloni</span><b>{demoContentTemplates.length}</b></button>
      <button className={studioTab==='posts'?'active':''} onClick={()=>setStudioTab('posts')}><ImageIcon size={17}/><span>Objave</span><b>{designs.length}</b></button>
    </nav>

    {studioTab==='dishes'&&<section className="dts-dishes">
      <form className="dts-dish-form" onSubmit={addDish}>
        <div className="dts-section-head"><div><span>{editingDishId?'IZMENI JELO':'NOVO JELO'}</span><h2>{editingDishId?'Sačuvaj izmene':'Dodaj jelo'}</h2></div>{editingDishId&&<button type="button" className="dts-icon" onClick={()=>{setEditingDishId('');setDishForm({name:'',price:'',description:'',category:''})}}><X size={17}/></button>}</div>
        <label className="dts-dish-upload has-image"><img src={dishPhoto} alt=""/><input type="file" accept="image/*" onChange={chooseDishPhoto}/><em><Upload size={13}/> Promeni sliku</em></label>
        <label>Naziv jela<input value={dishForm.name} onChange={e=>setDishForm({...dishForm,name:e.target.value})} placeholder="Pizza Capricciosa"/></label>
        <div className="dts-two"><label>Cena<input value={dishForm.price} onChange={e=>setDishForm({...dishForm,price:e.target.value})} placeholder="890 RSD"/></label><label>Kategorija<input value={dishForm.category} onChange={e=>setDishForm({...dishForm,category:e.target.value})} placeholder="Pizza"/></label></div>
        <label>Kratak opis<textarea rows={3} value={dishForm.description} onChange={e=>setDishForm({...dishForm,description:e.target.value})} placeholder="Pelat, mozzarella, šunka…"/></label>
        <button className="dts-primary">{editingDishId?<Save size={16}/>:<Plus size={16}/>} {editingDishId?'Sačuvaj jelo':'Dodaj jelo'}</button>
      </form>
      <div className="dts-dish-library"><div className="dts-section-head"><div><span>MOJA JELA</span><h2>Izaberi šta reklamiraš</h2></div><small>Klikni Kreiraj objavu.</small></div><div className="dts-dish-grid">{dishes.map(item=><article key={item.id}><div className="dts-dish-photo"><img src={item.image} alt=""/><span>{item.category}</span></div><div className="dts-dish-copy"><div><h3>{item.name}</h3><strong>{item.price}</strong></div><p>{item.description}</p></div><button className="dts-create-post" onClick={()=>startDish(item)}><LayoutTemplate size={15}/> Kreiraj objavu</button><div className="dts-row-actions"><button onClick={()=>{setEditingDishId(item.id);setDishForm({name:item.name,price:item.price,description:item.description,category:item.category});setDishPhoto(item.image);window.scrollTo({top:0,behavior:'smooth'});notify('Demo: izmeni podatke i klikni Sačuvaj jelo.')}}><Pencil size={14}/> Izmeni</button><button className="danger" onClick={()=>{setDishes(current=>current.filter(entry=>entry.id!==item.id));notify('Demo: jelo je obrisano.')}}><Trash2 size={14}/> Obriši</button></div></article>)}</div></div>
    </section>}

    {studioTab==='templates'&&<section className="dts-template-screen">
      <div className="dts-template-main"><div className="dts-section-head"><div><span>GOTOVI DIZAJNI</span><h2>Izaberi šablon</h2></div><small>Za: <strong>{selectedDish.name}</strong></small></div>
        <div className="dts-template-gallery">{demoContentTemplates.map((item,index)=><article key={item.id} className={template===item.id?'selected':''}><div className="dts-template-art"><RestaurantTemplateCanvas template={item.id} image={selectedDish.image} headline={headline} text={text} price={priceText} badge={badge} cta={cta||'BUY'} primary={primaryColor} accent={accentColor} textSlots={item.id===template?textSlots:defaultTextSlots(item.id)} itemSlots={item.id===template?itemSlots:defaultItemSlots(item.id)} baseFont={item.id===template?baseFont:defaultBaseFont(item.id)} scriptFont={item.id===template?scriptFont:'signature'}/></div><div className="dts-template-meta"><div><span>{item.category}</span><strong>{item.name}</strong><small>{item.note}</small></div><button onClick={()=>chooseDemoTemplate(item.id)}>{template===item.id?<><Check size={14}/> Izabran</>:<>Koristi šablon <ChevronRight size={14}/></>}</button></div></article>)}</div>
      </div>
      <aside className="dts-composer"><div className="dts-composer-head"><span>OBJAVA</span><strong>{editingDesignId?'Izmeni objavu':'Dovrši objavu'}</strong></div>
        <label>Naslov<input value={headline} onChange={e=>setHeadline(e.target.value)}/></label><label>Tekst<textarea rows={4} value={text} onChange={e=>setText(e.target.value)}/></label>
        <div className="dts-two"><label>Cena<input value={priceText} onChange={e=>setPriceText(e.target.value)}/></label><label>Badge<input value={badge} onChange={e=>setBadge(e.target.value)} placeholder="20% OFF"/></label></div><label>CTA<input value={cta} onChange={e=>setCta(e.target.value)}/></label>
        <div className="dts-template-text-editor"><div className="dts-template-text-head"><div><span>TEKSTOVI NA DIZAJNU</span><strong>{demoContentTemplates.find(item=>item.id===template)?.name}</strong><small>Dug tekst se automatski uklapa.</small></div><button type="button" onClick={()=>chooseDemoTemplate(template)}>Vrati tekstove</button></div><div className="dts-template-text-fields">{selectedTemplateConfig.textSlots.map(slot=><label key={slot.key}>{slot.label}{slot.multiline?<textarea rows={2} value={textSlots[slot.key]??slot.defaultValue} onChange={e=>setTextSlots(current=>({...current,[slot.key]:e.target.value}))}/>:<input value={textSlots[slot.key]??slot.defaultValue} onChange={e=>setTextSlots(current=>({...current,[slot.key]:e.target.value}))}/>}</label>)}</div>{selectedTemplateConfig.itemSlots?.length?<div className="dts-item-slot-editor"><div className="dts-item-slot-title"><span>STAVKE U MENIJU</span><small>Menjaj svaki naziv i cenu.</small></div>{itemSlots.map((item,index)=><div className="dts-item-slot-row" key={index}><b>{index+1}</b><input value={item.title} onChange={e=>setItemSlots(current=>current.map((entry,i)=>i===index?{...entry,title:e.target.value}:entry))}/><input value={item.price} onChange={e=>setItemSlots(current=>current.map((entry,i)=>i===index?{...entry,price:e.target.value}:entry))}/></div>)}</div>:null}</div>
        <div className="dts-color-editor"><div className="dts-color-title"><span>BOJE ŠABLONA</span><small>Jedan klik ili svoje boje.</small></div><div className="dts-palette-row">{demoColorPalettes.map(palette=><button type="button" key={palette.name} className={primaryColor===palette.primary&&accentColor===palette.accent?'active':''} onClick={()=>{setPrimaryColor(palette.primary);setAccentColor(palette.accent)}}><i style={{background:palette.primary}}/><i style={{background:palette.accent}}/><span>{palette.name}</span></button>)}</div><div className="dts-color-pickers"><label>Glavna<input type="color" value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)}/><span>{primaryColor}</span></label><label>Akcent<input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/><span>{accentColor}</span></label></div></div><div className="dts-font-editor"><div className="dts-font-title"><span>FONTOVI</span><small>Menjaj obični i pisani font odvojeno.</small></div><div className="dts-font-group"><strong>Osnovni font</strong><div className="dts-font-options">{baseFontOptions.map(font=><button type="button" key={font.id} className={baseFont===font.id?'active':''} onClick={()=>setBaseFont(font.id)}><b style={{fontFamily:baseFontStack(font.id)}}>{font.sample}</b><span>{font.name}</span></button>)}</div></div><div className="dts-font-group"><strong>Pisani font</strong><div className="dts-font-options script">{scriptFontOptions.map(font=><button type="button" key={font.id} className={scriptFont===font.id?'active':''} onClick={()=>setScriptFont(font.id)}><b style={{fontFamily:scriptFontStack(font.id)}}>{font.sample}</b><span>{font.name}</span></button>)}</div></div></div>
        <div className="dts-format"><button className={format==='feed'?'active':''} onClick={()=>setFormat('feed')}>POST 1:1</button><button className={format==='story'?'active':''} onClick={()=>setFormat('story')}>STORY 9:16</button></div>
        <RestaurantTemplateCanvas className="dts-live-preview" template={template} image={selectedDish.image} headline={headline} text={text} price={priceText} badge={badge} cta={cta||'BUY'} primary={primaryColor} accent={accentColor} logoUrl={demoLogo} format={format} textSlots={textSlots} itemSlots={itemSlots} baseFont={baseFont} scriptFont={scriptFont}/>
        <button className="dts-primary dts-save-post" onClick={saveDesign}><Save size={17}/>{editingDesignId?'Sačuvaj izmene':'Sačuvaj objavu'}</button>
      </aside>
    </section>}

    {studioTab==='posts'&&<section className="dts-posts"><div className="dts-section-head"><div><span>MOJE OBJAVE</span><h2>Sačuvani dizajni</h2></div><button className="dts-primary compact" onClick={()=>setStudioTab('dishes')}><Plus size={15}/> Nova objava</button></div><div className="dts-post-grid">{designs.map(item=><article key={item.id}><div className="dts-post-art"><RestaurantTemplateCanvas template={item.template} image={item.image} headline={item.title} text={item.text} price={item.price} badge={item.badge} cta="BUY" primary={item.primary} accent={item.accent} textSlots={item.textSlots} itemSlots={item.itemSlots} baseFont={item.baseFont} scriptFont={item.scriptFont}/></div><div className="dts-post-info"><div><span className="status draft">Draft</span><strong>{item.title}</strong></div><div className="dts-post-actions"><button onClick={()=>editDesign(item)}><Pencil size={14}/> Izmeni</button><button onClick={()=>duplicateDesign(item)}><Copy size={14}/> Dupliraj</button><button className="schedule" onClick={()=>{setTab('publish');notify('Demo: otvoren je ekran Objave za zakazivanje.')}}><CalendarClock size={14}/> Zakaži</button><button className="danger icon-only" onClick={()=>{setDesigns(current=>current.filter(entry=>entry.id!==item.id));notify('Demo: objava je obrisana.')}}><Trash2 size={14}/></button></div></div></article>)}</div></section>}
  </div>
}

function DemoKpi({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="wow-kpi"><div className="wow-kpi-icon"><TrendingUp size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }

function DemoMenu() {
  return <><header className="page-header wow-simple-header"><div><p className="eyebrow">MENI</p><h1>Jela koja hrane Autopilot.</h1><p className="muted">Realna fotografija + dobar opis = sadržaj koji izgleda kao pravi restoran, ne kao generičan AI.</p></div><button className="primary">+ Dodaj jelo</button></header><div className="wow-menu-grid">{demoMenuCards.map((item) => <article className="wow-menu-card" key={item.name}><div className="wow-menu-photo" style={{ backgroundImage: `url(${item.image})` }}><span>{item.category}</span></div><div><h3>{item.name}</h3><p>Fotografija visoke rezolucije · aktivno</p><strong>{item.price}</strong></div><span className="menu-active">Aktivno</span></article>)}</div></>
}

function DemoPromotions({ notify }: { notify: (value: string) => void }) {
  return <><header className="page-header wow-simple-header"><div><p className="eyebrow">CAMPAIGN AUTOPILOT</p><h1>Jedna akcija. Cela kampanja.</h1><p className="muted">Feed, story, CTA i discovery iz jednog kratkog unosa.</p></div></header><div className="promo-layout wow-promo-layout"><div className="panel promo-form"><div className="wow-promo-photo" style={{ backgroundImage: `url(${food.pasta})` }} /><h2><Megaphone size={20} /> Vikend pasta</h2><label>Glavna poruka<input readOnly value="20% popusta na sve paste" /></label><label>Detalji<textarea readOnly rows={4} value="Petak i subota od 18h. Važi u restoranu." /></label><button className="primary full" onClick={() => notify('Kampanja je napravljena: feed + story + termin + IG/FB discovery.')}><Sparkles size={18} /> Napravi kampanju</button></div><aside className="promo-explainer wow-promo-explainer"><p className="eyebrow">OUTPUT</p><h2>Od jedne ideje do dva gotova formata.</h2><p>Fotografija ostaje realna, a dizajn, CTA i copy se prilagođavaju platformi.</p><div className="format-cards"><div><strong>1080 × 1350</strong><span>Feed · 4:5</span></div><div><strong>1080 × 1920</strong><span>Story · 9:16</span></div></div></aside></div></>
}

function DemoPublish({ notify }: { notify: (value: string) => void }) {
  type DemoMetaStatus='idle'|'queued'|'published'|'failed'
  type DemoMetaJobs={facebook:DemoMetaStatus;instagram:DemoMetaStatus}
  type DemoConnectionStatus='connected'|'expiring'|'expired'|'disconnected'
  const [times, setTimes] = useState<Record<string, string>>(() => Object.fromEntries(demoPosts.map((post) => [post.title, post.time])))
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState('')
  const [metaConnection,setMetaConnection]=useState<DemoConnectionStatus>('connected')
  const [metaJobs,setMetaJobs]=useState<Record<string,DemoMetaJobs>>({
    'Pizza Capricciosa':{facebook:'queued',instagram:'queued'},
    'Sveža Carbonara':{facebook:'published',instagram:'published'},
    'Tiramisu':{facebook:'idle',instagram:'failed'},
    'Vikend pasta':{facebook:'idle',instagram:'idle'},
  })

  const metaReady=metaConnection==='connected'||metaConnection==='expiring'
  const metaWarning=metaConnection==='expiring'
  const connectionTitle=metaConnection==='connected'?'Facebook + Instagram povezani':metaConnection==='expiring'?'Meta token uskoro ističe':metaConnection==='expired'?'Meta token je istekao':'Meta nalog nije povezan'
  const connectionDetail=metaConnection==='connected'
    ?'Bella Napoli Beograd · @bellanapoli · token server-side · queue proverava objave svakih 5 min'
    :metaConnection==='expiring'
      ?'META TOKEN WARNING DEMO · token ističe za 3 dana. Objave još rade, ali reconnect treba završiti pre isteka.'
      :metaConnection==='expired'
        ?'Direktno objavljivanje je blokirano dok se Facebook / Instagram ponovo ne povežu. Queue se ne šalje naslepo.'
        :'Nema aktivnog Page tokena. Sadržaj ostaje bezbedno u Restorappu dok se Meta Connect ne završi.'

  function begin(title: string) { setEditing(title); setDraft(times[title] || '18:30') }
  function save(title: string) {
    setTimes({ ...times, [title]: draft })
    setEditing('')
    notify(`Termin za ${title} je sačuvan u ${draft}. Meta queue bi automatski pratio novi termin.`)
  }
  function setJob(title:string,platform:'facebook'|'instagram',status:DemoMetaStatus){
    setMetaJobs(current=>({...current,[title]:{...(current[title]||{facebook:'idle',instagram:'idle'}),[platform]:status}}))
  }
  function requireMetaReady(){
    if(metaReady)return true
    notify(metaConnection==='expired'?'Demo: Meta token je istekao. Prvo klikni „Ponovo poveži Meta“.':'Demo: Meta nalog nije povezan. Prvo završi Meta Connect.')
    return false
  }
  function queueMeta(title:string){
    if(!requireMetaReady())return
    setMetaJobs(current=>({...current,[title]:{facebook:'queued',instagram:'queued'}}))
    notify(`Demo: ${title} je zakazan za Facebook + Instagram.${metaWarning?' Token warning ostaje vidljiv do reconnect-a.':''}`)
  }
  function publishMeta(title:string){
    if(!requireMetaReady())return
    setMetaJobs(current=>({...current,[title]:{facebook:'published',instagram:'published'}}))
    notify(`Demo: ${title} je objavljen na Facebook + Instagram.`)
  }
  function retryMeta(title:string,platform:'facebook'|'instagram'){
    if(!requireMetaReady())return
    setJob(title,platform,'published')
    notify(`Demo: ${platform==='facebook'?'Facebook':'Instagram'} retry je uspeo posle bezbedne provere konekcije.`)
  }
  function cancelMeta(title:string){
    setMetaJobs(current=>({...current,[title]:{facebook:'idle',instagram:'idle'}}))
    notify(`Demo: Meta zakazivanje za ${title} je otkazano.`)
  }
  function reconnectMeta(){
    setMetaConnection('connected')
    notify('Demo: Meta reconnect je završen. Facebook Page + Instagram Business su ponovo validni.')
  }
  function disconnectMeta(){
    setMetaConnection('disconnected')
    notify('Demo: Meta nalog je odvojen. Postojeći sadržaj ostaje sačuvan, a nove objave su blokirane.')
  }

  return <>
    <header className="page-header wow-simple-header"><div><p className="eyebrow">PUBLISH CENTER</p><h1>Tačan dan. Tačno vreme.</h1><p className="muted">Autopilot predlaže termin, a Meta queue može da objavi i kada aplikacija nije otvorena.</p></div><button className="primary" onClick={() => notify('Demo kalendar je spreman sa datumima i vremenima.')}><CalendarClock size={17} /> Export kalendara</button></header>

    <section className={`meta-connect-panel demo-meta-connected ${metaReady?'connected':'expired'} ${metaWarning?'demo-meta-warning':''}`}>
      <div className="meta-connect-brand"><div>{metaReady?<><Facebook size={20}/><Instagram size={20}/></>:<AlertTriangle size={22}/>}</div><span><small>META PUBLISHING · DEMO</small><strong>{connectionTitle}</strong><p>{connectionDetail}</p></span></div>
      <div className="meta-connect-actions">
        <span className={`meta-connected-chip demo-meta-state-${metaConnection}`}>{metaReady?<CheckCircle2 size={14}/>:<AlertTriangle size={14}/>} {metaConnection==='connected'?'CONNECTED':metaConnection==='expiring'?'TOKEN ISTIČE':metaConnection==='expired'?'EXPIRED':'DISCONNECTED'}</span>
        {metaConnection==='connected'&&<><button className="secondary" onClick={()=>{setMetaConnection('expiring');notify('Demo: token sada ističe za 3 dana. Publishing i dalje radi, ali sistem traži reconnect.')}}><AlertTriangle size={14}/> Simuliraj token warning</button><button className="meta-disconnect" onClick={disconnectMeta}>Odvoji demo</button></>}
        {metaConnection==='expiring'&&<><button className="secondary" onClick={reconnectMeta}><RefreshCw size={14}/> Obnovi konekciju</button><button className="meta-disconnect" onClick={()=>{setMetaConnection('expired');notify('Demo: token je istekao. Novi publish i retry su sada blokirani.')}}>Simuliraj istek</button></>}
        {metaConnection==='expired'&&<button className="primary" onClick={reconnectMeta}><RefreshCw size={14}/> Ponovo poveži Meta</button>}
        {metaConnection==='disconnected'&&<button className="primary" onClick={reconnectMeta}><Facebook size={14}/> Poveži Meta</button>}
      </div>
    </section>

    <section className={`publish-gate ${metaReady?'ready':'blocked'}`}><div className="publish-gate-icon">{metaReady?<CheckCircle2 size={20}/>:<AlertTriangle size={20}/>}</div><div><span>WEEK GATE</span><strong>{metaReady?(metaWarning?'Spremno, ali token traži pažnju':'Spremno za publishing'):'Publishing je bezbedno blokiran'}</strong><small>{metaReady?(metaWarning?'Termini i approval su spremni; reconnect uradi pre isteka tokena.':'Nema tehničkih blokera: termini, approval i Meta konekcija su spremni.'):'Meta konekcija nije zdrava. Queue, Meta sada i retry čekaju reconnect — ništa se ne šalje naslepo.'}</small></div><b>{metaReady?'1/4':'0/4'}</b></section>
    <div className="demo-next-time"><div><Clock3 size={22} /></div><span>SLEDEĆA OBJAVA<strong>Ponedeljak, 14. septembar · {times['Pizza Capricciosa']}</strong><small>FEED · Pizza Capricciosa · {metaReady?'FB + IG queued':'Meta queue pauziran'}</small></span></div>

    <div className="panel wow-publish-demo demo-publish-pro">{demoPosts.map((post) => {
      const jobs=metaJobs[post.title]||{facebook:'idle',instagram:'idle'}
      const approved=post.status==='approved'
      const hasQueued=jobs.facebook==='queued'||jobs.instagram==='queued'
      return <div className={`wow-publish-row ${editing === post.title ? 'editing' : ''}`} key={post.title}>
        <div className="wow-publish-thumb" style={{ backgroundImage: `url(${post.image})` }} />
        <div className="demo-publish-copy">
          <span className="demo-publish-meta">{post.day} · {post.type}</span>
          <strong className="demo-publish-title">{post.title}</strong>
          <p className="demo-publish-caption">{post.caption}</p>
          <div className="meta-job-strip">
            {(['facebook','instagram'] as const).map(platform=>{
              const status=jobs[platform]
              if(status==='idle')return null
              return <span className={`meta-job-chip ${status}`} key={platform}><b>{platform==='facebook'?'FB':'IG'}</b> {status}{status==='queued'&&<small>{times[post.title]}</small>}{status==='failed'&&<button disabled={!metaReady} title={!metaReady?'Reconnect Meta prvo':'Bezbedan retry'} onClick={()=>retryMeta(post.title,platform)}>Retry</button>}</span>
            })}
          </div>
          {editing === post.title && <div className="demo-time-editor"><label>Vreme objave<input type="time" value={draft} onChange={(event) => setDraft(event.target.value)} /></label><button className="secondary" onClick={() => setDraft(post.type === 'STORY' ? '11:30' : post.type === 'PROMO' ? '17:30' : '18:30')}><Sparkles size={13} /> Autopilot</button><button className="primary" onClick={() => save(post.title)}><Save size={13} /> Sačuvaj</button><button className="icon-button" onClick={() => setEditing('')}><X size={14} /></button></div>}
        </div>
        <div className="demo-publish-actions">
          <span className="demo-publish-time"><Clock3 size={13} /> {times[post.title]}</span>
          {post.title==='Pizza Capricciosa'&&<span className="learned-time-chip"><Sparkles size={11}/> LEARNED TIME</span>}
          <span className="generation-source-chip auto">AUTO WEEK</span>
          <span className={`status ${post.status}`}>{post.status}</span>
          <button className="mini-schedule" onClick={() => begin(post.title)}><Pencil size={13} /> Promeni</button>
          {approved&&<button className="mini-meta-now" disabled={!metaReady} onClick={()=>publishMeta(post.title)}><Send size={13}/> Meta sada</button>}
          {approved&&!hasQueued&&<button className="mini-meta-queue" disabled={!metaReady} onClick={()=>queueMeta(post.title)}><CalendarClock size={13}/> Zakaži Meta</button>}
          {hasQueued&&<button className="meta-disconnect demo-cancel-meta" onClick={()=>cancelMeta(post.title)}>Otkaži Meta</button>}
        </div>
      </div>
    })}</div>

    <div className={`meta-roadmap ${metaReady?'':'demo-meta-roadmap-blocked'}`}><div>{metaReady?<Send size={18}/>:<ShieldCheck size={18}/>}<div><strong>{metaReady?'Background publishing simulacija je aktivna':'Background publishing je pauziran'}</strong><span>{metaReady?'Demo prikazuje connected nalog, queue, publish, cancel, retry i token warning. U produkciji se tokeni čuvaju u Vault-u i queue radi server-side.':'Demo pokazuje zaštitu: kada token istekne ili je nalog odvojen, nove objave i retry se ne šalju dok reconnect nije potvrđen.'}</span></div></div><span className="roadmap-badge">{metaConnection==='connected'?'META CONNECTED':metaConnection==='expiring'?'TOKEN WARNING':metaConnection==='expired'?'RECONNECT REQUIRED':'META DISCONNECTED'}</span></div>
  </>
}

function DemoInsights({notify}:{notify:(message:string)=>void}) {
  const ranking = [
    {title:'Pizza Capricciosa', reach:'8.4k', engagement:'7.8%', width:92, detail:'HERO · Feed'},
    {title:'Sveža Carbonara', reach:'6.1k', engagement:'6.4%', width:76, detail:'Lunch · Story'},
    {title:'Vikend pasta', reach:'4.9k', engagement:'5.9%', width:68, detail:'Promo · Feed'},
    {title:'Tiramisu', reach:'3.6k', engagement:'4.8%', width:55, detail:'Hero dish · Feed'},
  ]
  return <div className="insights-center demo-insights">
    <header className="page-header insights-header"><div><p className="eyebrow">PERFORMANCE LOOP</p><h1>Rezultati koji uče Autopilot.</h1><p className="muted">Reach, engagement, klikovi i konverzije vraćaju signal u sledeću AI nedelju.</p></div></header>
    <section className="insights-kpis">
      <article><span><Target size={16}/> Doseg</span><strong>23k</strong><small>4 praćene objave</small></article>
      <article><span><TrendingUp size={16}/> Engagement</span><strong>6.6%</strong><small>1.518 interakcija</small></article>
      <article><span><MousePointerClick size={16}/> Klikovi</span><strong>286</strong><small>CTR 1.2%</small></article>
      <article><span><CheckCircle2 size={16}/> Konverzije</span><strong>31</strong><small>rezervacije / porudžbine</small></article>
    </section>
    <section className="generation-performance panel">
      <div className="panel-heading"><div><p className="eyebrow">GENERATION PERFORMANCE</p><h2>AUTO WEEK vs MANUAL</h2></div><Sparkles size={20}/></div>
      <div className="generation-performance-grid">
        <article className="auto"><div><span>AUTO WEEK</span><strong>5</strong><small>izmerenih objava</small></div><div><span>Engagement</span><strong>6.9%</strong><small>18.4k reach</small></div><div><span>CTR</span><strong>1.4%</strong><small>258 klikova</small></div><div><span>Konverzije</span><strong>24</strong><small>stabilniji uzorak</small></div></article>
        <article className="manual"><div><span>MANUAL</span><strong>3</strong><small>izmerene objave</small></div><div><span>Engagement</span><strong>5.8%</strong><small>11.2k reach</small></div><div><span>CTR</span><strong>1.1%</strong><small>123 klika</small></div><div><span>Konverzije</span><strong>11</strong><small>stabilniji uzorak</small></div></article>
      </div>
      <p className="generation-performance-note">Demo prikazuje kako se porede samo izmerene objave; u pravoj aplikaciji brojke dolaze iz stvarnih performance podataka restorana.</p>
    </section>

    <section className="learning-status panel">
      <div className="learning-status-head"><div><p className="eyebrow">AUTOPILOT LEARNING</p><h2>Učenje aktivno</h2><span>4 stvarne objave trenutno utiču na sledeću generaciju sadržaja.</span></div><strong>50%</strong></div>
      <div className="learning-progress"><i style={{width:'50%'}}/></div>
      <div className="learning-coverage-row"><span>Performance coverage menija <b>2/5</b></span><div><i style={{width:'40%'}}/></div></div>
      <div className="learning-signals"><div><span>Najbolje jelo</span><strong>Pizza Capricciosa</strong></div><div><span>Najjači pillar</span><strong>Hero jelo</strong></div><div><span>Top engagement</span><strong>7.8%</strong></div><div><span>Najbolji termin</span><strong>18:30</strong></div><div><span>Najbolji dan</span><strong>Petak</strong></div><div><span>Praćeno</span><strong>4/4</strong></div></div>
      <p>Priority Engine već kombinuje ove rezultate sa HERO prioritetom, recency signalom i raznovrsnošću menija.</p>
    </section>
    <section className="opportunity-radar panel">
      <div className="panel-heading"><div><p className="eyebrow">OPPORTUNITY RADAR</p><h2>Šta sledeće vredi testirati</h2></div><Target size={20}/></div>
      <div className="opportunity-list">
        <article><div className="opportunity-kind gap">CONTENT GAP</div><strong>Sezonska salata</strong><span>Nije bila u sadržaju poslednjih 30 dana. Dobar kandidat za svežiji, lakši content slot.</span><small>STANDARDNO</small><button className="opportunity-action" onClick={()=>notify('Demo: test draft za Sezonsku salatu je napravljen i dobio je prvi slobodan budući termin.')}>Testiraj sledeće</button></article>
        <article><div className="opportunity-kind test">TEST SIGNAL</div><strong>Carbonara</strong><span>Visok prioritet i dobar reach, ali treba još merenja konverzija pre jačeg boost-a.</span><small>VISOK PRIORITET</small><button className="opportunity-action" onClick={()=>notify('Demo: Carbonara test draft je spreman za quality review.')}>Testiraj sledeće</button></article>
        <article><div className="opportunity-kind photo">PHOTO GAP</div><strong>Lasagne della casa</strong><span>Jelo ima potencijal za premium feed, ali sledeći dobitak je bolja fotografija.</span><small>PRIORITET</small><button className="opportunity-action" onClick={()=>notify('Demo: prvo dodaj ili generiši fotografiju u Meniju, pa pokreni test.')}>Dodaj fotografiju</button></article>
      </div>
    </section>

    <div className="insights-grid">
      <section className="panel insights-ranking"><div className="panel-heading"><div><p className="eyebrow">TOP SADRŽAJ</p><h2>Šta radi najbolje</h2></div><BarChart3 size={20}/></div>
        {ranking.map((item,index)=><div className="ranking-row" key={item.title}><span className="ranking-no">0{index+1}</span><div className="ranking-copy"><strong>{item.title}</strong><small>{item.detail}</small><div className="ranking-track"><i style={{width:`${item.width}%`}}/></div></div><div className="ranking-value"><strong>{item.engagement}</strong><small>{item.reach} reach</small></div></div>)}
      </section>
      <section className="panel insights-details"><div className="panel-heading"><div><p className="eyebrow">SMART INSIGHT</p><h2>Šta Autopilot menja sledeće</h2></div><Sparkles size={20}/></div>
        <div className="signal-grid"><div><span>HERO weight</span><strong>↑</strong></div><div><span>Lunch content</span><strong>↑</strong></div><div><span>Repeat penalty</span><strong>ON</strong></div><div><span>Promo mix</span><strong>20%</strong></div></div>
        <div className="insights-note"><strong>Zaključak iz demo rezultata</strong><span>Pizza dobija premium slot, Carbonara ostaje jak lunch signal, ali isti proizvod se ne ponavlja uzastopno. Sledeća nedelja ostaje raznovrsna.</span></div>
      </section>
    </div>
  </div>
}

function DemoSettings() {
  return <><header className="page-header wow-simple-header"><div><p className="eyebrow">AUTOPILOT SETUP</p><h1>Podešavanja marketinga.</h1><p className="muted">Lokacija, ton, cilj i discovery strategija. Logo i boje su jasno izdvojeni u Brend.</p></div><div className="setup-score"><span>Setup score</span><strong>100%</strong></div></header><div className="settings-demo-grid"><div className="panel demo-setting"><MapPin size={20} /><div><strong>Lokalni discovery</strong><span>Vračar · Beograd · Serbia</span><small>#BeogradFood · #GdeJestiBeograd · #VracarFood</small></div></div><div className="panel demo-setting"><Hash size={20} /><div><strong>Hashtag strategija</strong><span>Smart — relevantnost pre spama</span><small>Brend + lokalno + jelo/niša + širi relevantan signal</small></div></div><div className="panel demo-setting"><Instagram size={20} /><div><strong>Instagram</strong><span>@bellanapoli</span><small>platform-specific copy + discovery</small></div></div><div className="panel demo-setting"><Facebook size={20} /><div><strong>Facebook</strong><span>Bella Napoli Beograd</span><small>čist lokalni tekst i CTA</small></div></div></div></>
}
