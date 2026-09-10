import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { AlignLeft, CheckCircle2, Copy, Download, Eye, EyeOff, Image as ImageIcon, LayoutTemplate, Move, Palette, RotateCcw, Save, Sparkles, WandSparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { LogoBadge, LogoPosition, LogoSize, MenuItem, Post, Restaurant } from '../types'

type Format = 'feed' | 'story'
type Template = 'editorial' | 'bold' | 'minimal' | 'split' | 'poster' | 'luxe'
type PhotoPosition = 'left' | 'center' | 'right'
type DesignState = {
  template: Template; headline: string; subline: string; cta: string; format: Format
  imageUrl: string | null; photoPosition: PhotoPosition; overlay: number
  primaryColor: string; accentColor: string; logoVisible: boolean
  logoPosition: LogoPosition; logoSize: LogoSize; logoBadge: LogoBadge
}

const templateNames: Record<Template, string> = { editorial:'Editorial', bold:'Bold', minimal:'Minimal', split:'Split', poster:'Poster', luxe:'Luxe' }

export function VisualStudio({ restaurant, posts, menuItems, setNotice }: { restaurant:Restaurant; posts:Post[]; menuItems:MenuItem[]; setNotice:(value:string)=>void }) {
  const usablePosts = useMemo(() => posts.filter(p => p.status !== 'rejected'), [posts])
  const imageOptions = useMemo(() => menuItems.filter(i => i.is_active && i.image_url), [menuItems])
  const [selectedId, setSelectedId] = useState(() => usablePosts.find(p => p.status === 'approved')?.id || usablePosts[0]?.id || '')
  const selected = usablePosts.find(p => p.id === selectedId) || usablePosts[0]
  const [design, setDesign] = useState<DesignState>(() => designFromPost(selected, menuItems, restaurant))
  const [working, setWorking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingDefaults, setSavingDefaults] = useState(false)

  useEffect(() => { if (selected) setDesign(designFromPost(selected, menuItems, restaurant)) }, [selectedId, restaurant.id])

  const item = selected ? menuItems.find(i => i.id === selected.menu_item_id) : undefined
  const price = item?.price ? `${item.price} ${item.currency || 'RSD'}` : ''
  const location = [restaurant.neighborhood, restaurant.city].filter(Boolean).join(' · ') || restaurant.cuisine_type || 'Restaurant'
  const lowContrast = contrastRatio(design.primaryColor, design.accentColor) < 2.2
  const designScore = calculateScore(design, restaurant, price, lowContrast)

  if (!selected) return <><header className="page-header"><div><p className="eyebrow">VISUAL STUDIO</p><h1>Gotovi vizuali</h1><p className="muted">Prvo generiši nedelju sadržaja, pa ovde pravi finalne objave.</p></div></header><div className="empty-state"><ImageIcon size={34}/><h3>Nema objava za dizajn</h3><p>Dodaj jela sa fotografijama i generiši sadržaj.</p></div></>

  const patch = (value:Partial<DesignState>) => setDesign(current => ({ ...current, ...value }))

  function resetBrand() {
    patch(brandDefaults(restaurant))
    setNotice('Vraćene su podrazumevane boje i logo pravila restorana.')
  }

  function autoDesign() {
    let nextTemplate: Template = 'editorial'
    if (selected.post_type === 'promotion') nextTemplate = 'bold'
    else if (selected.post_type === 'story') nextTemplate = 'poster'
    else if (restaurant.brand_style === 'premium') nextTemplate = 'luxe'
    else if (!design.imageUrl) nextTemplate = 'minimal'
    patch({
      template: nextTemplate,
      overlay: nextTemplate === 'minimal' ? .44 : nextTemplate === 'luxe' ? .58 : .7,
      photoPosition: 'center',
      logoPosition: nextTemplate === 'poster' ? 'top-right' : (restaurant.default_logo_position || 'top-right'),
      headline: selected.title || design.headline,
      subline: shorten(selected.caption || design.subline, selected.post_type === 'story' ? 96 : 118),
      cta: selected.cta || design.cta || 'Svrati danas',
    })
    setNotice(`Auto Design je izabrao ${templateNames[nextTemplate]} stil, kadar i logo poziciju.`)
  }

  async function saveDesign() {
    setSaving(true)
    const meta = { ...(selected.generation_meta || {}), image_url: design.imageUrl, visual_design: {
      template:design.template, format:design.format, headline:design.headline, subline:design.subline, cta:design.cta,
      image_url:design.imageUrl, photo_position:design.photoPosition, overlay:design.overlay,
      primary_color:design.primaryColor, accent_color:design.accentColor, logo_visible:design.logoVisible,
      logo_position:design.logoPosition, logo_size:design.logoSize, logo_badge:design.logoBadge, saved_at:new Date().toISOString(),
    }}
    const { error } = await supabase.from('posts').update({ generation_meta: meta }).eq('id', selected.id)
    setNotice(error ? error.message : 'Dizajn je sačuvan: layout, boje, logo, pozicija i kadar vraćaju se identično.')
    setSaving(false)
  }

  async function saveAsBrandDefault() {
    setSavingDefaults(true)
    const { error } = await supabase.from('restaurants').update({
      primary_color:design.primaryColor, secondary_color:design.accentColor,
      default_logo_visible:design.logoVisible, default_logo_position:design.logoPosition,
      default_logo_size:design.logoSize, default_logo_badge:design.logoBadge,
      default_overlay_strength:design.overlay,
    }).eq('id', restaurant.id)
    setNotice(error ? error.message : 'Ove boje i logo pravila su sada default brenda za restoran.')
    setSavingDefaults(false)
  }

  async function copyPost() {
    const caption = selected.platform_content?.instagram?.caption || selected.caption || ''
    const tags = selected.platform_content?.instagram?.hashtags || selected.hashtags || []
    try { await navigator.clipboard.writeText(`${caption}\n\n${tags.join(' ')}`.trim()); setNotice('Instagram tekst i hashtagovi su kopirani.') }
    catch { setNotice('Browser nije dozvolio kopiranje.') }
  }

  async function downloadPng() {
    setWorking(true); setNotice('Renderujem finalni PNG u punoj rezoluciji…')
    try {
      const width = 1080, height = design.format === 'story' ? 1920 : 1350
      const backgroundData = design.imageUrl ? await urlToDataUrl(design.imageUrl) : null
      const logoData = design.logoVisible && restaurant.logo_url ? await urlToDataUrl(restaurant.logo_url).catch(() => null) : null
      const svg = buildSvg({ width,height,design,restaurantName:restaurant.name,location,price,backgroundData,logoData })
      const blob = new Blob([svg], { type:'image/svg+xml;charset=utf-8' }), objectUrl = URL.createObjectURL(blob), image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height
        const ctx = canvas.getContext('2d'); if(!ctx){ URL.revokeObjectURL(objectUrl); setWorking(false); setNotice('Canvas nije dostupan.'); return }
        ctx.drawImage(image,0,0,width,height); URL.revokeObjectURL(objectUrl)
        canvas.toBlob(png => { if(!png){ setWorking(false); setNotice('PNG export nije uspeo.'); return }
          const link=document.createElement('a'); link.href=URL.createObjectURL(png); link.download=`${slug(restaurant.name)}-${slug(design.headline||'objava')}-${design.format}.png`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1500)
          setNotice(`Finalni PNG ${width}×${height} je spreman sa brend bojama i logom.`); setWorking(false)
        },'image/png',1)
      }
      image.onerror=()=>{URL.revokeObjectURL(objectUrl);setWorking(false);setNotice('Greška pri renderovanju vizuala.')}; image.src=objectUrl
    } catch(error) { setNotice(error instanceof Error ? error.message : 'Greška pri izvozu.'); setWorking(false) }
  }

  return <>
    <header className="page-header studio-header studio-header-pro"><div><p className="eyebrow">VISUAL STUDIO</p><h1>Objava mora da izgleda kao da ju je radio dizajner.</h1><p className="muted">Realna fotografija, logo, brend boje, hijerarhija i CTA — sve menjaš uživo.</p></div><div className="studio-header-actions"><button className="secondary" onClick={saveDesign} disabled={saving}><Save size={17}/>{saving?'Čuvam…':'Sačuvaj objavu'}</button><button className="primary" onClick={downloadPng} disabled={working}><Download size={18}/>{working?'Renderujem…':`Preuzmi ${design.format==='story'?'1080×1920':'1080×1350'}`}</button></div></header>
    <div className="studio-shell studio-shell-pro">
      <aside className="studio-controls panel studio-controls-pro">
        <div className="studio-score-row"><div className="studio-control-head"><LayoutTemplate size={19}/><div><strong>Finalni dizajn</strong><span>Sve izmene se vide odmah.</span></div></div><div className={`design-score ${designScore>=85?'great':designScore>=70?'good':''}`}><strong>{designScore}</strong><span>/100</span></div></div>
        <label>Objava<select value={selected.id} onChange={e=>setSelectedId(e.target.value)}>{usablePosts.map(p=><option key={p.id} value={p.id}>{p.title||'Objava'} · {p.post_type}</option>)}</select></label>
        <button type="button" className="magic-design-button" onClick={autoDesign}><WandSparkles size={18}/><div><strong>Auto Design</strong><span>Layout + kadar + logo pozicija</span></div></button>
        <div className="studio-fieldset"><span>Format</span><div className="segmented"><button type="button" className={design.format==='feed'?'active':''} onClick={()=>patch({format:'feed'})}>Feed 4:5</button><button type="button" className={design.format==='story'?'active':''} onClick={()=>patch({format:'story'})}>Story 9:16</button></div></div>
        <div className="studio-fieldset"><span><Palette size={14}/> Stil</span><div className="template-picker template-picker-six">{(Object.keys(templateNames) as Template[]).map(value=><button type="button" key={value} className={design.template===value?'active':''} onClick={()=>patch({template:value})}><i className={`template-dot ${value}`}/><span>{templateNames[value]}</span></button>)}</div></div>

        <div className="brand-control-box">
          <div className="brand-control-title"><div><Palette size={15}/><strong>Brend na ovoj objavi</strong></div><button type="button" title="Vrati brand defaults" onClick={resetBrand}><RotateCcw size={14}/></button></div>
          <div className="studio-color-grid"><label>Primarna<div className="studio-color-input"><input type="color" value={design.primaryColor} onChange={e=>patch({primaryColor:e.target.value})}/><span>{design.primaryColor}</span></div></label><label>Akcent<div className="studio-color-input"><input type="color" value={design.accentColor} onChange={e=>patch({accentColor:e.target.value})}/><span>{design.accentColor}</span></div></label></div>
          {lowContrast&&<div className="brand-warning">Boje su previše slične. CTA i badge mogu izgubiti kontrast.</div>}
          <div className="logo-control-row"><button type="button" className={design.logoVisible?'logo-visibility active':'logo-visibility'} onClick={()=>patch({logoVisible:!design.logoVisible})}>{design.logoVisible?<Eye size={14}/>:<EyeOff size={14}/>} {design.logoVisible?'Logo uključen':'Logo isključen'}</button>{!restaurant.logo_url&&<small>Dodaj logo u Podešavanjima.</small>}</div>
          <div className="studio-brand-grid"><label>Pozicija<select value={design.logoPosition} onChange={e=>patch({logoPosition:e.target.value as LogoPosition})}><option value="top-left">Gore levo</option><option value="top-right">Gore desno</option><option value="top-center">Gore centar</option><option value="bottom-left">Dole levo</option><option value="bottom-right">Dole desno</option></select></label><label>Veličina<select value={design.logoSize} onChange={e=>patch({logoSize:e.target.value as LogoSize})}><option value="s">Mali</option><option value="m">Srednji</option><option value="l">Veliki</option></select></label><label className="span-2">Podloga<select value={design.logoBadge} onChange={e=>patch({logoBadge:e.target.value as LogoBadge})}><option value="none">Bez podloge</option><option value="white">Bela</option><option value="dark">Tamna</option><option value="blur">Glass / blur</option></select></label></div>
          <button type="button" className="save-brand-default" onClick={saveAsBrandDefault} disabled={savingDefaults}><Save size={14}/>{savingDefaults?'Čuvam…':'Sačuvaj kao default brenda'}</button>
        </div>

        <div className="studio-fieldset"><span><ImageIcon size={14}/> Fotografija</span>{imageOptions.length?<select value={design.imageUrl||''} onChange={e=>patch({imageUrl:e.target.value||null})}><option value="">Bez fotografije</option>{imageOptions.map(i=><option key={i.id} value={i.image_url||''}>{i.name}</option>)}</select>:<div className="studio-image-empty">Dodaj realne fotografije u Meni.</div>}</div>
        <div className="studio-fieldset"><span><Move size={14}/> Fokus fotografije</span><div className="segmented segmented-three">{(['left','center','right'] as PhotoPosition[]).map(pos=><button type="button" key={pos} className={design.photoPosition===pos?'active':''} onClick={()=>patch({photoPosition:pos})}>{pos==='left'?'Levo':pos==='right'?'Desno':'Centar'}</button>)}</div></div>
        <div className="studio-fieldset overlay-control"><span>Jačina zatamnjenja <strong>{Math.round(design.overlay*100)}%</strong></span><input type="range" min="20" max="90" value={Math.round(design.overlay*100)} onChange={e=>patch({overlay:Number(e.target.value)/100})}/></div>
        <div className="studio-copy-fields"><label><span><AlignLeft size={14}/> Glavni naslov</span><input value={design.headline} onChange={e=>patch({headline:e.target.value})} maxLength={58}/></label><label>Podnaslov<textarea rows={3} value={design.subline} onChange={e=>patch({subline:e.target.value})} maxLength={170}/></label><label>CTA<input value={design.cta} onChange={e=>patch({cta:e.target.value})} maxLength={30}/></label></div>
        <div className="design-checks"><DesignCheck ok={Boolean(design.imageUrl)} text="realna fotografija"/><DesignCheck ok={!design.logoVisible||Boolean(restaurant.logo_url)} text="logo spreman" soft/><DesignCheck ok={design.headline.length>3&&design.headline.length<=42} text="jak kratak naslov"/><DesignCheck ok={!lowContrast} text="dobar kontrast"/></div>
        <button type="button" className="secondary full" onClick={copyPost}><Copy size={16}/> Kopiraj Instagram tekst + hashtagove</button>
      </aside>

      <section className="studio-stage studio-stage-pro">
        <div className="stage-toolbar"><span><Sparkles size={14}/> FINAL PREVIEW</span><span>{design.format==='story'?'9:16 · 1080×1920':'4:5 · 1080×1350'} · {templateNames[design.template]}</span></div>
        <div className={`studio-artboard ${design.format} template-${design.template}`} style={{'--brand':design.primaryColor,'--accent':design.accentColor,'--overlay':String(design.overlay),'--photo-pos':design.photoPosition==='left'?'left center':design.photoPosition==='right'?'right center':'center center',backgroundImage:design.imageUrl?`url(${design.imageUrl})`:undefined} as CSSProperties}>
          <div className="artboard-photo-shade"/>
          {design.logoVisible&&<div className={`floating-brand-logo pos-${design.logoPosition} size-${design.logoSize} badge-${design.logoBadge}`}>{restaurant.logo_url?<img src={restaurant.logo_url} alt={restaurant.name}/>:<span>{restaurant.name.slice(0,1).toUpperCase()}</span>}</div>}
          <div className="artboard-brandline"><strong>{restaurant.name}</strong><span>{location}</span></div>
          <div className="artboard-copy">{price&&<span className="visual-price">{price}</span>}<h2>{design.headline||'Naslov objave'}</h2><p>{design.subline||'Kratka poruka koja prodaje iskustvo, ne samo jelo.'}</p><div className="visual-cta">{design.cta||'Svrati danas'} <span>→</span></div></div>
          <div className="artboard-footer"><span>{restaurant.instagram||restaurant.name}</span><span>{design.format==='story'?'STORY':'FEED'}</span></div>
        </div>
        <div className="studio-below-preview"><div><CheckCircle2 size={17}/><span>PNG export koristi isti logo, poziciju, boje i layout kao preview.</span></div><div><ImageIcon size={17}/><span>{design.imageUrl?'Koristi se realna fotografija iz menija.':'Dodaj fotografiju za maksimalan kvalitet.'}</span></div></div>
      </section>
    </div>
  </>
}

