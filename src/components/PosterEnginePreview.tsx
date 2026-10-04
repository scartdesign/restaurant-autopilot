import { useRef, useState } from 'react'
import { RestaurantTemplateCanvas, type RestaurantTemplateId } from './RestaurantTemplateCanvas'
import { D, posterPalettes } from '../lib/poster-engine'
import { exportTemplatePng } from '../lib/export-template-png'
import './poster-engine-preview.css'

export function PosterEnginePreview(){
 const [format,setFormat]=useState<'feed'|'story'>('feed'),[template,setTemplate]=useState<RestaurantTemplateId>('luxe')
 const [title,setTitle]=useState('Truffle Smash Burger'),[description,setDescription]=useState('Double beef, cheddar, caramelized onion & truffle sauce')
 const [price,setPrice]=useState('1.290 RSD'),[cta,setCta]=useState('Poruči odmah'),[kicker,setKicker]=useState('Danas u ponudi')
 const [primary,setPrimary]=useState('#16473f'),[accent,setAccent]=useState('#c08a5e'),[x,setX]=useState(50),[y,setY]=useState(50),[zoom,setZoom]=useState(1)
 const [showLogo,setShowLogo]=useState(false)
 const [image,setImage]=useState('./demo-burger.jpg'),[gallery,setGallery]=useState(true),[notice,setNotice]=useState('')
 const live=useRef<HTMLDivElement>(null)
 const common={logoUrl:showLogo?'./restorapp-logo-sidebar.webp':null,image,headline:title,text:description,price,cta,badge:kicker,primary,accent,format,photoFocusX:x,photoFocusY:y,photoZoom:zoom}
 async function download(){try{setNotice('Pripremam PNG…');await exportTemplatePng({node:live.current!.querySelector<HTMLElement>('.restaurant-template-canvas')!,width:1080,height:format==='story'?1920:1080,fileName:`restorapp-${template}-${format}.png`});setNotice('PNG je preuzet.')}catch(e){setNotice(e instanceof Error?e.message:'Izvoz nije uspeo.')}}
 return <main className="poster-preview"><header><a href={window.location.pathname}><img src="./restorapp-logo-sidebar.webp" alt="Restorapp"/></a><span>FOOD POSTER STUDIO</span><h1>Dobro jelo zaslužuje dobar dizajn.</h1><p>Isti engine kao u aplikaciji. Promeni sadržaj i uporedi svih 12 stilova.</p></header><div className="poster-preview-workspace"><aside>
 <strong>1 · Format</strong><div className="pp-seg"><button aria-pressed={format==='feed'} onClick={()=>setFormat('feed')}>Post 1:1</button><button aria-pressed={format==='story'} onClick={()=>setFormat('story')}>Story 9:16</button></div>
 <strong>2 · Fotografija</strong><label className="pp-upload">Dodaj fotografiju<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){const reader=new FileReader();reader.onload=()=>setImage(String(reader.result));reader.readAsDataURL(f)}}}/></label>
 <strong>3 · Tekst</strong><label>Mali naslov<input value={kicker} onChange={e=>setKicker(e.target.value)}/></label><label>Naziv jela<input value={title} onChange={e=>setTitle(e.target.value)}/></label><div className="pp-seg"><button onClick={()=>setTitle('Burger')}>Kratak naziv</button><button onClick={()=>setTitle('Pečena pačja prsa sa sosom od šumskog voća i kremastim krompir pireom')}>Dugačak naziv</button></div>
 <label>Opis<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Cena<input value={price} onChange={e=>setPrice(e.target.value)}/></label><label>CTA<input value={cta} onChange={e=>setCta(e.target.value)}/></label>
 <strong>5 · Paleta i kadar</strong><div className="pp-palettes">{posterPalettes.map(p=><button key={p.name} title={p.name} aria-label={p.name} onClick={()=>{setPrimary(p.primary);setAccent(p.accent)}} style={{background:`linear-gradient(135deg,${p.primary} 60%,${p.accent} 60%)`}}/>)}</div>
 <div className="pp-seg"><label>Brand Kit · polje<input type="color" value={primary} onChange={e=>setPrimary(e.target.value)}/></label><label>Akcent<input type="color" value={accent} onChange={e=>setAccent(e.target.value)}/></label></div>
 <button onClick={()=>setShowLogo(!showLogo)}>{showLogo?'Sakrij logo':'Prikaži logo'}</button><label>Fokus X<input type="range" min="0" max="100" value={x} onChange={e=>setX(Number(e.target.value))}/></label><label>Fokus Y<input type="range" min="0" max="100" value={y} onChange={e=>setY(Number(e.target.value))}/></label><label>Zum<input type="range" min="100" max="220" value={zoom*100} onChange={e=>setZoom(Number(e.target.value)/100)}/></label>
 </aside><section><div className="pp-toolbar"><strong>4 · Izaberi dizajn</strong><button onClick={()=>setGallery(!gallery)}>{gallery?'Veliki pregled':'Svih 12 dizajna'}</button><button onClick={download}>Preuzmi PNG</button></div>
 <div ref={live} className={gallery?'pp-live-hidden':'pp-live'}><RestaurantTemplateCanvas template={template} {...common}/></div>
 {gallery&&<div className={`pp-gallery ${format}`}>{D.map(d=><button className={template===d.id?'selected':''} key={d.id} onClick={()=>{setTemplate(d.id);setGallery(false)}}><RestaurantTemplateCanvas template={d.id} {...common}/><span>{d.id.replaceAll('-',' ')}</span></button>)}</div>}
 <p role="status">{notice}</p></section></div><footer>Fotografija: Unsplash · U probnom studiju se sadržaj ne upisuje u bazu.</footer></main>
}
