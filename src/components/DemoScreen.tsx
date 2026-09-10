import { useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, ChefHat, Facebook, Hash, Instagram, MapPin, Megaphone, Search, Settings, Sparkles, UtensilsCrossed, Zap } from 'lucide-react'

type DemoTab = 'content' | 'menu' | 'promotions' | 'settings'

const demoPosts = [
  { type: 'FEED', day: 'ponedeljak, 14. sep', title: 'Pizza Capricciosa', caption: 'Sveže iz peći, taman kada treba. Capricciosa sa mozzarellom, šunkom i pečurkama. Svratite danas.', status: 'approved', score: 94, ig: ['#BellaNapoli','#BeogradFood','#GdeJestiBeograd','#Pizza','#PizzaLovers','#ItalianFood','#Foodstagram'], fb: ['#BellaNapoli','#BeogradFood','#Pizza'], keywords: ['pizza Beograd','italijanski restoran Beograd','Pizza Capricciosa'] },
  { type: 'STORY', day: 'utorak, 15. sep', title: 'Carbonara · Story', caption: 'Kremasta, topla i spremna za ručak. Danas biramo Carbonaru.', status: 'draft', score: 91, ig: ['#BellaNapoli','#BeogradEats','#BeogradFood','#Carbonara','#PastaLovers','#ItalianCuisine'], fb: ['#BellaNapoli','#BeogradEats','#PastaLovers'], keywords: ['carbonara Beograd','pasta Beograd','italijanska kuhinja'] },
  { type: 'FEED', day: 'četvrtak, 17. sep', title: 'Lasagne della casa', caption: 'Jedan dobar razlog da svratite danas. Domaće lazanje, sporo pečene i pune ukusa.', status: 'draft', score: 92, ig: ['#BellaNapoli','#GdeJestiBeograd','#BeogradFood','#Lasagne','#PastaLovers','#ItalianFood'], fb: ['#BellaNapoli','#BeogradFood','#Lasagne'], keywords: ['lazanje Beograd','italijanski restoran','domaće lazanje'] },
  { type: 'PROMO', day: 'subota, 19. sep', title: 'Vikend pasta', caption: '20% popusta na sve paste u petak i subotu od 18h. Rezervišite svoj sto.', status: 'draft', score: 96, ig: ['#BellaNapoli','#BeogradEats','#GdeJestiBeograd','#PastaLovers','#ItalianFood','#VikendBeograd'], fb: ['#BellaNapoli','#BeogradEats','#PastaLovers'], keywords: ['vikend Beograd','pasta akcija','rezervacija restorana'] },
]

const menuItems = [
  ['🍕','Pizza Capricciosa','Pizza','890 RSD'],
  ['🍝','Carbonara','Pasta','940 RSD'],
  ['🥘','Lasagne della casa','Glavno jelo','1.090 RSD'],
  ['🍰','Tiramisu','Desert','520 RSD'],
  ['🥗','Burrata salad','Predjelo','790 RSD'],
]

