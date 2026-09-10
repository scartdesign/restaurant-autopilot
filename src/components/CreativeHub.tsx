import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChefHat, ImagePlus, LayoutGrid, Megaphone, RefreshCw, Sparkles, Target, WandSparkles, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Entitlement, MenuItem, Restaurant } from '../types'

type Suggestion = {
  id:string
  type:string
  title:string
  subtitle:string
  reason:string
  menu_item_id:string|null
  menu_item_name:string
  image_url:string|null
  cta:string
  time:string
  recommended_style:string
  platforms:string[]
}

type CreativeStatus = {
  ai_image_ready:boolean
  ai_images_used:number
  ai_images_limit:number|null
  campaign_pack:boolean
  photo_coverage?:number
}

type Collection = 'premium-grid'|'dark-luxe'|'bright-sale'|'clean-menu'|'family'|'lunch'

const collections:{id:Collection;name:string;label:string;description:string}[] = [
  {id:'premium-grid',name:'Premium Food Grid',label:'PREMIUM MENU',description:'Veliki hero + 4 prodajne kartice, kao premium restaurant kampanja.'},
  {id:'dark-luxe',name:'Dark Luxe',label:'LUXURY FOOD',description:'Tamna premium estetika, elegantan kontrast i jak fokus na hranu.'},
  {id:'bright-sale',name:'Bold Offer',label:'DELICIOUS DEALS',description:'Agresivniji prodajni layout za popuste, 2x1 i akcije.'},
  {id:'clean-menu',name:'Clean Menu',label:'FRESH MENU',description:'Čist katalog stil za meni, novu ponudu i sezonska jela.'},
  {id:'family',name:'Family Time',label:'FAMILY TIME',description:'Topliji vizuali za ručak, porodice, društvo i vikend.'},
  {id:'lunch',name:'Lunch Rush',label:'TIME 4 LUNCH',description:'Brza kampanja za ručak sa jasnim CTA i terminom objave.'},
]

