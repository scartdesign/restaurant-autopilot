import { useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, ChefHat, Facebook, Hash, Image as ImageIcon, Instagram, MapPin, Megaphone, Palette, Search, Send, Settings, Sparkles, TrendingUp, UtensilsCrossed, Zap } from 'lucide-react'
import { VisualStudio } from './VisualStudio'
import { BrandKit } from './BrandKit'
import type { MenuItem, Post, Restaurant } from '../types'

type DemoTab = 'content' | 'studio' | 'brand' | 'publish' | 'menu' | 'promotions' | 'settings'

const food = {
  pizza: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1500&q=88',
  pasta: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=88',
  tiramisu: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=88',
  salad: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=88',
  lasagna: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=1200&q=88',
}

const demoLogo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="42" fill="#ffffff"/><circle cx="100" cy="100" r="72" fill="#173a2b"/><path d="M58 113c21-46 63-58 88-28-14 0-25 8-31 22 17-7 31-3 39 8-28 28-72 29-96-2Z" fill="#e7c35f"/><text x="100" y="78" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="700" fill="#fff">BN</text></svg>')}`

const demoPosts = [
  { type: 'FEED', day: 'pon, 14. sep', title: 'Pizza Capricciosa', caption: 'Veče zaslužuje nešto posebno. Capricciosa iz peći, sa mozzarellom, šunkom i pečurkama.', status: 'approved', score: 94, image: food.pizza, ig: ['#BellaNapoli','#BeogradFood','#GdeJestiBeograd','#PizzaLovers','#ItalianFood'], fb: ['#BellaNapoli','#BeogradFood','#Pizza'], keywords: ['pizza Beograd','italijanski restoran Beograd'] },
  { type: 'STORY', day: 'uto, 15. sep', title: 'Sveža Carbonara', caption: 'Kremasta, sveža i spremna za ručak. Danas biramo Carbonaru.', status: 'approved', score: 91, image: food.pasta, ig: ['#BellaNapoli','#BeogradEats','#Carbonara','#PastaLovers','#ItalianCuisine'], fb: ['#BellaNapoli','#BeogradEats','#PastaLovers'], keywords: ['carbonara Beograd','pasta Beograd'] },
  { type: 'FEED', day: 'čet, 17. sep', title: 'Tiramisu', caption: 'Espresso, mascarpone i kakao. Klasik koji ne traži objašnjenje.', status: 'draft', score: 93, image: food.tiramisu, ig: ['#BellaNapoli','#BeogradFood','#Tiramisu','#DessertLovers','#ItalianFood'], fb: ['#BellaNapoli','#BeogradFood','#Tiramisu'], keywords: ['tiramisu Beograd','italijanski desert'] },
  { type: 'PROMO', day: 'sub, 19. sep', title: 'Vikend pasta', caption: '20% popusta na paste u petak i subotu od 18h. Rezervišite svoj sto.', status: 'draft', score: 96, image: food.lasagna, ig: ['#BellaNapoli','#GdeJestiBeograd','#PastaLovers','#VikendBeograd'], fb: ['#BellaNapoli','#BeogradEats','#PastaLovers'], keywords: ['vikend Beograd','pasta akcija'] },
]

const demoMenuCards = [
  { name: 'Pizza Capricciosa', category: 'Pizza', price: '890 RSD', image: food.pizza },
  { name: 'Carbonara', category: 'Pasta', price: '940 RSD', image: food.pasta },
  { name: 'Tiramisu', category: 'Desert', price: '520 RSD', image: food.tiramisu },
  { name: 'Sezonska salata', category: 'Predjelo', price: '690 RSD', image: food.salad },
  { name: 'Lasagne della casa', category: 'Glavno jelo', price: '1.090 RSD', image: food.lasagna },
]

const demoRestaurant: Restaurant = {
  id: 'demo-restaurant', owner_id: 'demo', name: 'Bella Napoli', city: 'Beograd', neighborhood: 'Vračar', country: 'Serbia', phone: '+381 11 555 2026', website: 'https://example.com', instagram: '@bellanapoli', facebook: 'Bella Napoli Beograd', cuisine_type: 'Italijanska', brand_style: 'premium', primary_color: '#173a2b', secondary_color: '#e7c35f', logo_url: demoLogo, description: 'Prava italijanska priča u tvom gradu.', target_audience: 'Parovi, porodice i ljubitelji italijanske kuhinje', social_goal: 'reservations', hashtag_mode: 'smart', language: 'sr', tone: 'premium', posting_frequency: 5, reservation_url: 'https://example.com/reservations', onboarding_completed: true,
  default_logo_visible: true, default_logo_position: 'top-right', default_logo_size: 'm', default_logo_badge: 'white', default_overlay_strength: .64,
}

