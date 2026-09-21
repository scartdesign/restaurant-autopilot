import { Bell, CalendarDays, CheckCircle2, ChevronRight, Instagram, Rocket, Sparkles, Star, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import type { MenuItem, Post, Restaurant } from '../types'
import { RestorappLogo } from './RestorappLogo'

type NavTarget='dashboard'|'menu'|'publish'|'settings'|'billing'|'creative'|'promotions'|'insights'|'notifications'

export function RestorappDashboardV2({
  restaurant,
  menuItems,
  posts,
  demo=false,
  heroImage,
  onCreate,
  onNavigate,
  onFirstWeek,
}:{
  restaurant:Restaurant
  menuItems:MenuItem[]
  posts:Post[]
  demo?:boolean
  heroImage?:string|null
  onCreate?:()=>void
  onNavigate?:(target:NavTarget)=>void
  onFirstWeek?:()=>Promise<{ok:boolean;created?:boolean;existing?:boolean;posts?:number;blocked?:boolean}>
}){
  const[firstWeekWorking,setFirstWeekWorking]=useState(false)
  const activeItems=menuItems.filter(item=>item.is_active)
  const approved=posts.filter(post=>post.status==='approved'||post.status==='published').length
  const published=posts.filter(post=>post.status==='published').length
  const scheduled=posts.filter(post=>Boolean(post.scheduled_for)&&post.status!=='published').length
  const sorted=[...posts].sort((a,b)=>Number(b.discovery_score||0)-Number(a.discovery_score||0))
  const topPost=sorted[0]||posts[0]||null
  const topImage=resolveImage(topPost,menuItems)
  const image=heroImage||activeItems.find(item=>item.image_url)?.image_url||topImage||null
  const primaryDish=activeItems[0]||menuItems[0]||null
  const nextStep=!activeItems.length
    ?{title:'Dodaj prvo jelo',text:'To je jedino što Restorappu treba da bi počeo.',label:'Dodaj jelo',kind:'menu' as const}
    :!posts.length
      ?{title:'Napravi prvu nedelju',text:'Restorapp će pripremiti sadržaj i termine za tebe.',label:'Napravi nedelju',kind:'week' as const}
      :approved===0
        ?{title:'Pregledaj sadržaj',text:`${posts.length} predloga je spremno. Odobri ono što ti se sviđa.`,label:'Pregledaj',kind:'content' as const}
        :scheduled===0
          ?{title:'Zakaži objave',text:'Sadržaj je odobren. Sada samo izaberi kada ide napolje.',label:'Zakaži',kind:'publish' as const}
          :published===0
            ?{title:'Sve je spremno',text:'Objave imaju termine. Proveri i pusti Autopilot da radi.',label:'Otvori objave',kind:'publish' as const}
            :{title:'Autopilot radi',text:'Sadržaj je aktivan. Ti samo prati rezultate.',label:'Vidi rezultate',kind:'insights' as const}

  async function startFirstWeek(){
    if(!onFirstWeek||firstWeekWorking)return
    setFirstWeekWorking(true)
    try{await onFirstWeek()}finally{setFirstWeekWorking(false)}
  }

  const stats=demo?[
    {label:'Sadržaj',value:'5',detail:'Spremno ove nedelje',delta:'aktivno',icon:'rating'},
    {label:'Zakazano',value:'4',detail:'Čeka objavu',delta:'spremno',icon:'users'},
    {label:'Meni',value:'5',detail:'Aktivnih jela',delta:'uređeno',icon:'orders'},
  ]:[
    {label:'Sadržaj',value:String(posts.length),detail:'Ove nedelje',delta:posts.length?'spremno':'čeka',icon:'rating'},
    {label:'Zakazano',value:String(scheduled),detail:'Čeka objavu',delta:scheduled?'aktivno':'—',icon:'users'},
    {label:'Meni',value:String(activeItems.length),detail:'Aktivnih jela',delta:activeItems.length?'uređeno':'čeka',icon:'orders'},
  ]

  return <div className="restorapp-dashboard-v2-root">
    <div className="rd2-topbar">
      <div className="rd2-welcome"><span>POČETNA</span><strong>{restaurant.name}</strong><small>{restaurant.neighborhood||restaurant.city||'Tvoj restoran'}</small></div>
      <div className="rd2-top-actions">
        <button className="rd2-bell" onClick={()=>onNavigate?.('notifications')} aria-label="Obaveštenja"><Bell size={19}/><i/></button>
        <button className="rd2-restaurant-pill" onClick={()=>onNavigate?.('settings')}>
          {restaurant.logo_url?<img src={restaurant.logo_url} alt=""/>:<span>{restaurant.name.slice(0,1).toUpperCase()}</span>}
          <div><strong>{restaurant.name}</strong><small>{restaurant.neighborhood||restaurant.city||'Restoran'}</small></div>
          <ChevronRight size={15}/>
        </button>
      </div>
    </div>

    <div className="rd2-layout">
      <div className="rd2-main">
        <section className="rd2-next-step">
          <div className="rd2-next-step-icon">{nextStep.kind==='insights'?<CheckCircle2 size={20}/>:<Rocket size={20}/>}</div>
          <div><span>SLEDEĆI KORAK</span><strong>{nextStep.title}</strong><p>{nextStep.text}</p></div>
          {nextStep.kind==='week'
            ?<button className="rd2-primary" onClick={()=>void startFirstWeek()} disabled={firstWeekWorking}>{firstWeekWorking?'Pripremam…':nextStep.label}<ChevronRight size={15}/></button>
            :<button className="rd2-primary" onClick={()=>onNavigate?.(nextStep.kind==='content'?'dashboard':nextStep.kind)}>{nextStep.label}<ChevronRight size={15}/></button>}
        </section>
        <section className={'rd2-hero '+(image?'has-image':'')} style={image?{backgroundImage:`linear-gradient(90deg,rgba(8,18,14,.96) 0%,rgba(8,18,14,.78) 39%,rgba(8,18,14,.18) 70%),url(${image})`}:undefined}>
          <div className="rd2-hero-copy">
            <span>GOOD AFTERNOON,</span>
            <h1>Time to make<br/><em>today delicious!</em></h1>
            <p>Restorapp pomaže da privučeš više gostiju, napraviš bolji sadržaj i razvijaš restoran — sve na jednom mestu.</p>
            <div className="rd2-hero-actions">
              <button className="rd2-primary" onClick={onCreate}><Sparkles size={17}/> Napravi sadržaj</button>
            </div>
          </div>
          <div className="rd2-hero-script"><span>Great food</span><strong>brings people</strong><em>together</em></div>
        </section>

        <section className="rd2-stats">
          {stats.map((stat,index)=><article key={stat.label}>
            <div className={'rd2-stat-icon s'+index}>{stat.icon==='users'?<CalendarDays size={20}/>:stat.icon==='rating'?<Star size={20}/>:<UtensilsCrossed size={20}/>}</div>
            <div><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></div>
            <b>{stat.delta}</b>
            <div className={'rd2-mini-bars bars-'+index}>{Array.from({length:11}).map((_,i)=><i key={i} style={{height:(7+((i*7+index*5)%19))+'px'}}/>)}</div>
          </article>)}
        </section>

        <section className="rd2-bottom-grid">
          {demo&&<article className="rd2-panel rd2-growth">
            <header><div><h2>Guest growth</h2><span>Više gostiju, veće prilike.</span></div><button>Ovaj mesec <ChevronRight size={13}/></button></header>
            <div className="rd2-growth-chart">
              <svg viewBox="0 0 520 190" preserveAspectRatio="none" aria-hidden="true">
                <defs><linearGradient id="rd2-growth-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#35a46a" stopOpacity=".28"/><stop offset="100%" stopColor="#35a46a" stopOpacity="0"/></linearGradient></defs>
                <path d="M0 162 C48 118,72 142,105 112 S166 88,199 105 S263 68,302 80 S360 48,400 60 S463 38,520 22 L520 190 L0 190 Z" fill="url(#rd2-growth-fill)"/>
                <path d="M0 162 C48 118,72 142,105 112 S166 88,199 105 S263 68,302 80 S360 48,400 60 S463 38,520 22" fill="none" stroke="#2e9f62" strokeWidth="4"/>
                <circle cx="520" cy="22" r="7" fill="#2e9f62" stroke="#fff" strokeWidth="4"/>
              </svg>
              <div className="rd2-growth-bubble"><strong>{demo?'124':Math.max(approved+scheduled,posts.length)}</strong><span>{demo?'+28%':'aktivnosti'}</span></div>
              <div className="rd2-growth-axis"><span>1. Mar</span><span>8. Mar</span><span>15. Mar</span><span>22. Mar</span><span>31. Mar</span></div>
            </div>
          </article>}

          <article className="rd2-panel rd2-toppost-card">
            <header><h2>Top performing post</h2><button onClick={()=>onNavigate?.('insights')}>Prikaži sve <ChevronRight size={13}/></button></header>
            <div className="rd2-toppost-image" style={topImage?{backgroundImage:`url(${topImage})`}:undefined}>
              {!topImage&&<Sparkles size={28}/>}
              <span>{demo?'12.4K reach':topPost?((topPost.discovery_score||0)+' score'):'Čeka rezultate'}</span>
            </div>
            <h3>{topPost?.title||primaryDish?.name||'Tvoj najbolji sadržaj'}</h3>
            <p>{topPost?.caption?.slice(0,90)||'Ovde će se prikazati sadržaj koji ostvaruje najbolje rezultate.'}</p>
            <div className="rd2-post-metrics"><span>♡ {demo?'1.2K':approved*24}</span><span>▢ {demo?'86':posts.length}</span><span>➤ {demo?'24':scheduled}</span></div>
          </article>

          <article className="rd2-panel rd2-quick">
            <header><h2>Brzo</h2></header>
            <button onClick={()=>onNavigate?.('dashboard')}><Sparkles size={17}/><span>Sadržaj</span><ChevronRight size={15}/></button>
            <button onClick={()=>onNavigate?.('publish')}><CalendarDays size={17}/><span>Objave</span><ChevronRight size={15}/></button>
            <button onClick={()=>onNavigate?.('menu')}><UtensilsCrossed size={17}/><span>Meni</span><ChevronRight size={15}/></button>
          </article>
        </section>
      </div>

      <aside className="rd2-mobile-preview">
        <header><div className="rd2-mobile-icon">▯</div><div><strong>Mobile Preview</strong><span>Kako tvoj restoran izgleda gostima.</span></div></header>
        <div className="rd2-phone">
          <div className="rd2-phone-notch"/>
          <div className="rd2-phone-top"><RestorappLogo variant="icon" surface="dark" className="rd2-phone-logo"/><strong>Restorapp</strong><Bell size={15}/></div>
          <div className="rd2-phone-hero" style={image?{backgroundImage:`linear-gradient(180deg,rgba(4,12,9,.08),rgba(4,12,9,.76)),url(${image})`}:undefined}>
            <h3>Good food<br/>great stories</h3><p>Authentic taste.<br/>Real people.<br/>Your restaurant.</p>
          </div>
          <div className="rd2-phone-actions">
            <button><UtensilsCrossed size={18}/><span>View Menu</span></button>
            <button><CalendarDays size={18}/><span>Book a Table</span></button>
            <button><Star size={18}/><span>Reviews</span></button>
            <button><Instagram size={18}/><span>Follow Us</span></button>
          </div>
          <div className="rd2-phone-nav"><b>⌂</b><span>Menu</span><span>Social</span><span>Reserve</span><span>•••</span></div>
        </div>
        <div className="rd2-mobile-script">Same great food.<br/><strong>Everywhere.</strong></div>
      </aside>
    </div>
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
