import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { Check, CheckCircle2, Image as ImageIcon, LayoutTemplate, Pencil, Plus, Save, Sparkles, Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { optimizeImage } from '../lib/image'
import type { Post, Restaurant, VisualDesignMeta } from '../types'
import '../simple-content-studio.css'

type TemplateId = NonNullable<VisualDesignMeta['template']>
type Format = 'feed' | 'story'

type TemplateOption = {
  id: TemplateId
  name: string
  kicker: string
  note: string
}

const templates:TemplateOption[]=[
  {id:'luxe',name:'Midnight Gold',kicker:'PREMIUM',note:'Večera · vino · premium jela'},
  {id:'editorial',name:'Signature',kicker:"CHEF'S PICK",note:'Elegantno · glavno jelo'},
  {id:'hero-menu',name:'Hero Dish',kicker:'SIGNATURE DISH',note:'Jedno jelo u prvom planu'},
  {id:'minimal',name:'Clean Menu',kicker:'FRESH',note:'Čisto · moderno · svetlo'},
  {id:'bold',name:'Hot Offer',kicker:'SPECIAL OFFER',note:'Akcija · popust · jaka poruka'},
  {id:'poster',name:'Chef Poster',kicker:'TONIGHT',note:'Story · event · specijalitet'},
  {id:'split',name:'Split Menu',kicker:'TODAY',note:'Cena · ponuda · meni'},
  {id:'promo-badge',name:'Special Badge',kicker:'SPECIAL',note:'Promo · vikend · limited'},
]

function defaultTemplate(restaurant:Restaurant):TemplateId{
  if(restaurant.brand_style==='premium')return 'luxe'
  if(restaurant.brand_style==='fast_food')return 'bold'
  if(restaurant.brand_style==='modern')return 'minimal'
  return 'editorial'
}

function resolvePostImage(post:Post){
  const visual=post.generation_meta?.visual_design?.image_url
  if(typeof visual==='string'&&visual)return visual
  const direct=post.generation_meta?.image_url
  return typeof direct==='string'&&direct?direct:null
}

function overlayFor(template:TemplateId){
  if(template==='minimal'||template==='hero-menu')return .42
  if(template==='luxe'||template==='editorial')return .58
  return .7
}

export function SimpleContentStudio({restaurant,posts,onChanged,setNotice}:{restaurant:Restaurant;posts:Post[];onChanged:()=>Promise<void>;setNotice:(value:string)=>void}){
  const [file,setFile]=useState<File|null>(null)
  const [preview,setPreview]=useState('')
  const [editingId,setEditingId]=useState('')
  const [existingImage,setExistingImage]=useState('')
  const [template,setTemplate]=useState<TemplateId>(()=>defaultTemplate(restaurant))
  const [format,setFormat]=useState<Format>('feed')
  const [headline,setHeadline]=useState('')
  const [text,setText]=useState('')
  const [working,setWorking]=useState(false)

  const currentImage=preview||existingImage
  const recent=useMemo(()=>[...posts].filter(post=>post.status!=='rejected').slice(0,8),[posts])
  const selectedTemplate=templates.find(item=>item.id===template)||templates[0]

  useEffect(()=>{
    return()=>{if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)}
  },[preview])

  function chooseImage(event:ChangeEvent<HTMLInputElement>){
    const next=event.target.files?.[0]
    if(!next)return
    if(!['image/jpeg','image/png','image/webp'].includes(next.type)){setNotice('Fotografija mora biti JPG, PNG ili WEBP.');return}
    if(next.size>12*1024*1024){setNotice('Fotografija može imati najviše 12 MB.');return}
    if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  function reset(){
    if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)
    setFile(null);setPreview('');setEditingId('');setExistingImage('')
    setTemplate(defaultTemplate(restaurant));setFormat('feed');setHeadline('');setText('')
  }

  function editPost(post:Post){
    if(preview.startsWith('blob:'))URL.revokeObjectURL(preview)
    setFile(null);setPreview('');setEditingId(post.id);setExistingImage(resolvePostImage(post)||'')
    setTemplate((post.generation_meta?.visual_design?.template as TemplateId)||defaultTemplate(restaurant))
    setFormat(post.post_type==='story'?'story':'feed')
    setHeadline(post.title||post.generation_meta?.visual_design?.headline||'')
    setText(post.caption||post.generation_meta?.visual_design?.subline||'')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function uploadImage(next:File){
    const optimized=await optimizeImage(next,{maxSide:1800,quality:.9})
    const{data:auth,error:authError}=await supabase.auth.getUser()
    if(authError||!auth.user)throw new Error('Nalog nije dostupan za upload fotografije.')
    const ext=optimized.name.split('.').pop()?.toLowerCase()||'webp'
    const path=`${auth.user.id}/${restaurant.id}/content/${crypto.randomUUID()}.${ext}`
    const{error}=await supabase.storage.from('restaurant-assets').upload(path,optimized,{upsert:false,contentType:optimized.type||undefined})
    if(error)throw error
    return supabase.storage.from('restaurant-assets').getPublicUrl(path).data.publicUrl
  }

  async function save(){
    if(!currentImage&&!file){setNotice('Prvo ubaci fotografiju restorana ili jela.');return}
    if(!headline.trim()){setNotice('Upiši glavni naslov.');return}
    setWorking(true)
    try{
      const imageUrl=file?await uploadImage(file):existingImage
      if(!imageUrl)throw new Error('Fotografija nije dostupna.')
      const caption=text.trim()||headline.trim()
      const cta=restaurant.social_goal==='delivery'?'Poruči sada':restaurant.social_goal==='reservations'?'Rezerviši sto':'Svrati danas'
      const visualDesign:VisualDesignMeta={
        template,format,headline:headline.trim(),subline:caption,cta,image_url:imageUrl,photo_position:'center',overlay:overlayFor(template),
        primary_color:restaurant.primary_color||'#17372d',accent_color:restaurant.secondary_color||'#d8b35f',
        logo_visible:Boolean(restaurant.logo_url&&(restaurant.default_logo_visible??true)),logo_position:restaurant.default_logo_position||'top-right',
        logo_size:restaurant.default_logo_size||'m',logo_badge:restaurant.default_logo_badge||'white',copy_position:'bottom',
        font_pair:template==='luxe'||template==='editorial'?'editorial':template==='bold'||template==='poster'||template==='promo-badge'?'impact':'modern',
        saved_at:new Date().toISOString(),
      }
      const generationMeta={image_url:imageUrl,generation_source:'manual_composer',visual_design:visualDesign}
      if(editingId){
        const{error}=await supabase.from('posts').update({
          post_type:format,title:headline.trim(),caption,cta,generation_meta:generationMeta,
          platform_content:{instagram:{caption,hashtags:[]},facebook:{caption,hashtags:[]}},status:'draft',
        }).eq('id',editingId).eq('restaurant_id',restaurant.id)
        if(error)throw error
        setNotice('Objava je sačuvana. Fotografija, tekst i šablon su ažurirani.')
      }else{
        const{error}=await supabase.from('posts').insert({
          restaurant_id:restaurant.id,content_plan_id:null,menu_item_id:null,promotion_id:null,post_type:format,
          scheduled_for:null,title:headline.trim(),caption,cta,hashtags:[],visual_brief:null,status:'draft',
          generation_meta:generationMeta,platform_content:{instagram:{caption,hashtags:[]},facebook:{caption,hashtags:[]}},
          discovery_score:0,seo_keywords:[],
        })
        if(error)throw error
        setNotice('Nova objava je sačuvana kao draft. Sledeće možeš da je zakažeš u Objavama.')
      }
      await onChanged()
      reset()
    }catch(error){
      setNotice(error instanceof Error?error.message:'Objava nije sačuvana.')
    }
    setWorking(false)
  }

  return <div className="simple-content-studio">
    <header className="scs-header">
      <div><span>SADRŽAJ</span><h1>Slika. Šablon. Tekst. Gotovo.</h1><p>Ubaci svoju fotografiju restorana ili jela, izaberi dizajn koji ti se sviđa i napiši poruku.</p></div>
      {editingId&&<button className="secondary" onClick={reset}><Plus size={16}/> Nova objava</button>}
    </header>

    <section className="scs-steps">
      <div className={currentImage?'done active':'active'}><b>1</b><span><strong>Fotografija</strong><small>Tvoja slika</small></span>{currentImage&&<Check size={15}/>}</div>
      <div className={template?'done active':''}><b>2</b><span><strong>Šablon</strong><small>Izaberi izgled</small></span>{template&&<Check size={15}/>}</div>
      <div className={headline.trim()?'done active':''}><b>3</b><span><strong>Tekst</strong><small>Napiši poruku</small></span>{headline.trim()&&<Check size={15}/>}</div>
    </section>

    <div className="scs-builder">
      <div className="scs-controls">
        <section className="scs-card scs-upload-card">
          <div className="scs-section-title"><b>1</b><div><strong>Ubaci fotografiju</strong><small>Restoran, jelo, enterijer, terasa…</small></div></div>
          <label className={currentImage?'scs-upload-zone has-image':'scs-upload-zone'}>
            {currentImage?<img src={currentImage} alt="Preview"/>:<><Upload size={28}/><strong>Izaberi fotografiju</strong><span>JPG, PNG ili WEBP</span></>}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage}/>
            {currentImage&&<em><ImageIcon size={14}/> Promeni fotografiju</em>}
          </label>
        </section>

        <section className="scs-card">
          <div className="scs-section-title"><b>2</b><div><strong>Izaberi šablon</strong><small>Fotografija se odmah prikazuje u svakom stilu.</small></div></div>
          <div className="scs-template-grid">{templates.map((item,index)=><button type="button" key={item.id} className={`scs-template-card sc-template-${item.id} ${template===item.id?'selected':''}`} onClick={()=>setTemplate(item.id)}>
            <div className="scs-template-thumb" style={currentImage?{backgroundImage:`url(${currentImage})`}:undefined}><i/><span>{item.kicker}</span><strong>{headline||restaurant.name}</strong>{index<3&&<b>TOP</b>}</div>
            <div><strong>{item.name}</strong><small>{item.note}</small></div>
            {template===item.id&&<CheckCircle2 size={17}/>}
          </button>)}</div>
        </section>

        <section className="scs-card">
          <div className="scs-section-title"><b>3</b><div><strong>Upiši tekst</strong><small>Sve vidiš odmah na preview-u.</small></div></div>
          <div className="scs-format-switch"><button className={format==='feed'?'active':''} onClick={()=>setFormat('feed')}>Instagram / Facebook 4:5</button><button className={format==='story'?'active':''} onClick={()=>setFormat('story')}>Story 9:16</button></div>
          <label>Glavni naslov<input value={headline} maxLength={56} onChange={event=>setHeadline(event.target.value)} placeholder="npr. Večeras biramo Capricciosu"/></label>
          <label>Tekst<textarea rows={4} value={text} maxLength={360} onChange={event=>setText(event.target.value)} placeholder="Napiši kratku poruku gostima…"/></label>
        </section>
      </div>

      <aside className="scs-preview-wrap">
        <div className="scs-preview-head"><div><span>UŽIVO</span><strong>{selectedTemplate.name}</strong></div><span>{format==='story'?'1080 × 1920':'1080 × 1350'}</span></div>
        <div className={`scs-live-preview ${format} sc-template-${template}`} style={currentImage?{backgroundImage:`url(${currentImage})`}:undefined}>
          {!currentImage&&<div className="scs-preview-empty"><ImageIcon size={42}/><span>Ovde će se pojaviti tvoja fotografija</span></div>}
          <div className="scs-live-shade"/>
          {restaurant.logo_url&&(restaurant.default_logo_visible??true)&&<div className="scs-live-logo"><img src={restaurant.logo_url} alt=""/></div>}
          <div className="scs-live-copy"><span>{selectedTemplate.kicker}</span><h2>{headline||'Tvoj naslov ovde'}</h2><p>{text||'Kratka poruka o jelu, restoranu ili ponudi.'}</p><b>{restaurant.social_goal==='delivery'?'PORUČI SADA':restaurant.social_goal==='reservations'?'REZERVIŠI STO':'SVRATI DANAS'}</b></div>
        </div>
        <button className="scs-save" disabled={working} onClick={()=>void save()}><Save size={18}/>{working?'Čuvam…':editingId?'Sačuvaj izmene':'Sačuvaj objavu'}</button>
        <small className="scs-save-note">Sačuvana objava ide u <strong>Objave</strong>, gde biraš datum i vreme.</small>
      </aside>
    </div>

    <section className="scs-recent">
      <div className="scs-recent-head"><div><span>MOJE OBJAVE</span><h2>Poslednji dizajni</h2></div><small>Klikni Izmeni i ponovo promeni fotografiju, šablon ili tekst.</small></div>
      {recent.length?<div className="scs-recent-grid">{recent.map(post=>{const image=resolvePostImage(post);const tpl=(post.generation_meta?.visual_design?.template as TemplateId)||'editorial';return <article key={post.id}>
        <div className={`scs-recent-image sc-template-${tpl}`} style={image?{backgroundImage:`url(${image})`}:undefined}><i/><span>{post.post_type==='story'?'STORY':'OBJAVA'}</span><strong>{post.title||'Bez naslova'}</strong></div>
        <div><span className={`status ${post.status}`}>{post.status==='draft'?'Draft':post.status==='approved'?'Spremno':post.status==='published'?'Objavljeno':'Za doradu'}</span><button onClick={()=>editPost(post)}><Pencil size={14}/> Izmeni</button></div>
      </article>})}</div>:<div className="scs-empty"><Sparkles size={26}/><strong>Još nema objava.</strong><span>Ubaci prvu fotografiju iznad i napravi dizajn.</span></div>}
    </section>
  </div>
}