export function CreativeHub({ restaurant, menuItems, entitlement, onChanged, setNotice }:{
  restaurant:Restaurant
  menuItems:MenuItem[]
  entitlement:Entitlement|null
  onChanged:()=>Promise<void>
  setNotice:(value:string)=>void
}) {
  const [suggestions,setSuggestions] = useState<Suggestion[]>([])
  const [selectedId,setSelectedId] = useState('')
  const [collection,setCollection] = useState<Collection>('premium-grid')
  const [status,setStatus] = useState<CreativeStatus>({ai_image_ready:false,ai_images_used:0,ai_images_limit:0,campaign_pack:false})
  const [loading,setLoading] = useState(true)
  const [working,setWorking] = useState('')

  const selected = suggestions.find(item=>item.id===selectedId) || suggestions[0]
  const activeItems = useMemo(()=>menuItems.filter(i=>i.is_active),[menuItems])
  const previewItems = useMemo(()=>{
    const first = selected?.menu_item_id ? activeItems.find(i=>i.id===selected.menu_item_id) : undefined
    const rest = activeItems.filter(i=>i.id!==first?.id)
    return [first,...rest].filter(Boolean).slice(0,5) as MenuItem[]
  },[activeItems,selected?.menu_item_id])
  const selectedCollection = collections.find(item=>item.id===collection) || collections[0]
  const campaignFeature = entitlement?.features?.campaign_pack === true || status.campaign_pack

  useEffect(()=>{ void loadAdvisor() },[restaurant.id])
  useEffect(()=>{ if(selected?.recommended_style && collections.some(c=>c.id===selected.recommended_style)) setCollection(selected.recommended_style as Collection) },[selectedId])

  async function loadAdvisor(){
    setLoading(true)
    const {data,error}=await supabase.functions.invoke('creative-engine',{body:{action:'recommend',restaurantId:restaurant.id}})
    if(error) setNotice(error.message)
    else if(data?.error) setNotice(data.error)
    else {
      const list=(data?.suggestions||[]) as Suggestion[]
      setSuggestions(list)
      setSelectedId(current=>current||list[0]?.id||'')
      setStatus({ai_image_ready:Boolean(data?.ai_image_ready),ai_images_used:Number(data?.ai_images_used||0),ai_images_limit:data?.ai_images_limit==null?null:Number(data.ai_images_limit),campaign_pack:Boolean(data?.campaign_pack),photo_coverage:Number(data?.photo_coverage||0)})
    }
    setLoading(false)
  }

  async function generateImage(menuItemId:string,style:Collection=collection){
    setWorking(`image-${menuItemId}`)
    setNotice('AI priprema realističnu fotografiju hrane…')
    const {data,error}=await supabase.functions.invoke('creative-engine',{body:{action:'generate_image',restaurantId:restaurant.id,menuItemId,style}})
    if(error) setNotice(error.message)
    else if(data?.error) setNotice(data.error)
    else {
      setNotice('AI fotografija je napravljena, sačuvana i postavljena na jelo.')
      setStatus(current=>({...current,ai_images_used:Number(data?.ai_images_used??current.ai_images_used)}))
      await onChanged()
      await loadAdvisor()
    }
    setWorking('')
  }

  async function createPack(){
    if(!selected) return
    if(!campaignFeature){ setNotice('Kompletan Campaign Pack je uključen u Pro i Business paket.'); return }
    setWorking('pack')
    setNotice('Autopilot pravi kompletnu kampanju: Feed + Story + ponuda + raspored…')
    const {data,error}=await supabase.functions.invoke('creative-engine',{body:{action:'campaign_pack',restaurantId:restaurant.id,focusType:selected.type,style:collection,timezoneOffsetMinutes:new Date().getTimezoneOffset()}})
    if(error) setNotice(error.message)
    else if(data?.error) setNotice(data.error)
    else {
      setNotice(`Kampanja je spremna: napravljeno je ${data?.posts?.length||5} usklađenih objava. Otvori Visual Studio za finalne korekcije.`)
      await onChanged()
    }
    setWorking('')
  }

  const heroItem = previewItems[0]
  const aiLimitText = status.ai_images_limit==null ? `${status.ai_images_used} / ∞` : `${status.ai_images_used} / ${status.ai_images_limit}`

  return <div className="creative-hub">
    <header className="creative-hero">
      <div>
        <span className="creative-kicker"><Sparkles size={15}/> CREATIVE AUTOPILOT</span>
        <h1>Ne pitaj se više šta da reklamiraš.</h1>
        <p>Autopilot predlaže jelo, kampanju, format, CTA i vreme — a ako nema fotografije, AI pravi realističan food vizual.</p>
        <div className="creative-hero-actions"><button className="creative-primary" onClick={()=>void loadAdvisor()} disabled={loading}><RefreshCw size={16}/>{loading?'Analiziram…':'Osveži predloge'}</button><span><ImagePlus size={15}/> AI slike {aiLimitText}</span><span><LayoutGrid size={15}/> {campaignFeature?'Campaign Pack aktivan':'Campaign Pack · PRO'}</span></div>
      </div>
      <div className="creative-pulse"><i/><strong>{status.photo_coverage??0}%</strong><span>photo ready</span></div>
    </header>

    <section className="creative-section">
      <div className="creative-section-head"><div><p className="eyebrow">ŠTA DA REKLAMIRAŠ DANAS</p><h2>Autopilot preporuke</h2></div><span className="creative-ai-state"><Zap size={14}/>{status.ai_image_ready?'AI FOOD IMAGE READY':'AI FOOD IMAGE SETUP'}</span></div>
      <div className="creative-recommendations">
        {loading ? <div className="creative-loading">Analiziram meni i cilj restorana…</div> : suggestions.map((item,index)=><button type="button" key={item.id} onClick={()=>setSelectedId(item.id)} className={`creative-rec-card ${selected?.id===item.id?'active':''}`}>
          <div className="creative-rec-top"><span>0{index+1}</span><b>{item.subtitle}</b></div>
          <div className="creative-rec-image" style={item.image_url?{backgroundImage:`linear-gradient(180deg,transparent,rgba(7,12,9,.78)),url(${item.image_url})`}:{background:`radial-gradient(circle at 70% 20%,${restaurant.secondary_color||'#b9df72'}55,transparent 34%),linear-gradient(145deg,${restaurant.primary_color||'#17211b'},#2b382f)`}}><ChefHat size={22}/></div>
          <strong>{item.title}</strong><p>{item.reason}</p>
          <div className="creative-rec-meta"><span><CalendarClock size={13}/>{item.time}</span><span><Target size={13}/>{item.cta}</span></div>
        </button>)}
      </div>
    </section>

    <section className="creative-section">
      <div className="creative-section-head"><div><p className="eyebrow">TEMPLATE LIBRARY</p><h2>Izaberi izgled kampanje</h2></div><span>{selectedCollection.name}</span></div>
      <div className="creative-template-strip">{collections.map(item=><button type="button" key={item.id} className={`creative-template-chip template-${item.id} ${collection===item.id?'active':''}`} onClick={()=>setCollection(item.id)}><i/><strong>{item.name}</strong><small>{item.description}</small></button>)}</div>

      <div className="campaign-builder-grid">
        <div className={`campaign-pack-preview pack-${collection}`} style={{'--brand':restaurant.primary_color||'#151b17','--accent':restaurant.secondary_color||'#ff9f0a'} as React.CSSProperties}>
          <div className="pack-hero" style={heroItem?.image_url?{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.76)),url(${heroItem.image_url})`}:undefined}>
            <PackLogo restaurant={restaurant}/><span>PREMIUM QUALITY</span><h3>{selectedCollection.label}</h3><p>{heroItem?.name||selected?.menu_item_name||'GLAVNA PONUDA'}</p><b>{selected?.cta||'Svrati danas'}</b>
          </div>
          <div className="pack-mini-grid">{[1,2,3,4].map((slot)=>{const item=previewItems[slot]||previewItems[slot%Math.max(1,previewItems.length)];return <div key={slot} className={`pack-mini mini-${slot}`} style={item?.image_url?{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.06),rgba(0,0,0,.7)),url(${item.image_url})`}:undefined}><PackLogo restaurant={restaurant}/><span>{slot===1?'DELICIOUS':slot===2?'BEST FOOD':slot===3?'TIME 4':'FAMILY'}</span><strong>{slot===1?'TASTE':slot===2?'MENU':slot===3?'LUNCH':'TIME'}</strong><small>{item?.name||'Tvoja ponuda'}</small></div>})}</div>
        </div>

        <aside className="campaign-control-card">
          <span className="creative-kicker"><Megaphone size={14}/> CAMPAIGN BUILDER</span>
          <h2>{selected?.title||'Izaberi preporuku'}</h2>
          <p>{selected?.reason||'Autopilot kombinuje preporuku sa izabranim dizajnerskim sistemom.'}</p>
          <div className="campaign-checklist"><span><Sparkles size={14}/> 5 usklađenih objava</span><span><CalendarClock size={14}/> termini automatski raspoređeni</span><span><Target size={14}/> Feed + Story + promo CTA</span><span><LayoutGrid size={14}/> logo i boje restorana</span></div>
          {selected?.menu_item_id && !selected.image_url && <div className="missing-photo-card"><ImagePlus size={20}/><div><strong>Nema fotografije za {selected.menu_item_name}</strong><span>AI može da napravi realističnu food fotografiju i odmah je postavi u meni.</span></div><button type="button" onClick={()=>void generateImage(selected.menu_item_id!,collection)} disabled={working.startsWith('image-')}>{working===`image-${selected.menu_item_id}`?'Generišem…':'Generiši AI sliku'}</button></div>}
          {selected?.menu_item_id && selected.image_url && <button type="button" className="creative-secondary full" onClick={()=>void generateImage(selected.menu_item_id!,collection)} disabled={working.startsWith('image-')}><WandSparkles size={16}/>{working===`image-${selected.menu_item_id}`?'Generišem novu…':'Napravi novu AI varijantu fotografije'}</button>}
          <button type="button" className="creative-primary full big" onClick={()=>void createPack()} disabled={working==='pack'||!selected}><Sparkles size={18}/>{working==='pack'?'Pravim kampanju…':campaignFeature?'Napravi ovu kampanju':'Campaign Pack · PRO / BUSINESS'}</button>
        </aside>
      </div>
    </section>
  </div>
}

function PackLogo({restaurant}:{restaurant:Restaurant}){return <div className="pack-logo">{restaurant.logo_url?<img src={restaurant.logo_url} alt=""/>:<span>{restaurant.name.slice(0,1).toUpperCase()}</span>}</div>}
