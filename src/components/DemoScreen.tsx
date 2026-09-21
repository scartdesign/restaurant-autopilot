import { useState, type CSSProperties } from 'react'
import { ArrowLeft, BarChart3, CalendarClock, CalendarDays, CheckCircle2, Clock3, Facebook, Hash, Image as ImageIcon, Instagram, LayoutDashboard, MapPin, Megaphone, MousePointerClick, Palette, Pencil, RefreshCw, Save, Search, Send, Settings, ShieldCheck, Sparkles, Target, TrendingUp, UtensilsCrossed, X, Zap } from 'lucide-react'
import { VisualStudio } from './VisualStudio'
import { BrandKit } from './BrandKit'
import { DemoOwner } from './DemoOwner'
import { RestorappDashboardV2 } from './RestorappDashboardV2'
import { RestorappSidebarLogo } from './RestorappSidebarLogo'
import type { MenuItem, Post, Restaurant } from '../types'

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
          <nav>
            <button className={tab === 'content' ? 'nav-active' : ''} onClick={() => setTab('content')}><CalendarDays size={18} /> Dashboard</button>
            <button className={tab === 'launch' ? 'nav-active launch-nav' : 'launch-nav'} onClick={() => setTab('launch')}><Target size={18} /> Launch Center <span className="nav-beta">READY</span></button>
            <button className={tab === 'studio' ? 'nav-active' : ''} onClick={() => setTab('studio')}><ImageIcon size={18} /> Visual Studio</button>
            <button className={tab === 'brand' ? 'nav-active brand-nav' : 'brand-nav'} onClick={() => setTab('brand')}><Palette size={18} /> Brend <span className="nav-beta">LOGO</span></button>
            <button className={tab === 'publish' ? 'nav-active' : ''} onClick={() => setTab('publish')}><Send size={18} /> Social Media</button>
            <button className={tab === 'insights' ? 'nav-active insights-nav' : 'insights-nav'} onClick={() => setTab('insights')}><BarChart3 size={18} /> Analytics <span className="nav-beta">DATA</span></button>
            <button className={tab === 'menu' ? 'nav-active' : ''} onClick={() => setTab('menu')}><UtensilsCrossed size={18} /> Menu & Offers</button>
            <button className={tab === 'promotions' ? 'nav-active' : ''} onClick={() => setTab('promotions')}><Megaphone size={18} /> Campaigns</button>
            <button className={tab === 'settings' ? 'nav-active' : ''} onClick={() => setTab('settings')}><Settings size={18} /> Podešavanja</button>
            <button className={tab === 'owner' ? 'nav-active admin-nav' : 'admin-nav'} onClick={() => setTab('owner')}><ShieldCheck size={18} /> OWNER demo <span className="nav-beta">OPS</span></button>
          </nav>
        </div>
        <button className="logout" onClick={onExit}><ArrowLeft size={18} /> Nazad na prijavu</button>
      </aside>

      <main className="main-area">
        <div className="restorapp-topbar demo-restorapp-topbar"><div className="restorapp-topbar-copy"><span>Live product demo</span><strong>Bella Napoli</strong><small>Vračar · Beograd · Premium</small></div><div className="restorapp-topbar-actions"><div className="restorapp-profile-chip demo-profile-chip"><img src={demoLogo} alt="Bella Napoli"/><div><strong>Bella Napoli</strong><small>Demo restoran</small></div></div></div></div>
        
        {tab === 'content' && <DemoContent approved={approved} setApproved={setApproved} notify={notify} />}
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