export function DemoScreen({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<DemoTab>('content')
  const [approved, setApproved] = useState<string[]>(['Pizza Capricciosa'])
  const [toast, setToast] = useState('')

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  return (
    <div className="app-shell demo-shell">
      <aside className="sidebar sidebar-pro">
        <div>
          <div className="brand-mark"><div className="brand-icon"><ChefHat size={21} /></div><span>Restaurant<br /><strong>Autopilot</strong></span></div>
          <div className="restaurant-chip"><div className="avatar">B</div><div><strong>Bella Napoli</strong><small>Beograd · Italijanska</small></div></div>
          <div className="autopilot-status"><span className="live-dot" /> AUTOPILOT ACTIVE</div>
          <nav>
            <button className={tab === 'content' ? 'nav-active' : ''} onClick={() => setTab('content')}><CalendarDays size={18} /> Sadržaj</button>
            <button className={tab === 'menu' ? 'nav-active' : ''} onClick={() => setTab('menu')}><UtensilsCrossed size={18} /> Meni</button>
            <button className={tab === 'promotions' ? 'nav-active' : ''} onClick={() => setTab('promotions')}><Megaphone size={18} /> Akcije</button>
            <button className={tab === 'settings' ? 'nav-active' : ''} onClick={() => setTab('settings')}><Settings size={18} /> Podešavanja</button>
          </nav>
        </div>
        <button className="logout" onClick={onExit}><ArrowLeft size={18} /> Nazad na prijavu</button>
      </aside>

      <main className="main-area">
        <div className="demo-banner"><Sparkles size={14} /> INTERAKTIVNI DEMO · Klikći kroz aplikaciju. Podaci su primer i ništa se ne upisuje u bazu.</div>
        {tab === 'content' && <DemoContent approved={approved} setApproved={setApproved} notify={notify} />}
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
    <header className="page-header dashboard-hero"><div><div className="hero-kicker"><span className="live-dot" /> AUTOPILOT ACTIVE</div><h1>Bella Napoli</h1><p className="muted">Plan, platform-specific tekst, lokalni discovery i odobravanje — na jednom mestu.</p><div className="hero-meta"><span><MapPin size={14} /> Vračar, Beograd</span><span><ChefHat size={14} /> Italijanska</span><span><Hash size={14} /> Smart Discovery</span></div></div><button className="primary hero-action" onClick={() => notify('Nova nedelja je generisana: 5 predloga spremno za pregled.')}><Sparkles size={18} /> Generiši ovu nedelju</button></header>
    <section className="stats-grid stats-grid-pro"><div className="stat-card stat-pro"><span>Aktivna jela</span><strong>12</strong><small>gorivo za sadržaj</small></div><div className="stat-card stat-pro"><span>Predlozi sadržaja</span><strong>5</strong><small>feed · story · promo</small></div><div className="stat-card stat-pro"><span>Odobreno</span><strong>{approved.length}</strong><small>{Math.round((approved.length/4)*100)}% spremno</small></div><div className="stat-card stat-pro discovery-stat"><span>Discovery score</span><strong>93<em>/100</em></strong><small>lokalno + niša + search</small></div></section>
    <section className="discovery-ribbon"><div className="discovery-ribbon-icon"><Zap size={20} /></div><div><strong>Smart Discovery v2</strong><span>Instagram dobija fokusiran set relevantnih tagova; Facebook čist lokalni set. Search keywords se ubacuju prirodno u tekst.</span></div><div className="platform-mini"><span><Instagram size={15} /> IG optimized</span><span><Facebook size={15} /> FB clean</span><span><Search size={15} /> Search ready</span></div></section>
    <section><div className="section-title"><div><p className="eyebrow">CONTENT PLAN</p><h2>Sadržaj ove nedelje</h2></div><span className="engine-badge"><Sparkles size={14} /> Smart Discovery v2</span></div><div className="post-grid post-grid-pro">{demoPosts.map((post) => <article className="post-card post-card-pro" key={post.title}><div className="post-preview post-preview-pro demo-food-preview"><div className="preview-top"><span className="format-badge">{post.type}</span><span className="score-pill">{post.score}<small>/100</small></span></div><div className="preview-brand"><div className="preview-logo"><ChefHat size={20} /></div><div><strong>Bella Napoli</strong><small>{post.title}</small></div></div></div><div className="post-body post-body-pro"><div className="post-meta">{post.day}<span className={`status ${approved.includes(post.title) ? 'approved' : 'draft'}`}>{approved.includes(post.title) ? 'approved' : 'draft'}</span></div><h3>{post.title}</h3><p className="caption-preview">{post.caption}</p><div className="platform-discovery"><div className="platform-row"><div className="platform-label ig"><Instagram size={14} /> Instagram</div><div className="tag-cloud">{post.ig.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="platform-row"><div className="platform-label fb"><Facebook size={14} /> Facebook</div><div className="tag-cloud fb-tags">{post.fb.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="keyword-line"><Search size={13} /><span>{post.keywords.join(' · ')}</span></div></div>{approved.includes(post.title) ? <button className="approved-button full" onClick={() => setApproved(approved.filter(x => x !== post.title))}><CheckCircle2 size={16} /> Spremno</button> : <button className="secondary full" onClick={() => { setApproved([...approved, post.title]); notify('Objava je odobrena.') }}><CheckCircle2 size={16} /> Odobri objavu</button>}</div></article>)}</div></section>
  </>
}

function DemoMenu() {
  return <><header className="page-header"><div><p className="eyebrow">MENI</p><h1>Jela i proizvodi</h1><p className="muted">Svako dobro opisano jelo daje Autopilotu bolji vizual, tekst i discovery.</p></div><button className="primary">+ Dodaj jelo</button></header><div className="menu-demo-grid">{menuItems.map(([emoji,name,category,price]) => <div className="menu-demo-card" key={name}><div className="menu-demo-photo">{emoji}</div><div><span className="menu-category">{category}</span><h3>{name}</h3><p>Fotografija · opis · cena · kategorija</p><strong>{price}</strong></div><span className="menu-active">Aktivno</span></div>)}</div></>
}

function DemoPromotions({ notify }: { notify: (value: string) => void }) {
  return <><header className="page-header"><div><p className="eyebrow">BRZA PROMOCIJA</p><h1>Od akcije do kampanje</h1><p className="muted">Jedan unos pravi platform-specific feed + story verziju.</p></div></header><div className="promo-layout"><div className="panel promo-form"><h2><Megaphone size={20} /> Vikend pasta</h2><label>Glavna poruka<input readOnly value="20% popusta na sve paste" /></label><label>Detalji<textarea readOnly rows={4} value="Petak i subota od 18h. Važi u restoranu." /></label><button className="primary full" onClick={() => notify('Kampanja je napravljena: feed + story + Instagram/Facebook discovery set.')}><Sparkles size={18} /> Napravi promo sadržaj</button></div><aside className="promo-explainer"><p className="eyebrow">CAMPAIGN ENGINE</p><h2>Jedna akcija. Više formata. Bez copy/paste haosa.</h2><p>Autopilot pravi različit tekst, CTA i hashtag strategiju za Instagram i Facebook, uz lokalne search signale.</p><div className="format-cards"><div><strong>1080 × 1350</strong><span>Feed · 4:5</span></div><div><strong>1080 × 1920</strong><span>Story · 9:16</span></div></div></aside></div></>
}

function DemoSettings() {
  return <><header className="page-header settings-header"><div><p className="eyebrow">AUTOPILOT SETUP</p><h1>Podešavanja</h1><p className="muted">Brend, lokalni discovery, cilj i automatizacija.</p></div><div className="setup-score"><span>Discovery setup</span><strong>5/5</strong></div></header><div className="settings-demo-grid"><div className="panel demo-setting"><MapPin size={20} /><div><strong>Lokalni discovery</strong><span>Vračar · Beograd · Serbia</span><small>#BeogradFood · #GdeJestiBeograd · #VracarFood</small></div></div><div className="panel demo-setting"><Hash size={20} /><div><strong>Hashtag strategija</strong><span>Smart — automatski balans</span><small>Brend + lokalno + jelo/niša + 1 širi relevantan tag</small></div></div><div className="panel demo-setting"><Instagram size={20} /><div><strong>Instagram</strong><span>@bellanapoli</span><small>5–8 fokusiranih hashtagova + search keywords</small></div></div><div className="panel demo-setting"><Facebook size={20} /><div><strong>Facebook</strong><span>Bella Napoli Beograd</span><small>2–3 lokalna/brendirana taga, bez hashtag spama</small></div></div></div></>
}
