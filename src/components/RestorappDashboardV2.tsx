import { BarChart3, CalendarDays, ChevronRight, Image as ImageIcon, Instagram, Facebook, Search, Sparkles, TrendingUp, UtensilsCrossed, WandSparkles } from 'lucide-react'
import type { MenuItem, Post, Restaurant } from '../types'

type NavTarget='menu'|'publish'|'settings'|'billing'

export function RestorappDashboardV2({
  restaurant,
  menuItems,
  posts,
  demo=false,
  heroImage,
  onCreate,
  onNavigate,
}:{
  restaurant:Restaurant
  menuItems:MenuItem[]
  posts:Post[]
  demo?:boolean
  heroImage?:string|null
  onCreate?:()=>void
  onNavigate?:(target:NavTarget)=>void
}){
  const activeItems=menuItems.filter(item=>item.is_active)
  const approved=posts.filter(post=>post.status==='approved'||post.status==='published').length
  const scheduled=posts.filter(post=>Boolean(post.scheduled_for)&&post.status!=='published').length
  const averageDiscovery=posts.length?Math.round(posts.reduce((sum,post)=>sum+Number(post.discovery_score||0),0)/posts.length):0
  const sorted=[...posts].sort((a,b)=>Number(b.discovery_score||0)-Number(a.discovery_score||0))
  const topPost=sorted[0]||posts[0]||null
  const topImage=resolveImage(topPost,menuItems)
  const image=heroImage||activeItems.find(item=>item.image_url)?.image_url||topImage||null
  const upcoming=[...posts].filter(post=>post.status!=='rejected').sort((a,b)=>new Date(a.scheduled_for||0).getTime()-new Date(b.scheduled_for||0).getTime()).slice(0,4)

  const stats=demo?[
    {label:'Novi gosti',value:'+48',detail:'ove nedelje',delta:'+12%'},
    {label:'Ukupan reach',value:'12.4K',detail:'ove nedelje',delta:'+28%'},
    {label:'Prosečna ocena',value:'4.8',detail:'ovog meseca',delta:'+0.3'},
    {label:'Online akcije',value:'+32',detail:'ove nedelje',delta:'+18%'},
  ]:[
    {label:'Aktivna jela',value:String(activeItems.length),detail:'u meniju',delta:activeItems.length>=3?'spremno':'dodaj još'},
    {label:'Planirane objave',value:String(scheduled),detail:'u redu čekanja',delta:posts.length?posts.length+' ukupno':'nov plan'},
    {label:'Spremno',value:String(approved),detail:'odobreno / objavljeno',delta:posts.length?Math.round(approved/Math.max(1,posts.length)*100)+'%':'0%'},
    {label:'Discovery',value:averageDiscovery?String(averageDiscovery):'—',detail:'prosek sadržaja',delta:averageDiscovery>=80?'odlično':averageDiscovery?'aktivno':'čeka'},
  ]

  return <div className="restorapp-dashboard-v2-root">
    <div className="rd2-topbar">
      <label className="rd2-search"><Search size={18}/><input aria-label="Pretraga" placeholder="Pretraži sadržaj, ideje, kampanje…" /></label>
      <div className="rd2-restaurant-pill">
        {restaurant.logo_url?<img src={restaurant.logo_url} alt=""/>:<span>{restaurant.name.slice(0,1).toUpperCase()}</span>}
        <div><strong>{restaurant.name}</strong><small>{restaurant.neighborhood||restaurant.city||'Restoran'}</small></div>
      </div>
    </div>

    <section className={'rd2-hero '+(image?'has-image':'')} style={image?{backgroundImage:`linear-gradient(90deg,rgba(251,246,236,.98) 0%,rgba(251,246,236,.93) 39%,rgba(251,246,236,.14) 66%),url(${image})`}:undefined}>
      <div className="rd2-hero-copy">
        <span>PLAN ZA OVU NEDELJU</span>
        <h1>Pametniji sadržaj.<br/><em>Više gostiju.</em></h1>
        <p>Restorapp planira, kreira i priprema sadržaj dok se ti baviš restoranom.</p>
        <div className="rd2-hero-actions">
          <button className="rd2-primary" onClick={onCreate}><Sparkles size={17}/> Kreiraj novi sadržaj <ChevronRight size={16}/></button>
          <button className="rd2-secondary" onClick={()=>onNavigate?.('publish')}>Pogledaj plan</button>
        </div>
      </div>
      <div className="rd2-hero-note"><span>Autentični ukusi.</span><strong>Stvarni ljudi.</strong><em>Veće priče.</em></div>
    </section>

    <section className="rd2-stats">
      {stats.map((stat,index)=><article key={stat.label}>
        <div className="rd2-stat-icon">{index===0?<TrendingUp size={18}/>:index===1?<BarChart3 size={18}/>:index===2?<Sparkles size={18}/>:<CalendarDays size={18}/>}</div>
        <div><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></div>
        <b>{stat.delta}</b>
      </article>)}
    </section>

    <section className="rd2-grid">
      <article className="rd2-card rd2-creative">
        <header><div><span>CREATIVE AI</span><h2>Kreiraj sadržaj koji izgleda kao restoran.</h2></div><button onClick={()=>onNavigate?.('menu')}>Meni <ChevronRight size={15}/></button></header>
        <div className="rd2-thumbs">
          {(activeItems.length?activeItems.slice(0,4):menuItems.slice(0,4)).map(item=><div key={item.id} className="rd2-thumb">
            {item.image_url?<img src={item.image_url} alt=""/>:<span><UtensilsCrossed size={20}/></span>}
            <strong>{item.name}</strong><small>{item.category||'Jelo'}</small>
          </div>)}
          {!menuItems.length&&<div className="rd2-empty-mini"><ImageIcon size={22}/><span>Dodaj fotografije jela</span></div>}
        </div>
        <button className="rd2-prompt" onClick={onCreate}><WandSparkles size={17}/><span>Opiši šta želiš da kreiraš…</span><b>Generiši vizual</b></button>
      </article>

      <article className="rd2-card rd2-publish">
        <header><div><span>PUBLISH CENTER</span><h2>Planirani sadržaj</h2></div><button onClick={()=>onNavigate?.('publish')}>Prikaži sve <ChevronRight size={15}/></button></header>
        <div className="rd2-post-list">
          {upcoming.length?upcoming.map((post,index)=>{
            const postImage=resolveImage(post,menuItems)
            return <div className="rd2-post-row" key={post.id}>
              {postImage?<img src={postImage} alt=""/>:<span className="rd2-post-fallback"><Sparkles size={15}/></span>}
              <div><strong>{post.title||'Nova objava'}</strong><small>{post.scheduled_for?formatDate(post.scheduled_for,restaurant.timezone):'Bez termina'}</small></div>
              <span className={'rd2-network '+(index%2?'fb':'ig')}>{index%2?<Facebook size={15}/>:<Instagram size={15}/>}</span>
              <b className={'rd2-status '+post.status}>{statusLabel(post.status)}</b>
            </div>
          }):<div className="rd2-empty-list"><Sparkles size={20}/><span>Nema planiranih objava.</span></div>}
        </div>
      </article>

      <article className="rd2-card rd2-results">
        <header><div><span>REZULTATI I UVIDI</span><h2>{demo?'28.6K':(averageDiscovery?averageDiscovery+'/100':'Nema podataka')}</h2></div><small>{demo?'Poslednjih 30 dana':'Discovery signal'}</small></header>
        <div className="rd2-chart">
          <svg viewBox="0 0 360 130" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="rd2fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2f8b57" stopOpacity=".28"/><stop offset="100%" stopColor="#2f8b57" stopOpacity="0"/></linearGradient></defs>
            <path d="M0 110 C28 94,42 82,68 88 S105 62,132 70 S172 48,198 58 S235 36,260 44 S310 24,360 12 L360 130 L0 130 Z" fill="url(#rd2fill)"/>
            <path d="M0 110 C28 94,42 82,68 88 S105 62,132 70 S172 48,198 58 S235 36,260 44 S310 24,360 12" fill="none" stroke="#2f8b57" strokeWidth="3"/>
          </svg>
          <div className="rd2-axis"><span>1. ned</span><span>2. ned</span><span>3. ned</span><span>4. ned</span></div>
        </div>
        <div className="rd2-toppost">
          {topImage?<img src={topImage} alt=""/>:<span><Sparkles size={18}/></span>}
          <div><small>Najuspešniji sadržaj</small><strong>{topPost?.title||'Čeka prve rezultate'}</strong><span>{demo?'12.4K dometa · 1.2K reakcija':topPost?((topPost.discovery_score||0)+' discovery score'):'Objavi prvi sadržaj'}</span></div>
          <ChevronRight size={16}/>
        </div>
      </article>
    </section>
  </div>
}

function resolveImage(post:Post|null|undefined,items:MenuItem[]){
  if(!post)return null
  const design=post.generation_meta?.visual_design?.image_url
  if(typeof design==='string'&&design)return design
  const meta=post.generation_meta?.image_url
  if(typeof meta==='string'&&meta)return meta
  return items.find(item=>item.id===post.menu_item_id)?.image_url||null
}
function formatDate(value:string,timeZone?:string|null){
  try{return new Intl.DateTimeFormat('sr-Latn-RS',{timeZone:timeZone||'Europe/Belgrade',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
  catch{return new Date(value).toLocaleString('sr-RS')}
}
function statusLabel(status:Post['status']){
  if(status==='approved')return 'Spremno'
  if(status==='published')return 'Objavljeno'
  if(status==='rejected')return 'Odbijeno'
  return 'U pripremi'
}
