import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, CheckCircle2, ChevronRight, Copy, Image as ImageIcon, LayoutTemplate, Pencil, Plus, Save, Send, Trash2, Upload, UtensilsCrossed, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { optimizeImage } from '../lib/image'
import type { MenuItem, Post, Restaurant, VisualDesignMeta } from '../types'
import '../simple-content-studio.css'
import { RestaurantTemplateCanvas } from './RestaurantTemplateCanvas'
import { defaultItemSlots, defaultTextSlots, templateSlotConfig, type TemplateItemSlot } from '../template-slot-config'

type StudioTab='dishes'|'templates'|'posts'
type TemplateId=NonNullable<VisualDesignMeta['template']>
type Format='feed'|'story'

type TemplateOption={
  id:TemplateId
  name:string
  category:string
  kicker:string
  note:string
  badge?:string
}

const templates:TemplateOption[]=[
  {id:'luxe',name:'Good Morning',category:'Premium',kicker:"TODAY'S MENU",note:'Tamni premium dizajn za večeru i fine dining.',badge:'TOP'},
  {id:'editorial',name:'Today’s Menu Curve',category:'Breakfast',kicker:'GOOD MORNING',note:'Elegantna fotografija sa potpisnim naslovom.',badge:'TOP'},
  {id:'hero-menu',name:'Today’s Menu Circle',category:'Signature',kicker:'GRILLED SPECIAL',note:'Velika fotografija i jedan jak signature naslov.',badge:'TOP'},
  {id:'minimal',name:'Breakfast Special',category:'Modern',kicker:'FRESH TODAY',note:'Čist i moderan layout za novo jelo.'},
  {id:'bold',name:'Today’s Menu Discount',category:'Promo',kicker:'SPECIAL OFFER',note:'Jak discount badge i prodajni CTA.'},
  {id:'poster',name:'Grilled Special',category:'Story',kicker:"CHEF'S CHOICE",note:'Poster stil za događaj, story i večernju ponudu.'},
  {id:'split',name:'Breakfast Card',category:'Menu',kicker:"TODAY'S MENU",note:'Fotografija + uredna tekst zona za cenu i opis.'},
  {id:'promo-badge',name:'Food Menu Grid',category:'Promo',kicker:'WEEKEND SPECIAL',note:'Veliki promo krug i premium food fotografija.'},
  {id:'premium-grid',name:'Diagonal Today’s Menu',category:'Menu',kicker:'FOOD MENU',note:'Meni kartica za više ponuda i setove.'},
  {id:'bold-offer',name:'Pizza Special',category:'Campaign',kicker:'LIMITED OFFER',note:'Velika tipografija za akcije i popuste.'},
  {id:'lunch-time',name:'Annual Mega Sale',category:'Lunch',kicker:'LUNCH TIME',note:'Dnevni meni i poslovni ručak.'},
  {id:'family',name:'Today’s Special Menu',category:'Restaurant',kicker:'TODAY SPECIAL',note:'Topao layout za porodični restoran i zajednički sto.'},
]

const colorPalettes=[
  {name:'Teal',primary:'#073c38',accent:'#ef7d3a'},
  {name:'Black Gold',primary:'#171411',accent:'#d4ad63'},
  {name:'Burgundy',primary:'#561f2b',accent:'#f0d1b1'},
  {name:'Olive',primary:'#455039',accent:'#e7c98a'},
  {name:'Navy',primary:'#16334a',accent:'#ef8169'},
]

function defaultTemplate(restaurant:Restaurant):TemplateId{
  if(restaurant.brand_style==='premium')return 'luxe'
  if(restaurant.brand_style==='fast_food')return 'bold'
  if(restaurant.brand_style==='modern')return 'minimal'
  return 'editorial'
}
function money(item:MenuItem|null){
  if(!item?.price)return ''
  return `${item.price} ${item.currency||'RSD'}`
}
function resolvePostImage(post:Post){
  const visual=post.generation_meta?.visual_design?.image_url
  if(typeof visual==='string'&&visual)return visual
  const direct=post.generation_meta?.image_url
  return typeof direct==='string'&&direct?direct:''
}
function overlayFor(template:TemplateId){
  if(template==='minimal'||template==='hero-menu'||template==='family')return .42
  if(template==='luxe'||template==='editorial'||template==='premium-grid')return .58
  return .7
}