const demoMenu: MenuItem[] = [
  { id: 'demo-pizza', restaurant_id: 'demo-restaurant', name: 'Pizza Capricciosa', description: 'Pelat, mozzarella, šunka, pečurke i masline.', category: 'Pizza', price: 890, currency: 'RSD', image_url: food.pizza, is_active: true },
  { id: 'demo-carbonara', restaurant_id: 'demo-restaurant', name: 'Carbonara', description: 'Guanciale, jaje, pecorino i sveže mleven biber.', category: 'Pasta', price: 940, currency: 'RSD', image_url: food.pasta, is_active: true },
]

const demoVisualPosts: Post[] = [
  { id: 'demo-post', restaurant_id: 'demo-restaurant', content_plan_id: null, menu_item_id: 'demo-pizza', promotion_id: null, post_type: 'feed', scheduled_for: new Date().toISOString(), title: 'Pizza Capricciosa', caption: 'Veče zaslužuje nešto posebno. Capricciosa iz peći, sa mozzarellom, šunkom i pečurkama. Rezervišite svoj sto.', cta: 'Rezerviši sto', hashtags: ['#BellaNapoli','#BeogradFood','#GdeJestiBeograd','#PizzaLovers','#ItalianFood'], visual_brief: 'Premium feed 4:5 sa fotografijom pizze.', status: 'approved', generation_meta: { image_url: food.pizza, engine: 'smart-discovery-v3' }, platform_content: { instagram: { caption: 'Veče zaslužuje nešto posebno.', hashtags: ['#BellaNapoli','#BeogradFood','#GdeJestiBeograd','#PizzaLovers','#ItalianFood'] }, facebook: { caption: 'Capricciosa iz peći. Rezervišite svoj sto.', hashtags: ['#BellaNapoli','#BeogradFood'] } }, discovery_score: 94, seo_keywords: ['pizza Beograd','italijanski restoran Beograd'] },
]

export function DemoScreen({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<DemoTab>('content')
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
          <div className="brand-mark"><div className="brand-icon"><ChefHat size={21} /></div><span>Restaurant<br /><strong>Autopilot</strong></span></div>
          <div className="restaurant-chip"><img className="sidebar-logo" src={demoLogo} alt="" /><div><strong>Bella Napoli</strong><small>Vračar · Beograd</small></div></div>
          <div className="autopilot-status"><span className="live-dot" /> AUTOPILOT ACTIVE</div>
          <nav>
            <button className={tab === 'content' ? 'nav-active' : ''} onClick={() => setTab('content')}><CalendarDays size={18} /> Sadržaj</button>
            <button className={tab === 'studio' ? 'nav-active' : ''} onClick={() => setTab('studio')}><ImageIcon size={18} /> Visual Studio</button>
            <button className={tab === 'brand' ? 'nav-active brand-nav' : 'brand-nav'} onClick={() => setTab('brand')}><Palette size={18} /> Brend <span className="nav-beta">LOGO</span></button>
            <button className={tab === 'publish' ? 'nav-active' : ''} onClick={() => setTab('publish')}><Send size={18} /> Publish Center</button>
            <button className={tab === 'menu' ? 'nav-active' : ''} onClick={() => setTab('menu')}><UtensilsCrossed size={18} /> Meni</button>
            <button className={tab === 'promotions' ? 'nav-active' : ''} onClick={() => setTab('promotions')}><Megaphone size={18} /> Akcije</button>
            <button className={tab === 'settings' ? 'nav-active' : ''} onClick={() => setTab('settings')}><Settings size={18} /> Podešavanja</button>
          </nav>
        </div>
        <button className="logout" onClick={onExit}><ArrowLeft size={18} /> Nazad na prijavu</button>
      </aside>

      <main className="main-area">
        <div className="demo-banner"><Sparkles size={14} /> LIVE MVP DEMO · Brand Kit, Visual Studio i ostali moduli su interaktivni.</div>
        {tab === 'content' && <DemoContent approved={approved} setApproved={setApproved} notify={notify} />}
        {tab === 'studio' && <VisualStudio restaurant={demoRestaurant} posts={demoVisualPosts} menuItems={demoMenu} setNotice={notify} />}
        {tab === 'brand' && <BrandKit restaurant={demoRestaurant} menuItems={demoMenu} onSaved={async () => {}} setNotice={notify} demo />}
        {tab === 'publish' && <DemoPublish notify={notify} />}
        {tab === 'menu' && <DemoMenu />}
        {tab === 'promotions' && <DemoPromotions notify={notify} />}
        {tab === 'settings' && <DemoSettings />}
      </main>
      {toast && <div className="app-toast">{toast}</div>}
    </div>
  )
}

