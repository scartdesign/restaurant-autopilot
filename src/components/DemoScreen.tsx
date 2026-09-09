import { ArrowLeft, CalendarDays, CheckCircle2, ChefHat, Megaphone, Settings, Sparkles, UtensilsCrossed } from 'lucide-react'

const demoPosts = [
  { type: 'FEED', day: 'ponedeljak, 14. sep', title: 'Pizza Capricciosa', caption: 'Sveže iz peći, taman kada treba. Capricciosa sa mozzarellom, šunkom i pečurkama. Svratite danas.', status: 'approved' },
  { type: 'STORY', day: 'utorak, 15. sep', title: 'Carbonara · Story', caption: 'Kremasta, topla i spremna za ručak. Danas biramo Carbonaru.', status: 'draft' },
  { type: 'FEED', day: 'četvrtak, 17. sep', title: 'Lasagne della casa', caption: 'Jedan dobar razlog da svratite danas. Domaće lazanje, sporo pečene i pune ukusa.', status: 'draft' },
  { type: 'PROMO', day: 'subota, 19. sep', title: 'Vikend pasta', caption: '20% popusta na sve paste u petak i subotu od 18h. Rezervišite svoj sto.', status: 'draft' },
]

export function DemoScreen({ onExit }: { onExit: () => void }) {
  return (
    <div className="app-shell demo-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-mark"><ChefHat size={24} /><span>Restaurant<br /><strong>Autopilot</strong></span></div>
          <div className="restaurant-chip"><div className="avatar">B</div><div><strong>Bella Napoli</strong><small>Demo restoran</small></div></div>
          <nav>
            <button className="nav-active"><CalendarDays size={18} /> Sadržaj</button>
            <button><UtensilsCrossed size={18} /> Meni</button>
            <button><Megaphone size={18} /> Akcije</button>
            <button><Settings size={18} /> Podešavanja</button>
          </nav>
        </div>
        <button className="logout" onClick={onExit}><ArrowLeft size={18} /> Nazad</button>
      </aside>
      <main className="main-area">
        <div className="demo-banner">DEMO · Ovako vlasnik restorana vidi svoju marketinšku nedelju.</div>
        <header className="page-header"><div><p className="eyebrow">DOBRO DOŠLI</p><h1>Bella Napoli</h1><p className="muted">Jedna tabla za celu marketinšku nedelju.</p></div><button className="primary"><Sparkles size={18} /> Generiši ovu nedelju</button></header>
        <section className="stats-grid"><div className="stat-card"><span>Aktivna jela</span><strong>12</strong></div><div className="stat-card"><span>Predlozi sadržaja</span><strong>5</strong></div><div className="stat-card"><span>Odobreno</span><strong>1</strong></div></section>
        <section><div className="section-title"><div><p className="eyebrow">CONTENT PLAN</p><h2>Sadržaj ove nedelje</h2></div><span className="engine-badge"><Sparkles size={14} /> Smart engine v1</span></div>
          <div className="post-grid">{demoPosts.map((post) => <article className="post-card" key={post.title}><div className="post-preview demo-preview"><span>{post.type}</span><ChefHat size={34} /></div><div className="post-body"><div className="post-meta">{post.day}<span className={`status ${post.status}`}>{post.status}</span></div><h3>{post.title}</h3><p>{post.caption}</p><div className="hashtags">#BellaNapoli #Beograd #restoran #italijanska</div>{post.status === 'approved' ? <div className="approved-line"><CheckCircle2 size={17} /> Odobreno</div> : <button className="secondary full"><CheckCircle2 size={17} /> Odobri</button>}</div></article>)}</div>
        </section>
      </main>
    </div>
  )
}