function seedTextSlots(template:TemplateId,headline:string,description:string,cta:string){
  const slots=defaultTextSlots(template)
  if('overlayTitle' in slots)slots.overlayTitle=headline||slots.overlayTitle
  if('smallDesc' in slots)slots.smallDesc=description||slots.smallDesc
  if('whiteCardText' in slots)slots.whiteCardText=description||slots.whiteCardText
  if('footerText' in slots)slots.footerText=description||slots.footerText
  if('smallCta' in slots)slots.smallCta=cta||slots.smallCta
  if('buttonText' in slots)slots.buttonText=cta||slots.buttonText
  return slots
}

function seedItemSlots(template:TemplateId,items:MenuItem[],primary:MenuItem|null){
  const defaults=defaultItemSlots(template)
  if(!defaults.length)return defaults
  const ordered=[primary,...items.filter(item=>item.id!==primary?.id)].filter(Boolean) as MenuItem[]
  return defaults.map((fallback,index)=>{
    const item=ordered[index]
    return item?{title:item.name,price:money(item)||fallback.price}:fallback
  })
}

export function SimpleContentStudio({
  restaurant,userId,menuItems,posts,onChanged,onNavigate,setNotice,
}:{
  restaurant:Restaurant
  userId:string
  menuItems:MenuItem[]
  posts:Post[]
  onChanged:()=>Promise<void>
  onNavigate:(target:'publish')=>void
  setNotice:(value:string)=>void
}){
  const[tab,setTab]=useState<StudioTab>('dishes')
  const[dishForm,setDishForm]=useState({name:'',description:'',category:'',price:'',currency:'RSD'})
  const[dishImage,setDishImage]=useState<File|null>(null)
  const[dishPreview,setDishPreview]=useState('')
  const[editingDishId,setEditingDishId]=useState('')
  const[existingDishImage,setExistingDishImage]=useState('')
  const[dishWorking,setDishWorking]=useState(false)

  const[selectedDishId,setSelectedDishId]=useState('')
  const[template,setTemplate]=useState<TemplateId>(()=>defaultTemplate(restaurant))
  const[format,setFormat]=useState<Format>('feed')
  const[headline,setHeadline]=useState('')
  const[text,setText]=useState('')
  const[priceText,setPriceText]=useState('')
  const[badgeText,setBadgeText]=useState('')
  const[cta,setCta]=useState('')
  const[primaryColor,setPrimaryColor]=useState(restaurant.primary_color||'#073c38')
  const[accentColor,setAccentColor]=useState(restaurant.secondary_color||'#ef7d3a')
  const[textSlots,setTextSlots]=useState<Record<string,string>>(()=>defaultTextSlots(defaultTemplate(restaurant)))
  const[itemSlots,setItemSlots]=useState<TemplateItemSlot[]>(()=>defaultItemSlots(defaultTemplate(restaurant)))
  const[composerFile,setComposerFile]=useState<File|null>(null)
  const[composerPreview,setComposerPreview]=useState('')
  const[composerExistingImage,setComposerExistingImage]=useState('')
  const[editingPostId,setEditingPostId]=useState('')
  const[postWorking,setPostWorking]=useState(false)

  const selectedDish=useMemo(()=>menuItems.find(item=>item.id===selectedDishId)||null,[menuItems,selectedDishId])
  const composerImage=composerPreview||composerExistingImage||selectedDish?.image_url||''
  const selectedTemplate=templates.find(item=>item.id===template)||templates[0]
  const selectedTemplateConfig=templateSlotConfig[template]
  const recentPosts=useMemo(()=>[...posts].filter(post=>post.status!=='rejected').slice(0,20),[posts])

  useEffect(()=>()=>{if(dishPreview.startsWith('blob:'))URL.revokeObjectURL(dishPreview)},[dishPreview])
  useEffect(()=>()=>{if(composerPreview.startsWith('blob:'))URL.revokeObjectURL(composerPreview)},[composerPreview])

  async function upload(file:File,folder:string){
    const optimized=await optimizeImage(file,{maxSide:1800,quality:.9})
    const ext=optimized.name.split('.').pop()?.toLowerCase()||'webp'
    const path=`${userId}/${restaurant.id}/${folder}/${crypto.randomUUID()}.${ext}`
    const{error}=await supabase.storage.from('restaurant-assets').upload(path,optimized,{upsert:false,contentType:optimized.type||undefined})
    if(error)throw error
    return supabase.storage.from('restaurant-assets').getPublicUrl(path).data.publicUrl
  }

  function chooseDishImage(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0]
    if(!file)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setNotice('Fotografija mora biti JPG, PNG ili WEBP.');return}
    if(file.size>12*1024*1024){setNotice('Fotografija može imati najviše 12 MB.');return}
    if(dishPreview.startsWith('blob:'))URL.revokeObjectURL(dishPreview)
    setDishImage(file);setDishPreview(URL.createObjectURL(file))
  }
  function resetDishForm(){
    if(dishPreview.startsWith('blob:'))URL.revokeObjectURL(dishPreview)
    setDishForm({name:'',description:'',category:'',price:'',currency:'RSD'})
    setDishImage(null);setDishPreview('');setEditingDishId('');setExistingDishImage('')
  }
  function editDish(item:MenuItem){
    resetDishForm()
    setEditingDishId(item.id);setExistingDishImage(item.image_url||'')
    setDishForm({
      name:item.name,description:item.description||'',category:item.category||'',
      price:item.price===null?'':String(item.price),currency:item.currency||'RSD',
    })
    window.scrollTo({top:0,behavior:'smooth'})
  }
  async function saveDish(event:FormEvent){
    event.preventDefault()
    const name=dishForm.name.trim()
    if(!name){setNotice('Upiši naziv jela.');return}
    const price=dishForm.price.trim()===''?null:Number(dishForm.price.replace(',','.'))
    if(price!==null&&Number.isNaN(price)){setNotice('Cena mora biti broj, npr. 890 ili 12,90.');return}
    setDishWorking(true)
    try{
      const imageUrl=dishImage?await upload(dishImage,'menu'):existingDishImage||null
      if(editingDishId){
        const{error}=await supabase.from('menu_items').update({
          name,description:dishForm.description.trim()||null,category:dishForm.category.trim()||null,
          price,currency:dishForm.currency,image_url:imageUrl,is_active:true,
        }).eq('id',editingDishId).eq('restaurant_id',restaurant.id)
        if(error)throw error
        setNotice(`„${name}“ je sačuvano.`)
        await onChanged();resetDishForm()
      }else{
        const{data,error}=await supabase.from('menu_items').insert({
          restaurant_id:restaurant.id,name,description:dishForm.description.trim()||null,
          category:dishForm.category.trim()||null,price,currency:dishForm.currency,
          image_url:imageUrl,marketing_priority:0,is_active:true,
        }).select('*').single()
        if(error)throw error
        await onChanged()
        resetDishForm()
        if(data){
          startFromDish(data as MenuItem)
          setNotice(`„${name}“ je dodato. Sada izaberi šablon.`)
        }
      }
    }catch(error){setNotice(error instanceof Error?error.message:'Jelo nije sačuvano.')}
    setDishWorking(false)
  }
  async function deleteDish(item:MenuItem){
    if(!window.confirm(`Obriši „${item.name}“?`))return
    const{error}=await supabase.from('menu_items').delete().eq('id',item.id).eq('restaurant_id',restaurant.id)
    if(error){setNotice(error.message);return}
    if(selectedDishId===item.id)setSelectedDishId('')
    setNotice('Jelo je obrisano.')
    await onChanged()
  }

  function clearComposerPreview(){
    if(composerPreview.startsWith('blob:'))URL.revokeObjectURL(composerPreview)
    setComposerFile(null);setComposerPreview('')
  }

  function chooseTemplate(nextTemplate:TemplateId){
    setTemplate(nextTemplate)
    setTextSlots(seedTextSlots(nextTemplate,headline,text,cta))
    setItemSlots(seedItemSlots(nextTemplate,menuItems,selectedDish))
  }
  function resetTemplateTexts(){
    setTextSlots(seedTextSlots(template,headline,text,cta))
    setItemSlots(seedItemSlots(template,menuItems,selectedDish))
    setNotice('Tekstovi šablona su vraćeni na početne vrednosti.')
  }
  function startFromDish(item:MenuItem){
    clearComposerPreview()
    setSelectedDishId(item.id);setComposerExistingImage(item.image_url||'')
    const nextTemplate=defaultTemplate(restaurant)
    const nextCta=restaurant.social_goal==='delivery'?'Poruči sada':restaurant.social_goal==='reservations'?'Rezerviši sto':'Svrati danas'
    setTemplate(nextTemplate);setFormat('feed');setHeadline(item.name)
    setText(item.description||'');setPriceText(money(item));setBadgeText('')
    setCta(nextCta)
    setTextSlots(seedTextSlots(nextTemplate,item.name,item.description||'',nextCta))
    setItemSlots(seedItemSlots(nextTemplate,menuItems,item))
    setPrimaryColor(restaurant.primary_color||'#073c38');setAccentColor(restaurant.secondary_color||'#ef7d3a')
    setEditingPostId('');setTab('templates')
    window.scrollTo({top:0,behavior:'smooth'})
  }
  function chooseComposerImage(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0]
    if(!file)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setNotice('Fotografija mora biti JPG, PNG ili WEBP.');return}
    if(file.size>12*1024*1024){setNotice('Fotografija može imati najviše 12 MB.');return}
    clearComposerPreview()
    setComposerFile(file);setComposerPreview(URL.createObjectURL(file))
  }
  function editPost(post:Post){
    clearComposerPreview()
    setEditingPostId(post.id);setSelectedDishId(post.menu_item_id||'')
    setComposerExistingImage(resolvePostImage(post))
    const design=post.generation_meta?.visual_design
    const editTemplate=(design?.template as TemplateId)||defaultTemplate(restaurant)
    const editHeadline=post.title||design?.headline||''
    const editText=post.caption||design?.subline||''
    const editCta=post.cta||'Svrati danas'
    setTemplate(editTemplate)
    setFormat(post.post_type==='story'?'story':'feed')
    setHeadline(editHeadline)
    setText(editText)
    setTextSlots(design?.text_slots?{...design.text_slots}:seedTextSlots(editTemplate,editHeadline,editText,editCta))
    setItemSlots(design?.item_slots?.length?design.item_slots.map(item=>({...item})):seedItemSlots(editTemplate,menuItems,menuItems.find(item=>item.id===post.menu_item_id)||null))
    const manual=(post.generation_meta?.manual_fields||{}) as Record<string,unknown>
    setPriceText(typeof manual.price==='string'?manual.price:'')
    setBadgeText(typeof manual.badge==='string'?manual.badge:'')
    setCta(editCta)
    setPrimaryColor(post.generation_meta?.visual_design?.primary_color||restaurant.primary_color||'#073c38')
    setAccentColor(post.generation_meta?.visual_design?.accent_color||restaurant.secondary_color||'#ef7d3a')
    setTab('templates');window.scrollTo({top:0,behavior:'smooth'})
  }

  async function savePost(){
    if(!selectedDishId&&!composerImage){setNotice('Prvo izaberi jelo ili fotografiju.');return}
    if(!composerImage&&!composerFile){setNotice('Jelo nema fotografiju. Dodaj fotografiju pre čuvanja.');return}
    if(!headline.trim()){setNotice('Upiši naslov.');return}
    setPostWorking(true)
    try{
      const imageUrl=composerFile?await upload(composerFile,'content'):composerImage
      const caption=text.trim()||headline.trim()
      const visualDesign:VisualDesignMeta={
        template,format,headline:headline.trim(),subline:caption,cta:cta.trim()||'Svrati danas',
        image_url:imageUrl,photo_position:'center',overlay:overlayFor(template),
        primary_color:primaryColor,accent_color:accentColor,text_slots:{...textSlots},item_slots:itemSlots.map(item=>({...item})),
        logo_visible:Boolean(restaurant.logo_url&&(restaurant.default_logo_visible??true)),
        logo_position:restaurant.default_logo_position||'top-right',logo_size:restaurant.default_logo_size||'m',
        logo_badge:restaurant.default_logo_badge||'white',copy_position:'bottom',
        font_pair:template==='luxe'||template==='editorial'||template==='premium-grid'?'editorial':template==='bold'||template==='poster'||template==='bold-offer'||template==='promo-badge'?'impact':'modern',
        saved_at:new Date().toISOString(),
      }
      const generationMeta={
        image_url:imageUrl,generation_source:'manual_composer',visual_design:visualDesign,
        manual_fields:{price:priceText.trim(),badge:badgeText.trim(),template_name:selectedTemplate.name,primary_color:primaryColor,accent_color:accentColor},
      }
      const payload={
        menu_item_id:selectedDishId||null,post_type:format,title:headline.trim(),caption,
        cta:cta.trim()||'Svrati danas',generation_meta:generationMeta,
        platform_content:{instagram:{caption,hashtags:[]},facebook:{caption,hashtags:[]}},status:'draft' as const,
      }
      if(editingPostId){
        const{error}=await supabase.from('posts').update(payload).eq('id',editingPostId).eq('restaurant_id',restaurant.id)
        if(error)throw error
        setNotice('Objava je sačuvana.')
      }else{
        const{error}=await supabase.from('posts').insert({
          restaurant_id:restaurant.id,content_plan_id:null,promotion_id:null,scheduled_for:null,
          hashtags:[],visual_brief:null,discovery_score:0,seo_keywords:[],...payload,
        })
        if(error)throw error
        setNotice('Objava je sačuvana. Možeš da je zakažeš u Objavama.')
      }
      await onChanged();setEditingPostId('');setTab('posts')
    }catch(error){setNotice(error instanceof Error?error.message:'Objava nije sačuvana.')}
    setPostWorking(false)
  }

  async function duplicatePost(post:Post){
    const{error}=await supabase.from('posts').insert({
      restaurant_id:restaurant.id,content_plan_id:null,menu_item_id:post.menu_item_id,promotion_id:null,
      post_type:post.post_type,scheduled_for:null,title:post.title,caption:post.caption,cta:post.cta,
      hashtags:post.hashtags||[],visual_brief:post.visual_brief,status:'draft',
      generation_meta:{...(post.generation_meta||{}),generation_source:'manual_duplicate'},
      platform_content:post.platform_content||{},discovery_score:post.discovery_score||0,seo_keywords:post.seo_keywords||[],
    })
    if(error){setNotice(error.message);return}
    setNotice('Objava je duplirana.')
    await onChanged()
  }
  async function deletePost(post:Post){
    if(!window.confirm('Obriši ovu objavu?'))return
    const{error}=await supabase.from('posts').delete().eq('id',post.id).eq('restaurant_id',restaurant.id)
    if(error){setNotice(error.message);return}
    setNotice('Objava je obrisana.')
    await onChanged()
  }

  return <div className="dish-template-studio">
    <header className="dts-header">
      <div><span>RESTORAPP CONTENT</span><h1>Od jela do objave za minut.</h1><p>Dodaj jelo jednom. Posle samo biraš gotov dizajn, upišeš tekst i sačuvaš.</p></div>
      <div className="dts-mini-flow"><b>1</b> Jelo <ChevronRight size={13}/><b>2</b> Šablon <ChevronRight size={13}/><b>3</b> Objava</div>
    </header>

    <nav className="dts-tabs">
      <button className={tab==='dishes'?'active':''} onClick={()=>setTab('dishes')}><UtensilsCrossed size={17}/><span>Jela</span><b>{menuItems.length}</b></button>
      <button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}><LayoutTemplate size={17}/><span>Šabloni</span><b>{templates.length}</b></button>
      <button className={tab==='posts'?'active':''} onClick={()=>setTab('posts')}><ImageIcon size={17}/><span>Objave</span><b>{recentPosts.length}</b></button>
    </nav>

    {tab==='dishes'&&<section className="dts-dishes">
      <form className="dts-dish-form" onSubmit={saveDish}>
        <div className="dts-section-head"><div><span>{editingDishId?'IZMENI JELO':'NOVO JELO'}</span><h2>{editingDishId?'Sačuvaj izmene':'Dodaj jelo'}</h2></div>{editingDishId&&<button type="button" className="dts-icon" onClick={resetDishForm}><X size={17}/></button>}</div>
        <label className={dishPreview||existingDishImage?'dts-dish-upload has-image':'dts-dish-upload'}>
          {dishPreview||existingDishImage?<img src={dishPreview||existingDishImage} alt=""/>:<><Upload size={28}/><strong>Dodaj fotografiju jela</strong><small>JPG, PNG ili WEBP</small></>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseDishImage}/>
          {(dishPreview||existingDishImage)&&<em><Pencil size={13}/> Promeni sliku</em>}
        </label>
        <label>Naziv jela<input value={dishForm.name} onChange={e=>setDishForm({...dishForm,name:e.target.value})} placeholder="Pizza Capricciosa"/></label>
        <div className="dts-two"><label>Cena<input inputMode="decimal" value={dishForm.price} onChange={e=>setDishForm({...dishForm,price:e.target.value})} placeholder="890"/></label><label>Valuta<select value={dishForm.currency} onChange={e=>setDishForm({...dishForm,currency:e.target.value})}><option>RSD</option><option>EUR</option><option>BAM</option><option>MKD</option><option>BGN</option></select></label></div>
        <label>Kategorija<input value={dishForm.category} onChange={e=>setDishForm({...dishForm,category:e.target.value})} placeholder="Pizza, pasta, doručak…"/></label>
        <label>Kratak opis<textarea rows={3} value={dishForm.description} onChange={e=>setDishForm({...dishForm,description:e.target.value})} placeholder="Pelat, mozzarella, šunka, pečurke…"/></label>
        <button className="dts-primary" disabled={dishWorking}><Save size={16}/>{dishWorking?'Čuvam…':editingDishId?'Sačuvaj jelo':'Dodaj jelo'}</button>
      </form>

      <div className="dts-dish-library">
        <div className="dts-section-head"><div><span>MOJA JELA</span><h2>Izaberi šta reklamiraš</h2></div><small>Jednom uneseš jelo — koristiš ga u neograničeno objava.</small></div>
        {menuItems.length?<div className="dts-dish-grid">{menuItems.map(item=><article key={item.id} className={!item.is_active?'muted':''}>
          <div className="dts-dish-photo">{item.image_url?<img src={item.image_url} alt=""/>:<ImageIcon size={28}/>}<span>{item.category||'JELO'}</span></div>
          <div className="dts-dish-copy"><div><h3>{item.name}</h3>{item.price!==null&&<strong>{item.price} {item.currency}</strong>}</div><p>{item.description||'Dodaj kratak opis da ga možeš koristiti u objavi.'}</p></div>
          <button className="dts-create-post" onClick={()=>startFromDish(item)}><LayoutTemplate size={15}/> Kreiraj objavu</button>
          <div className="dts-row-actions"><button onClick={()=>editDish(item)}><Pencil size={14}/> Izmeni</button><button className="danger" onClick={()=>void deleteDish(item)}><Trash2 size={14}/> Obriši</button></div>
        </article>)}</div>:<div className="dts-empty"><UtensilsCrossed size={34}/><strong>Dodaj prvo jelo.</strong><span>Fotografija + naziv + cena su dovoljni da počneš.</span></div>}
      </div>
    </section>}

    {tab==='templates'&&<section className="dts-template-screen">
      <div className="dts-template-main">
        <div className="dts-section-head"><div><span>GOTOVI DIZAJNI</span><h2>Izaberi šablon</h2></div><small>{selectedDish?<>Za: <strong>{selectedDish.name}</strong></>:'Prvo izaberi jelo.'}</small></div>
        {!selectedDish&&<div className="dts-choose-dish">{menuItems.map(item=><button key={item.id} onClick={()=>startFromDish(item)}>{item.image_url?<img src={item.image_url} alt=""/>:<ImageIcon size={20}/>}<span>{item.name}</span><ChevronRight size={14}/></button>)}</div>}
        {selectedDish&&<div className="dts-template-gallery">{templates.map((item,index)=><article key={item.id} className={template===item.id?'selected':''}>
          <div className="dts-template-art"><RestaurantTemplateCanvas template={item.id} image={composerImage} headline={headline||selectedDish.name} text={text||selectedDish.description||'Tvoj tekst ovde'} price={priceText} badge={badgeText} cta={cta||'BUY'} primary={primaryColor} accent={accentColor} textSlots={item.id===template?textSlots:seedTextSlots(item.id,headline||selectedDish.name,text||selectedDish.description||'',cta||'BUY')} itemSlots={item.id===template?itemSlots:seedItemSlots(item.id,menuItems,selectedDish)}/></div>
          <div className="dts-template-meta"><div><span>{item.category}</span><strong>{item.name}</strong><small>{item.note}</small></div><button onClick={()=>chooseTemplate(item.id)}>{template===item.id?<><Check size={14}/> Izabran</>:<>Koristi šablon <ChevronRight size={14}/></>}</button></div>
        </article>)}</div>}
      </div>

      {selectedDish&&<aside className="dts-composer">
        <div className="dts-composer-head"><span>OBJAVA</span><strong>{editingPostId?'Izmeni objavu':'Dovrši objavu'}</strong></div>
        <label className="dts-composer-photo">{composerImage?<img src={composerImage} alt=""/>:<ImageIcon size={28}/>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseComposerImage}/><span><Upload size={13}/> Promeni sliku</span></label>
        <label>Naslov<input maxLength={56} value={headline} onChange={e=>setHeadline(e.target.value)} placeholder="Današnja preporuka"/></label>
        <label>Tekst<textarea rows={4} maxLength={360} value={text} onChange={e=>setText(e.target.value)} placeholder="Kratka poruka gostima…"/></label>
        <div className="dts-two"><label>Cena / oznaka<input value={priceText} onChange={e=>setPriceText(e.target.value)} placeholder="890 RSD"/></label><label>Badge<input value={badgeText} onChange={e=>setBadgeText(e.target.value)} placeholder="20% OFF"/></label></div>
        <label>CTA<input value={cta} onChange={e=>setCta(e.target.value)} placeholder="Rezerviši sto"/></label>
        <div className="dts-template-text-editor">
          <div className="dts-template-text-head"><div><span>TEKSTOVI NA DIZAJNU</span><strong>{selectedTemplate.name}</strong></div><button type="button" onClick={resetTemplateTexts}>Vrati tekstove</button></div>
          <div className="dts-template-text-fields">{selectedTemplateConfig.textSlots.map(slot=><label key={slot.key}>{slot.label}{slot.multiline
            ?<textarea rows={2} value={textSlots[slot.key]??slot.defaultValue} onChange={e=>setTextSlots(current=>({...current,[slot.key]:e.target.value}))}/>
            :<input value={textSlots[slot.key]??slot.defaultValue} onChange={e=>setTextSlots(current=>({...current,[slot.key]:e.target.value}))}/>}</label>)}</div>
          {selectedTemplateConfig.itemSlots?.length?<div className="dts-item-slot-editor"><div className="dts-item-slot-title"><span>STAVKE U MENIJU</span><small>Svaki naziv i cena se menjaju posebno.</small></div>{itemSlots.map((item,index)=><div className="dts-item-slot-row" key={index}><b>{index+1}</b><input aria-label={`Naziv stavke ${index+1}`} value={item.title} onChange={e=>setItemSlots(current=>current.map((entry,i)=>i===index?{...entry,title:e.target.value}:entry))}/><input aria-label={`Cena stavke ${index+1}`} value={item.price} onChange={e=>setItemSlots(current=>current.map((entry,i)=>i===index?{...entry,price:e.target.value}:entry))}/></div>)}</div>:null}
        </div>
        <div className="dts-color-editor">
          <div className="dts-color-title"><span>BOJE ŠABLONA</span><small>Klikni paletu ili izaberi svoje boje.</small></div>
          <div className="dts-palette-row">{colorPalettes.map(palette=><button type="button" key={palette.name} className={primaryColor===palette.primary&&accentColor===palette.accent?'active':''} onClick={()=>{setPrimaryColor(palette.primary);setAccentColor(palette.accent)}} title={palette.name}><i style={{background:palette.primary}}/><i style={{background:palette.accent}}/><span>{palette.name}</span></button>)}</div>
          <div className="dts-color-pickers"><label>Glavna<input type="color" value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)}/><span>{primaryColor}</span></label><label>Akcent<input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/><span>{accentColor}</span></label></div>
        </div>
        <div className="dts-format"><button className={format==='feed'?'active':''} onClick={()=>setFormat('feed')}>POST 1:1</button><button className={format==='story'?'active':''} onClick={()=>setFormat('story')}>STORY 9:16</button></div>
        <RestaurantTemplateCanvas className="dts-live-preview" template={template} image={composerImage} headline={headline||selectedDish.name} text={text||selectedDish.description||'Tvoj tekst ovde'} price={priceText} badge={badgeText} cta={cta||'BUY'} primary={primaryColor} accent={accentColor} logoUrl={restaurant.logo_url} format={format} textSlots={textSlots} itemSlots={itemSlots}/>
        <button className="dts-primary dts-save-post" disabled={postWorking} onClick={()=>void savePost()}><Save size={17}/>{postWorking?'Čuvam…':editingPostId?'Sačuvaj izmene':'Sačuvaj objavu'}</button>
      </aside>}
    </section>}

    {tab==='posts'&&<section className="dts-posts">
      <div className="dts-section-head"><div><span>MOJE OBJAVE</span><h2>Sačuvani dizajni</h2></div><button className="dts-primary compact" onClick={()=>setTab('dishes')}><Plus size={15}/> Nova objava</button></div>
      {recentPosts.length?<div className="dts-post-grid">{recentPosts.map(post=>{const image=resolvePostImage(post);const tpl=(post.generation_meta?.visual_design?.template as TemplateId)||'editorial';const manual=(post.generation_meta?.manual_fields||{}) as Record<string,unknown>;const design=post.generation_meta?.visual_design;const postPrimary=design?.primary_color||restaurant.primary_color||'#073c38';const postAccent=design?.accent_color||restaurant.secondary_color||'#ef7d3a';return <article key={post.id}>
        <div className="dts-post-art"><RestaurantTemplateCanvas template={tpl} image={image} headline={post.title||'Objava'} text={post.caption||''} price={typeof manual.price==='string'?manual.price:''} badge={typeof manual.badge==='string'?manual.badge:''} cta={post.cta||'BUY'} primary={postPrimary} accent={postAccent} textSlots={design?.text_slots||{}} itemSlots={design?.item_slots||[]}/></div>
        <div className="dts-post-info"><div><span className={`status ${post.status}`}>{post.status==='draft'?'Draft':post.status==='approved'?'Spremno':post.status==='published'?'Objavljeno':'Za doradu'}</span><strong>{post.title||'Bez naslova'}</strong></div><div className="dts-post-actions"><button onClick={()=>editPost(post)}><Pencil size={14}/> Izmeni</button><button onClick={()=>void duplicatePost(post)}><Copy size={14}/> Dupliraj</button><button className="schedule" onClick={()=>onNavigate('publish')}><CalendarClock size={14}/> Zakaži</button><button className="danger icon-only" onClick={()=>void deletePost(post)} title="Obriši"><Trash2 size={14}/></button></div></div>
      </article>})}</div>:<div className="dts-empty"><ImageIcon size={34}/><strong>Još nema objava.</strong><span>Dodaj jelo i izaberi prvi šablon.</span><button className="dts-primary compact" onClick={()=>setTab('dishes')}>Kreni od jela</button></div>}
    </section>}
  </div>
}