function DemoContent({ approved, setApproved, notify }: { approved: string[]; setApproved: (value: string[]) => void; notify: (value: string) => void }) {
  return <>
    <section className="wow-hero wow-demo-hero has-image" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,12,9,.97), rgba(7,12,9,.68) 47%, rgba(7,12,9,.10)), url(${food.pizza})` }}>
      <div className="wow-hero-copy"><div className="hero-kicker"><span className="live-dot" /> AUTOPILOT ACTIVE</div><span className="wow-brand-label">BELLA NAPOLI</span><h1>Prava italijanska priča u tvom gradu.</h1><p>Fotografije, sadržaj i lokalni discovery — spremni za objavu bez svakodnevnog cimanja.</p><div className="wow-hero-actions"><button className="wow-primary" onClick={() => notify('Nova nedelja je generisana: 5 premium predloga.')}><Sparkles size={18} /> Kreiraj novi sadržaj</button><div className="wow-hero-meta"><span><MapPin size={14} /> Vračar, Beograd</span><span><Hash size={14} /> Smart Discovery</span></div></div></div>
      <div className="wow-score-card"><div><TrendingUp size={19} /><span>Discovery score</span></div><strong>94<small>/100</small></strong><p>+12% u odnosu na prošlu nedelju</p></div>
    </section>

    <section className="wow-kpi-grid"><DemoKpi label="Nedeljni sadržaj" value="5" detail="3 feed · 1 story · 1 promo" /><DemoKpi label="Spremno" value={`${approved.length}/4`} detail="odobreno za objavu" /><DemoKpi label="Photo coverage" value="92%" detail="realne fotografije menija" /><DemoKpi label="Discovery" value="94" detail="local + niche + search" /></section>

    <section className="wow-week panel wow-demo-week"><div className="wow-panel-head"><div><p className="eyebrow">NEDELJNI PLAN</p><h2>Sadržaj koji već čeka</h2></div><button className="small-ghost" onClick={() => notify('Otvoren je kompletan content kalendar.')}>Pogledaj sve →</button></div><div className="wow-week-strip">{demoPosts.map((post) => <div className="wow-day" key={post.title}><div className="wow-day-image has-photo" style={{ backgroundImage: `url(${post.image})` }}><span>{post.type}</span>{approved.includes(post.title) && <i><CheckCircle2 size={14} /></i>}</div><strong>{post.day}</strong><p>{post.title}</p></div>)}</div></section>

    <section className="discovery-ribbon discovery-ribbon-wow"><div className="discovery-ribbon-icon"><Zap size={20} /></div><div><strong>Smart Discovery</strong><span>Instagram dobija fokusiran set, Facebook čist lokalni set, a search keywords prate konkretno jelo i lokaciju.</span></div><div className="platform-mini"><span><Instagram size={15} /> IG optimized</span><span><Facebook size={15} /> FB clean</span><span><Search size={15} /> Search ready</span></div></section>

    <section className="content-section wow-content-section"><div className="section-title"><div><p className="eyebrow">CONTENT LIBRARY</p><h2>Spremne objave</h2></div><span className="engine-badge"><Sparkles size={14} /> Real photo workflow</span></div><div className="post-grid post-grid-pro wow-post-grid">{demoPosts.map((post) => <article className="post-card post-card-pro wow-post-card" key={post.title}><div className="post-preview post-preview-pro wow-post-preview has-photo" style={{ backgroundImage: `linear-gradient(180deg, rgba(7,12,9,.03), rgba(7,12,9,.76)), url(${post.image})` }}><div className="preview-top"><span className="format-badge">{post.type}</span><span className="score-pill">{post.score}<small>/100</small></span></div><div className="preview-brand"><img className="wow-card-logo" src={demoLogo} alt="" /><div><strong>Bella Napoli</strong><small>{post.title}</small></div></div><div className="wow-card-art-copy"><span className="wow-card-price">{post.type === 'PROMO' ? '-20%' : post.title === 'Pizza Capricciosa' ? '890 RSD' : 'CHEF PICK'}</span><h3>{post.title}</h3><span className="wow-card-cta">Rezerviši sto →</span></div></div><div className="post-body post-body-pro"><div className="post-meta">{post.day}<span className={`status ${approved.includes(post.title) ? 'approved' : 'draft'}`}>{approved.includes(post.title) ? 'approved' : 'draft'}</span></div><h3>{post.title}</h3><p className="caption-preview">{post.caption}</p><div className="platform-discovery"><div className="platform-row"><div className="platform-label ig"><Instagram size={14} /> Instagram</div><div className="tag-cloud">{post.ig.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="platform-row"><div className="platform-label fb"><Facebook size={14} /> Facebook</div><div className="tag-cloud fb-tags">{post.fb.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="keyword-line"><Search size={13} /><span>{post.keywords.join(' · ')}</span></div></div>{approved.includes(post.title) ? <button className="approved-button full" onClick={() => setApproved(approved.filter(x => x !== post.title))}><CheckCircle2 size={16} /> Spremno</button> : <button className="secondary full" onClick={() => { setApproved([...approved, post.title]); notify('Objava je odobrena.') }}><CheckCircle2 size={16} /> Odobri objavu</button>}</div></article>)}</div></section>
  </>
}

function DemoKpi({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="wow-kpi"><div className="wow-kpi-icon"><TrendingUp size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }

function DemoMenu() {
  return <><header className="page-header wow-simple-header"><div><p className="eyebrow">MENI</p><h1>Jela koja hrane Autopilot.</h1><p className="muted">Realna fotografija + dobar opis = sadržaj koji izgleda kao pravi restoran, ne kao generičan AI.</p></div><button className="primary">+ Dodaj jelo</button></header><div className="wow-menu-grid">{demoMenuCards.map((item) => <article className="wow-menu-card" key={item.name}><div className="wow-menu-photo" style={{ backgroundImage: `url(${item.image})` }}><span>{item.category}</span></div><div><h3>{item.name}</h3><p>Fotografija visoke rezolucije · aktivno</p><strong>{item.price}</strong></div><span className="menu-active">Aktivno</span></article>)}</div></>
}

function DemoPromotions({ notify }: { notify: (value: string) => void }) {
  return <><header className="page-header wow-simple-header"><div><p className="eyebrow">CAMPAIGN AUTOPILOT</p><h1>Jedna akcija. Cela kampanja.</h1><p className="muted">Feed, story, CTA i discovery iz jednog kratkog unosa.</p></div></header><div className="promo-layout wow-promo-layout"><div className="panel promo-form"><div className="wow-promo-photo" style={{ backgroundImage: `url(${food.pasta})` }} /><h2><Megaphone size={20} /> Vikend pasta</h2><label>Glavna poruka<input readOnly value="20% popusta na sve paste" /></label><label>Detalji<textarea readOnly rows={4} value="Petak i subota od 18h. Važi u restoranu." /></label><button className="primary full" onClick={() => notify('Kampanja je napravljena: feed + story + IG/FB discovery.')}><Sparkles size={18} /> Napravi kampanju</button></div><aside className="promo-explainer wow-promo-explainer"><p className="eyebrow">OUTPUT</p><h2>Od jedne ideje do dva gotova formata.</h2><p>Fotografija ostaje realna, a dizajn, CTA i copy se prilagođavaju platformi.</p><div className="format-cards"><div><strong>1080 × 1350</strong><span>Feed · 4:5</span></div><div><strong>1080 × 1920</strong><span>Story · 9:16</span></div></div></aside></div></>
}

function DemoPublish({ notify }: { notify: (value: string) => void }) {
  return <><header className="page-header wow-simple-header"><div><p className="eyebrow">PUBLISH CENTER</p><h1>Sve spremno. Bez haosa.</h1><p className="muted">Odobri, izvezi i prati šta je objavljeno.</p></div><button className="primary" onClick={() => notify('Demo content kalendar je spreman za export.')}><CalendarDays size={17} /> Export kalendara</button></header><div className="panel wow-publish-demo">{demoPosts.map((post) => <div className="wow-publish-row" key={post.title}><div className="wow-publish-thumb" style={{ backgroundImage: `url(${post.image})` }} /><div><span>{post.day} · {post.type}</span><strong>{post.title}</strong><p>{post.caption}</p></div><span className={`status ${post.status}`}>{post.status}</span></div>)}</div></>
}

function DemoSettings() {
  return <><header className="page-header wow-simple-header"><div><p className="eyebrow">AUTOPILOT SETUP</p><h1>Podešavanja marketinga.</h1><p className="muted">Lokacija, ton, cilj i discovery strategija. Logo i boje su sada jasno izdvojeni u Brend.</p></div><div className="setup-score"><span>Setup score</span><strong>100%</strong></div></header><div className="settings-demo-grid"><div className="panel demo-setting"><MapPin size={20} /><div><strong>Lokalni discovery</strong><span>Vračar · Beograd · Serbia</span><small>#BeogradFood · #GdeJestiBeograd · #VracarFood</small></div></div><div className="panel demo-setting"><Hash size={20} /><div><strong>Hashtag strategija</strong><span>Smart — relevantnost pre spama</span><small>Brend + lokalno + jelo/niša + širi relevantan signal</small></div></div><div className="panel demo-setting"><Instagram size={20} /><div><strong>Instagram</strong><span>@bellanapoli</span><small>platform-specific copy + discovery</small></div></div><div className="panel demo-setting"><Facebook size={20} /><div><strong>Facebook</strong><span>Bella Napoli Beograd</span><small>čist lokalni tekst i CTA</small></div></div></div></>
}
