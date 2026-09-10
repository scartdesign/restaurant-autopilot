import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ChefHat, ImagePlus, KeyRound, LayoutGrid, Megaphone, RefreshCw, ShieldCheck, Sparkles, Target, WandSparkles, Zap } from 'lucide-react'
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
  ai_text_ready?:boolean
  advisor_engine?:string
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
  const [status,setStatus] = useState<CreativeStatus>({ai_image_ready:false,ai_images_used:0,ai_images_limit:0,campaign_pack:false,ai_text_ready:false,advisor_engine:'rules-fallback'})
  const [loading,setLoading] = useState(true)
  const [working,setWorking] = useState('')
  const [providerKey,setProviderKey] = useState('')
  const [savingProvider,setSavingProvider] = useState(false)

  const selected = suggestions.find(item=>item.id===selectedId) || suggestions[0]
  const activeItems = useMemo(()=>menuItems.filter(i=>i.is_active),[menuItems])
  const previewItems = useMemo(()=>{
    const first = selected?.menu_item_id ? activeItems.find(i=>i.id===selected.menu_item_id) : undefined
    const rest = activeItems.filter(i=>i.id!==first?.id)
    return [first,...rest].filter(Boolean).slice(0,5) as MenuItem[]
  },[activeItems,selected?.menu_item_id])
  const selectedCollection = collections.find(item=>item.id===collection) || collections[0]
  const campaignFeature = entitlement?.features?.campaign_pack === true || status.campaign_pack
  const isOwner = entitlement?.is_superadmin === true
  const missingPreviewPhotos = previewItems.filter(item=>!item.image_url)

  useEffect(()=>{ void loadAdvisor() },[restaurant.id])
  useEffect(()=>{ if(selected?.recommended_style && collections.some(c=>c.id===selected.recommended_style)) setCollection(selected.recommended_style as Collection) },[selectedId])

  async function loadImageStatus(){
    const {data,error}=await supabase.functions.invoke('creative-image',{body:{action:'status',restaurantId:restaurant.id}})
    if(error) return {error:error.message,data:null}
    if(data?.error) return {error:data.error,data:null}
    return {error:'',data}
  }

  async function loadAdvisor(){
    setLoading(true)
    const [advisorResult,imageResult]=await Promise.all([
      supabase.functions.invoke('creative-advisor',{body:{action:'recommend',restaurantId:restaurant.id,timezoneOffsetMinutes:new Date().getTimezoneOffset()}}),
      loadImageStatus(),
    ])
    if(advisorResult.error) setNotice(advisorResult.error.message)
    else if(advisorResult.data?.error) setNotice(advisorResult.data.error)
    else {
      const list=(advisorResult.data?.suggestions||[]) as Suggestion[]
      setSuggestions(list)
      setSelectedId(current=>list.some(item=>item.id===current)?current:list[0]?.id||'')
      const imageData=imageResult.data
      setStatus(current=>({
        ai_image_ready:Boolean(imageData?.ai_image_ready),
        ai_images_used:Number(imageData?.ai_images_used??current.ai_images_used??0),
        ai_images_limit:imageData?.ai_images_limit==null?null:Number(imageData.ai_images_limit),
        campaign_pack:Boolean(entitlement?.features?.campaign_pack===true||entitlement?.is_superadmin===true),
        photo_coverage:Number(advisorResult.data?.photo_coverage||0),
        ai_text_ready:Boolean(advisorResult.data?.ai_text_ready),
        advisor_engine:String(advisorResult.data?.engine||'rules-fallback'),
      }))
      if(advisorResult.data?.ai_error) setNotice('AI Advisor je trenutno koristio sigurni fallback; predlozi su i dalje dostupni.')
    }
    if(imageResult.error && !advisorResult.error) setNotice(imageResult.error)
    setLoading(false)
  }

  async function saveProviderKey(){
    if(!isOwner) return
    if(!providerKey.trim()){setNotice('Unesi OpenAI API ključ.');return}
    setSavingProvider(true)
    const {error}=await supabase.rpc('admin_set_ai_provider_key',{p_key:providerKey.trim()})
    if(error) setNotice(error.message)
    else {
      setProviderKey('')
      const result=await loadImageStatus()
      if(result.data?.ai_image_ready){
        setStatus(current=>({...current,ai_image_ready:true,ai_text_ready:true,ai_images_used:Number(result.data.ai_images_used||0),ai_images_limit:result.data.ai_images_limit==null?null:Number(result.data.ai_images_limit)}))
        setNotice('AI je aktiviran za fotografije i Creative Advisor. Ključ je sačuvan server-side u Vault-u.')
        await loadAdvisor()
      } else setNotice(result.error||'Ključ je sačuvan, ali AI status još nije potvrđen.')
    }
    setSavingProvider(false)
  }

  async function generateImage(menuItemId:string,style:Collection=collection){
    setWorking(`image-${menuItemId}`)
    setNotice('AI priprema realističnu fotografiju hrane…')
    const {data,error}=await supabase.functions.invoke('creative-image',{body:{action:'generate',restaurantId:restaurant.id,menuItemId,style}})
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

  async function generateMissingPreviewPhotos(){
    if(!missingPreviewPhotos.length){setNotice('Sva jela u ovom preview-u već imaju fotografiju.');return}
    if(!status.ai_image_ready){setNotice('AI Food Image prvo mora biti aktiviran.');return}
    const remaining=status.ai_images_limit==null?missingPreviewPhotos.length:Math.max(0,status.ai_images_limit-status.ai_images_used)
    const queue=missingPreviewPhotos.slice(0,remaining)
    if(!queue.length){setNotice('Mesečni limit AI slika je dostignut.');return}
    setWorking('batch-images')
    let made=0
    for(const item of queue){
      setNotice(`AI fotografije: ${made+1}/${queue.length} · ${item.name}`)
      const {data,error}=await supabase.functions.invoke('creative-image',{body:{action:'generate',restaurantId:restaurant.id,menuItemId:item.id,style:collection}})
      if(error||data?.error){setNotice(data?.error||error?.message||'AI slika nije uspela.');break}
      made+=1
      setStatus(current=>({...current,ai_images_used:Number(data?.ai_images_used??current.ai_images_used+1)}))
    }
    if(made){await onChanged();await loadAdvisor();setNotice(`Napravljeno je ${made} AI food fotografija za kampanju.`)}
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
  const advisorLabel = status.advisor_engine==='gpt-5.6-luna'?'GPT-5.6 Luna':'Smart fallback'

  return <div className="creative-hub">
    <header className="creative-hero">
      <div>
        <span className="creative-kicker"><Sparkles size={15}/> CREATIVE AUTOPILOT</span>
        <h1>Ne pitaj se više šta da reklamiraš.</h1>
        <p>AI analizira tvoj meni, cilj, publiku i lokalni kontekst, pa predlaže jelo, kampanju, CTA i vreme — a ako nema fotografije, pravi realističan food vizual.</p>
        <div className="creative-hero-actions"><button className="creative-primary" onClick={()=>void loadAdvisor()} disabled={loading}><RefreshCw size={16}/>{loading?'AI analizira…':'Novi AI predlozi'}</button><span><Sparkles size={15}/> Strateg · {advisorLabel}</span><span><ImagePlus size={15}/> AI slike {aiLimitText}</span><span><LayoutGrid size={15}/> {campaignFeature?'Campaign Pack aktivan':'Campaign Pack · PRO'}</span></div>
      </div>
      <div className="creative-pulse"><i/><strong>{status.photo_coverage??0}%</strong><span>photo ready</span></div>
    </header>

    {isOwner&&<section className={`ai-provider-owner ${status.ai_image_ready?'ready':''}`}>
      <div className="ai-provider-icon">{status.ai_image_ready?<ShieldCheck size={21}/>:<KeyRound size={21}/>}</div>
      <div className="ai-provider-copy"><strong>{status.ai_image_ready?'OpenAI · fotografije + strateg spremni':'OWNER · Aktiviraj AI Engine'}</strong><span>{status.ai_image_ready?'Jedan server-side ključ pokreće Creative Advisor i AI Food Image. Možeš ga zameniti bez prikazivanja postojećeg ključa.':'Unesi OpenAI API ključ jednom. Čuva se šifrovano u Supabase Vault-u i nikad se ne prikazuje kupcima.'}</span></div>
      <div className="ai-provider-form"><input type="password" autoComplete="new-password" value={providerKey} onChange={e=>setProviderKey(e.target.value)} placeholder={status.ai_image_ready?'Novi sk-… ključ (samo ako menjaš)':'sk-…'}/><button type="button" onClick={()=>void saveProviderKey()} disabled={savingProvider||!providerKey.trim()}>{savingProvider?'Čuvam…':status.ai_image_ready?'Promeni ključ':'Aktiviraj AI'}</button></div>
    </section>}

    <section className="creative-section">
      <div className="creative-section-head"><div><p className="eyebrow">ŠTA DA REKLAMIRAŠ DANAS</p><h2>AI preporuke</h2></div><span className="creative-ai-state"><Zap size={14}/>{status.ai_text_ready?'AI STRATEG READY':'SMART FALLBACK'}</span></div>
      <div className="creative-recommendations">
        {loading ? <div className="creative-loading">AI analizira meni, cilj i sadržaj restorana…</div> : suggestions.map((item,index)=><button type="button" key={item.id} onClick={()=>setSelectedId(item.id)} className={`creative-rec-card ${selected?.id===item.id?'active':''}`}>
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
          <p>{selected?.reason||'AI kombinuje preporuku sa izabranim dizajnerskim sistemom.'}</p>
          <div className="campaign-checklist"><span><Sparkles size={14}/> 5 usklađenih objava</span><span><CalendarClock size={14}/> termini automatski raspoređeni</span><span><Target size={14}/> Feed + Story + promo CTA</span><span><LayoutGrid size={14}/> logo i boje restorana</span></div>
          {missingPreviewPhotos.length>0&&<div className="missing-photo-card"><ImagePlus size={20}/><div><strong>{missingPreviewPhotos.length} {missingPreviewPhotos.length===1?'jelo nema':'jela nemaju'} fotografiju</strong><span>Možeš napraviti AI food fotografije pre generisanja paketa, da svaki vizual izgleda kao prava reklama.</span></div><button type="button" onClick={()=>void generateMissingPreviewPhotos()} disabled={working==='batch-images'||!status.ai_image_ready}>{working==='batch-images'?'AI generiše paket…':status.ai_image_ready?'AI napravi slike koje fale':'AI nije aktiviran'}</button></div>}
          {selected?.menu_item_id && selected.image_url && <button type="button" className="creative-secondary full" onClick={()=>void generateImage(selected.menu_item_id!,collection)} disabled={working.startsWith('image-')}><WandSparkles size={16}/>{working===`image-${selected.menu_item_id}`?'Generišem novu…':'Napravi novu AI varijantu glavne fotografije'}</button>}
          <button type="button" className="creative-primary full big" onClick={()=>void createPack()} disabled={working==='pack'||!selected}><Sparkles size={18}/>{working==='pack'?'Pravim kampanju…':campaignFeature?'Napravi ovu kampanju':'Campaign Pack · PRO / BUSINESS'}</button>
        </aside>
      </div>
    </section>
  </div>
}

function PackLogo({restaurant}:{restaurant:Restaurant}){return <div className="pack-logo">{restaurant.logo_url?<img src={restaurant.logo_url} alt=""/>:<span>{restaurant.name.slice(0,1).toUpperCase()}</span>}</div>}