function DemoContent({ approved, setApproved, notify }: { approved: string[]; setApproved: (value: string[]) => void; notify: (value: string) => void }) {
  return <>
    <RestorappDashboardV2
      restaurant={demoRestaurant}
      menuItems={demoMenu}
      posts={demoVisualPosts}
      demo
      heroImage={food.pizza}
      onCreate={()=>notify('Demo: Creative AI je spreman za novi sadržaj.')}
      onNavigate={(target)=>notify(target==='publish'?'Otvaram plan objava.':target==='menu'?'Otvaram meni i ponude.':'Demo akcija je spremna.')}
    />
    <section className="wow-hero wow-demo-hero has-image" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,12,9,.97), rgba(7,12,9,.68) 47%, rgba(7,12,9,.10)), url(${food.pizza})` }}>
      <div className="wow-hero-copy"><div className="hero-kicker"><span className="live-dot" /> AUTOPILOT ACTIVE <b className="auto-week-on">AUTO WEEK ON</b></div><span className="wow-brand-label">BELLA NAPOLI</span><h1>Prava italijanska priča u tvom gradu.</h1><p>Fotografije, sadržaj, termini i lokalni discovery — spremni bez svakodnevnog cimanja.</p><div className="wow-hero-actions"><button className="wow-primary" onClick={() => notify('Nova nedelja je generisana: 5 premium predloga sa terminima.')}><Sparkles size={18} /> Kreiraj novi sadržaj</button><div className="wow-hero-meta"><span><MapPin size={14} /> Vračar, Beograd</span><span><Hash size={14} /> Smart Discovery</span></div></div></div>
      <div className="wow-score-card"><div><TrendingUp size={19} /><span>Discovery score</span></div><strong>94<small>/100</small></strong><p>plan + vreme + vizual spremni</p></div>
    </section>

    <section className="wow-kpi-grid"><DemoKpi label="Nedeljni sadržaj" value="5" detail="3 feed · 1 story · 1 promo" /><DemoKpi label="Spremno" value={`${approved.length}/4`} detail="odobreno za objavu" /><DemoKpi label="Sledeća objava" value="18:30" detail="ponedeljak · Feed" /><DemoKpi label="Discovery" value="94" detail="local + niche + search" /></section>

    <section className="wow-week panel wow-demo-week"><div className="wow-panel-head"><div><p className="eyebrow">NEDELJNI PLAN</p><h2>Sadržaj koji već čeka</h2></div><button className="small-ghost" onClick={() => notify('Kompletan raspored je u Publish Centeru.')}>Pogledaj raspored →</button></div><div className="wow-week-strip">{demoPosts.map((post) => <div className="wow-day" key={post.title}><div className="wow-day-image has-photo" style={{ backgroundImage: `url(${post.image})` }}><span>{post.type}</span>{approved.includes(post.title) && <i><CheckCircle2 size={14} /></i>}</div><strong>{post.day}</strong><span className="demo-time-pill"><Clock3 size={11} /> {post.time}</span><p>{post.title}</p></div>)}</div></section>

    <section className="autopilot-preflight panel ready">
      <div className="preflight-head"><div className="preflight-icon"><CheckCircle2 size={20}/></div><div><p className="eyebrow">AUTO WEEK PREFLIGHT</p><h2>Spreman za generisanje</h2><span>Ciljna nedelja: 14.09.2026. · paket, meni, radno vreme i kvota su provereni.</span></div><button className="secondary preflight-refresh" onClick={()=>notify('Demo preflight: svi blocker uslovi su prošli.')}><CheckCircle2 size={13}/> Proveri sada</button></div>
      <div className="preflight-checks"><span className="ok"><CheckCircle2 size={11}/> Aktivan paket</span><span className="ok"><CheckCircle2 size={11}/> Aktivna jela</span><span className="ok"><CheckCircle2 size={11}/> HERO jelo</span><span className="ok"><CheckCircle2 size={11}/> 75% fotografija</span><span className="ok"><CheckCircle2 size={11}/> Radno vreme</span><span className="ok"><CheckCircle2 size={11}/> Generation quota</span></div>
    </section>

    <section className="autopilot-health panel">
      <div className="autopilot-health-score"><span>100<small>%</small></span><div><p className="eyebrow">AUTOPILOT HEALTH</p><h2>Spreman za automatizaciju</h2><p>Svi ključni uslovi za automatsku nedelju su spremni.</p></div></div>
      <div className="autopilot-health-checks"><span className="ok"><CheckCircle2 size={12}/> Auto week</span><span className="ok"><CheckCircle2 size={12}/> Quota OK</span><span className="ok"><CheckCircle2 size={12}/> 3+ jela</span><span className="ok"><CheckCircle2 size={12}/> HERO</span><span className="ok"><CheckCircle2 size={12}/> 70% fotografija</span><span className="ok"><CheckCircle2 size={12}/> Radno vreme</span></div>
    </section>

    {approved.length<demoPosts.length&&<section className="review-queue-bar panel"><div><span><CheckCircle2 size={16}/> REVIEW QUEUE</span><strong>{demoPosts.length-approved.length} drafta čekaju proveru</strong><small>Quality gate proverava copy, CTA, discovery, fotografiju i platform verzije.</small></div><button className="primary" onClick={()=>{setApproved(demoPosts.map(post=>post.title));notify('Demo review: svi draftovi su prošli quality gate i odobreni su.')}}><CheckCircle2 size={15}/> Proveri + odobri sve</button></section>}

    <section className="autopilot-activity panel">
      <div className="activity-head"><div><p className="eyebrow">AUTOPILOT ACTIVITY</p><h2>Šta je sistem uradio</h2></div><Clock3 size={19}/></div>
      <div className="activity-list"><article><span className="activity-dot"/><div><strong>AUTO WEEK je napravio plan</strong><p>4 objave · HERO fokus · learned time aktivan.</p><small>pre 8 min</small></div></article><article><span className="activity-dot"/><div><strong>Nedeljni review je završen</strong><p>2 odobreno · 2 ostavljeno za proveru.</p><small>pre 5 min</small></div></article><article><span className="activity-dot"/><div><strong>AI slike su generisane</strong><p>3/3 fotografije uspešno napravljene.</p><small>pre 2 dana</small></div></article><article><span className="activity-dot"/><div><strong>Performance rezultati su uvezeni</strong><p>4 reda su osvežila learning signal.</p><small>pre 3 dana</small></div></article></div>
    </section>

    <section className="week-quality-panel panel demo-week-quality">
      <div className="week-quality-score"><span className="week-quality-ring" style={{ '--quality': 94 } as CSSProperties}><strong>94</strong><small>/100</small></span><div><p className="eyebrow">WEEK QUALITY</p><h2>Odličan plan</h2><span>4 različita jela, HERO prisutan bez preteranog ponavljanja i svaki post ima termin.</span></div></div>
      <div className="week-quality-metrics"><div><strong>4</strong><span>različita jela</span></div><div><strong>1</strong><span>HERO objava</span></div><div><strong>4/4</strong><span>sa terminom</span></div><div><strong>3</strong><span>formata</span></div></div>
    </section>

    <section className="discovery-ribbon discovery-ribbon-wow"><div className="discovery-ribbon-icon"><Zap size={20} /></div><div><strong>Smart Discovery</strong><span>Instagram dobija fokusiran set, Facebook čist lokalni set, a search keywords prate konkretno jelo i lokaciju.</span></div><div className="platform-mini"><span><Instagram size={15} /> IG optimized</span><span><Facebook size={15} /> FB clean</span><span><Search size={15} /> Search ready</span></div></section>

    <section className="content-section wow-content-section"><div className="section-title"><div><p className="eyebrow">CONTENT LIBRARY</p><h2>Spremne objave</h2></div><span className="engine-badge"><Sparkles size={14} /> Design + Schedule + Discovery</span></div><div className="post-grid post-grid-pro wow-post-grid">{demoPosts.map((post) => <article className="post-card post-card-pro wow-post-card" key={post.title}><div className="post-preview post-preview-pro wow-post-preview has-photo" style={{ backgroundImage: `linear-gradient(180deg, rgba(7,12,9,.03), rgba(7,12,9,.76)), url(${post.image})` }}><div className="preview-top"><span className="format-badge">{post.type}</span><span className="score-pill">{post.score}<small>/100</small></span></div><div className="preview-brand"><img className="wow-card-logo" src={demoLogo} alt="" /><div><strong>Bella Napoli</strong><small>{post.title}</small></div></div><div className="wow-card-art-copy"><span className="wow-card-price">{post.type === 'PROMO' ? '-20%' : post.title === 'Pizza Capricciosa' ? '890 RSD' : 'CHEF PICK'}</span><h3>{post.title}</h3><span className="wow-card-cta">Rezerviši sto →</span></div></div><div className="post-body post-body-pro"><div className="post-meta"><span>{post.day} · <b className="post-time-strong"><Clock3 size={11} /> {post.time}</b></span><span className={`status ${approved.includes(post.title) ? 'approved' : 'draft'}`}>{approved.includes(post.title) ? 'approved' : 'draft'}</span></div><h3>{post.title}</h3><p className="caption-preview">{post.caption}</p><div className="platform-discovery"><div className="platform-row"><div className="platform-label ig"><Instagram size={14} /> Instagram</div><div className="tag-cloud">{post.ig.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="platform-row"><div className="platform-label fb"><Facebook size={14} /> Facebook</div><div className="tag-cloud fb-tags">{post.fb.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="keyword-line"><Search size={13} /><span>{post.keywords.join(' · ')}</span></div></div>{approved.includes(post.title) ? <button className="approved-button full" onClick={() => setApproved(approved.filter(x => x !== post.title))}><CheckCircle2 size={16} /> Spremno</button> : <button className="secondary full" onClick={() => { setApproved([...approved, post.title]); notify('Objava je odobrena.') }}><CheckCircle2 size={16} /> Odobri objavu</button>}</div></article>)}</div></section>
  </>
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
  const [times, setTimes] = useState<Record<string, string>>(() => Object.fromEntries(demoPosts.map((post) => [post.title, post.time])))
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState('')
  const [metaJobs,setMetaJobs]=useState<Record<string,DemoMetaJobs>>({
    'Pizza Capricciosa':{facebook:'queued',instagram:'queued'},
    'Sveža Carbonara':{facebook:'published',instagram:'published'},
    'Tiramisu':{facebook:'idle',instagram:'failed'},
    'Vikend pasta':{facebook:'idle',instagram:'idle'},
  })

  function begin(title: string) { setEditing(title); setDraft(times[title] || '18:30') }
  function save(title: string) {
    setTimes({ ...times, [title]: draft })
    setEditing('')
    notify(`Termin za ${title} je sačuvan u ${draft}. Meta queue bi automatski pratio novi termin.`)
  }
  function setJob(title:string,platform:'facebook'|'instagram',status:DemoMetaStatus){
    setMetaJobs(current=>({...current,[title]:{...(current[title]||{facebook:'idle',instagram:'idle'}),[platform]:status}}))
  }
  function queueMeta(title:string){
    setMetaJobs(current=>({...current,[title]:{facebook:'queued',instagram:'queued'}}))
    notify(`Demo: ${title} je zakazan za Facebook + Instagram.`)
  }
  function publishMeta(title:string){
    setMetaJobs(current=>({...current,[title]:{facebook:'published',instagram:'published'}}))
    notify(`Demo: ${title} je objavljen na Facebook + Instagram.`)
  }
  function cancelMeta(title:string){
    setMetaJobs(current=>({...current,[title]:{facebook:'idle',instagram:'idle'}}))
    notify(`Demo: Meta zakazivanje za ${title} je otkazano.`)
  }

  return <>
    <header className="page-header wow-simple-header"><div><p className="eyebrow">PUBLISH CENTER</p><h1>Tačan dan. Tačno vreme.</h1><p className="muted">Autopilot predlaže termin, a Meta queue može da objavi i kada aplikacija nije otvorena.</p></div><button className="primary" onClick={() => notify('Demo kalendar je spreman sa datumima i vremenima.')}><CalendarClock size={17} /> Export kalendara</button></header>

    <section className="meta-connect-panel connected demo-meta-connected">
      <div className="meta-connect-brand"><div><Facebook size={20}/><Instagram size={20}/></div><span><small>META PUBLISHING · DEMO</small><strong>Facebook + Instagram povezani</strong><p>Bella Napoli Beograd · @bellanapoli · token server-side · queue proverava objave svakih 5 min</p></span></div>
      <div className="meta-connect-actions"><span className="meta-connected-chip"><CheckCircle2 size={14}/> CONNECTED</span><button className="secondary" onClick={()=>notify('Demo: Meta konekcija je proverena. Page i Instagram profesionalni nalog su dostupni.')}><CheckCircle2 size={14}/> Proveri konekciju</button></div>
    </section>

    <section className="publish-gate ready"><div className="publish-gate-icon"><CheckCircle2 size={20}/></div><div><span>WEEK GATE</span><strong>Spremno za publishing</strong><small>Nema tehničkih blokera: termini, approval i Meta konekcija su spremni.</small></div><b>1/4</b></section>
    <div className="demo-next-time"><div><Clock3 size={22} /></div><span>SLEDEĆA OBJAVA<strong>Ponedeljak, 14. septembar · {times['Pizza Capricciosa']}</strong><small>FEED · Pizza Capricciosa · FB + IG queued</small></span></div>

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
              return <span className={`meta-job-chip ${status}`} key={platform}><b>{platform==='facebook'?'FB':'IG'}</b> {status}{status==='queued'&&<small>{times[post.title]}</small>}{status==='failed'&&<button onClick={()=>{setJob(post.title,platform,'published');notify(`Demo: ${platform==='facebook'?'Facebook':'Instagram'} retry je uspeo.`)}}>Retry</button>}</span>
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
          {approved&&<button className="mini-meta-now" onClick={()=>publishMeta(post.title)}><Send size={13}/> Meta sada</button>}
          {approved&&!hasQueued&&<button className="mini-meta-queue" onClick={()=>queueMeta(post.title)}><CalendarClock size={13}/> Zakaži Meta</button>}
          {hasQueued&&<button className="meta-disconnect demo-cancel-meta" onClick={()=>cancelMeta(post.title)}>Otkaži Meta</button>}
        </div>
      </div>
    })}</div>

    <div className="meta-roadmap"><div><Send size={18}/><div><strong>Background publishing simulacija je aktivna</strong><span>Demo prikazuje connected nalog, queue, publish, cancel i retry. U produkciji se tokeni čuvaju u Vault-u i queue radi server-side.</span></div></div><span className="roadmap-badge">META CONNECTED</span></div>
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