function DesignCheck({ok,text,soft=false}:{ok:boolean;text:string;soft?:boolean}){return <span className={ok?'ok':soft?'soft':''}><CheckCircle2 size={13}/> {text}</span>}
function brandDefaults(r:Restaurant){return {primaryColor:r.primary_color||'#142019',accentColor:r.secondary_color||'#b9df72',logoVisible:r.default_logo_visible??true,logoPosition:r.default_logo_position||'top-right' as LogoPosition,logoSize:r.default_logo_size||'m' as LogoSize,logoBadge:r.default_logo_badge||'white' as LogoBadge,overlay:Number(r.default_overlay_strength??.68)}}
function designFromPost(post:Post|undefined, menu:MenuItem[], r:Restaurant):DesignState{
  const brand=brandDefaults(r); if(!post)return{template:'editorial',headline:'',subline:'',cta:'Svrati danas',format:'feed',imageUrl:null,photoPosition:'center',...brand}
  const saved=post.generation_meta?.visual_design||{}, item=menu.find(i=>i.id===post.menu_item_id), metaImage=typeof post.generation_meta?.image_url==='string'?post.generation_meta.image_url:null, fallback=item?.image_url||menu.find(i=>i.is_active&&i.image_url)?.image_url||null
  return {template:isTemplate(saved.template)?saved.template:post.post_type==='promotion'?'bold':r.brand_style==='premium'?'luxe':'editorial',headline:typeof saved.headline==='string'?saved.headline:post.title||'',subline:typeof saved.subline==='string'?saved.subline:shorten(post.caption||'',118),cta:typeof saved.cta==='string'?saved.cta:post.cta||'Svrati danas',format:saved.format==='story'||saved.format==='feed'?saved.format:post.post_type==='story'?'story':'feed',imageUrl:typeof saved.image_url==='string'?saved.image_url:metaImage||fallback,photoPosition:saved.photo_position==='left'||saved.photo_position==='right'?saved.photo_position:'center',overlay:typeof saved.overlay==='number'?saved.overlay:brand.overlay,primaryColor:typeof saved.primary_color==='string'?saved.primary_color:brand.primaryColor,accentColor:typeof saved.accent_color==='string'?saved.accent_color:brand.accentColor,logoVisible:typeof saved.logo_visible==='boolean'?saved.logo_visible:brand.logoVisible,logoPosition:isLogoPosition(saved.logo_position)?saved.logo_position:brand.logoPosition,logoSize:isLogoSize(saved.logo_size)?saved.logo_size:brand.logoSize,logoBadge:isLogoBadge(saved.logo_badge)?saved.logo_badge:brand.logoBadge}
}
function isTemplate(v:unknown):v is Template{return typeof v==='string'&&['editorial','bold','minimal','split','poster','luxe'].includes(v)}
function isLogoPosition(v:unknown):v is LogoPosition{return typeof v==='string'&&['top-left','top-right','top-center','bottom-left','bottom-right'].includes(v)}
function isLogoSize(v:unknown):v is LogoSize{return v==='s'||v==='m'||v==='l'}
function isLogoBadge(v:unknown):v is LogoBadge{return typeof v==='string'&&['none','white','dark','blur'].includes(v)}
function calculateScore(d:DesignState,r:Restaurant,price:string,low:boolean){let s=36;if(d.imageUrl)s+=24;if(!d.logoVisible||r.logo_url)s+=8;if(d.headline.length>=4&&d.headline.length<=42)s+=10;if(d.subline.length>=20&&d.subline.length<=125)s+=6;if(d.cta)s+=6;if(price)s+=4;if(!low)s+=6;return Math.min(100,s)}
function contrastRatio(a:string,b:string){const lum=(hex:string)=>{const c=hex.replace('#','');if(!/^[0-9a-fA-F]{6}$/.test(c))return .5;const x=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*x[0]+.7152*x[1]+.0722*x[2]};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function shorten(v:string,max:number){const c=v.replace(/\s+/g,' ').trim();return c.length<=max?c:`${c.slice(0,max-1).trim()}…`}
function slug(v:string){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'restaurant-autopilot'}
function esc(v:string){return v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function wrap(v:string,max:number,lines:number){const words=v.trim().split(/\s+/).filter(Boolean),out:string[]=[];let cur='';for(const word of words){const next=cur?`${cur} ${word}`:word;if(next.length>max&&cur){out.push(cur);cur=word;if(out.length>=lines-1)break}else cur=next}if(cur&&out.length<lines)out.push(cur);return out}
async function urlToDataUrl(url:string){if(url.startsWith('data:'))return url;const res=await fetch(url);if(!res.ok)throw new Error('Fotografija nije dostupna za eksport.');const blob=await res.blob();return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Ne mogu da učitam fotografiju.'));reader.readAsDataURL(blob)})}
function logoBox(width:number,height:number,pos:LogoPosition,size:LogoSize,story:boolean){const s=size==='s'?(story?92:72):size==='l'?(story?148:116):(story?118:92),m=story?72:56;let x=m,y=m;if(pos.includes('right'))x=width-m-s;if(pos==='top-center')x=(width-s)/2;if(pos.includes('bottom'))y=height-m-s;return{x,y,s}}
function buildSvg({width,height,design,restaurantName,location,price,backgroundData,logoData}:{width:number;height:number;design:DesignState;restaurantName:string;location:string;price:string;backgroundData:string|null;logoData:string|null}){
  const story=height>1500,m=story?78:64, preserve=design.photoPosition==='left'?'xMinYMid slice':design.photoPosition==='right'?'xMaxYMid slice':'xMidYMid slice', overlay=Math.max(.2,Math.min(.9,design.overlay))
  const photo=backgroundData?`<image href="${backgroundData}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="${preserve}"/>`:`<rect width="${width}" height="${height}" fill="${design.primaryColor}"/><circle cx="${width*.8}" cy="${height*.2}" r="${width*.45}" fill="${design.accentColor}" opacity=".16"/>`
  const split=design.template==='split'&&backgroundData?`<rect width="${width}" height="${height}" fill="${design.primaryColor}"/><image href="${backgroundData}" x="${width*.43}" y="0" width="${width*.57}" height="${height}" preserveAspectRatio="${preserve}"/><rect x="${width*.35}" width="${width*.23}" height="${height}" fill="url(#split)"/>`:photo
  const y=design.template==='poster'?height*.47:design.template==='split'?height*.39:design.template==='minimal'?height*.61:height*.56, base=story?108:78, hs=design.headline.length>38?base*.8:design.headline.length>26?base*.9:base, headline=wrap(design.headline||'Naslov objave',design.template==='split'?16:story?18:22,story?4:3), body=wrap(design.subline||'',story?38:48,story?4:3), serif=design.template==='luxe'||design.template==='editorial'
  const head=headline.map((line,i)=>`<text x="${m}" y="${y+i*hs}" font-family="${serif?'Georgia,serif':'Arial,sans-serif'}" font-size="${hs}" font-weight="${serif?700:900}" letter-spacing="-2" fill="${design.template==='minimal'?design.primaryColor:'#fff'}">${esc(line)}</text>`).join(''), bodyStart=y+headline.length*hs+(story?42:30), bodySize=story?35:27, bodySvg=body.map((line,i)=>`<text x="${m}" y="${bodyStart+i*bodySize*1.38}" font-family="Arial,sans-serif" font-size="${bodySize}" fill="${design.template==='minimal'?'#4f5b52':'#fff'}" opacity=".9">${esc(line)}</text>`).join(''), ctaY=bodyStart+Math.max(1,body.length)*bodySize*1.38+(story?56:38), ctaW=story?400:330,ctaH=story?82:64
  let logo='';if(design.logoVisible){const g=logoBox(width,height,design.logoPosition,design.logoSize,story),pad=g.s*.12,bg=design.logoBadge==='white'?'#fff':design.logoBadge==='dark'?design.primaryColor:'#fff',op=design.logoBadge==='none'?0:design.logoBadge==='blur'?.24:.96,badge=design.logoBadge==='none'?'':`<rect x="${g.x}" y="${g.y}" width="${g.s}" height="${g.s}" rx="${g.s*.18}" fill="${bg}" opacity="${op}"/>`;logo=logoData?`${badge}<image href="${logoData}" x="${g.x+pad}" y="${g.y+pad}" width="${g.s-pad*2}" height="${g.s-pad*2}" preserveAspectRatio="xMidYMid meet"/>`:`${badge}<text x="${g.x+g.s/2}" y="${g.y+g.s*.67}" text-anchor="middle" font-family="Arial" font-size="${g.s*.48}" font-weight="900" fill="${design.logoBadge==='dark'?'#fff':design.primaryColor}">${esc(restaurantName.slice(0,1).toUpperCase())}</text>`}
  const minimal=design.template==='minimal'?`<rect x="${m*.7}" y="${height*.55}" width="${width-m*1.4}" height="${height-height*.55-m*.7}" rx="${story?42:32}" fill="#fbfcfa" opacity=".96"/>`:'', bold=design.template==='bold'?`<rect y="${height*.47}" width="${width}" height="${height*.53}" fill="${design.primaryColor}" opacity=".84"/>`:'', luxe=design.template==='luxe'?`<rect x="${m*.55}" y="${m*.55}" width="${width-m*1.1}" height="${height-m*1.1}" rx="28" fill="none" stroke="${design.accentColor}" stroke-width="2" opacity=".72"/>`:'', poster=design.template==='poster'?`<rect x="${m}" y="${height*.24}" width="120" height="12" rx="6" fill="${design.accentColor}"/><text x="${m}" y="${height*.31}" font-family="Arial" font-size="18" font-weight="900" letter-spacing="5" fill="#fff">TODAY'S PICK</text>`:''
  const priceSvg=price?`<rect x="${m}" y="${y-(story?96:72)}" rx="999" width="${story?270:220}" height="${story?62:50}" fill="${design.accentColor}"/><text x="${m+(story?135:110)}" y="${y-(story?54:38)}" text-anchor="middle" font-family="Arial" font-size="${story?29:23}" font-weight="900" fill="${design.primaryColor}">${esc(price)}</text>`:'', cta=`<rect x="${m}" y="${ctaY}" rx="999" width="${ctaW}" height="${ctaH}" fill="${design.template==='minimal'?design.primaryColor:design.accentColor}"/><text x="${m+ctaW/2}" y="${ctaY+(story?53:42)}" text-anchor="middle" font-family="Arial" font-size="${story?30:24}" font-weight="900" fill="${design.template==='minimal'?'#fff':design.primaryColor}">${esc(design.cta||'Svrati danas')} →</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07100a" stop-opacity=".04"/><stop offset=".42" stop-color="#07100a" stop-opacity="${Math.max(.1,overlay-.48)}"/><stop offset="1" stop-color="#07100a" stop-opacity="${overlay}"/></linearGradient><linearGradient id="split" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${design.primaryColor}"/><stop offset="1" stop-color="${design.primaryColor}" stop-opacity="0"/></linearGradient></defs>${split}${design.template==='split'?'':`<rect width="${width}" height="${height}" fill="url(#shade)"/>`}${bold}${minimal}${luxe}${poster}<text x="${m}" y="${story?145:112}" font-family="Arial" font-size="${story?30:23}" font-weight="900" fill="#fff">${esc(restaurantName)}</text><text x="${m}" y="${story?180:142}" font-family="Arial" font-size="${story?20:16}" fill="#fff" opacity=".72">${esc(location)}</text>${priceSvg}${head}${bodySvg}${cta}${logo}</svg>`
}
