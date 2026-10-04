import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { VisualDesignMeta } from '../types'
import { baseFontStack, scriptFontStack, defaultBaseFont } from '../template-fonts'
import { D, LF, LS, brush, contrast, fitPoster, layoutClearance, photoCrop, readableInk, safeColor } from '../lib/poster-engine'
import '../restaurant-template-modern.css'

export type RestaurantTemplateId=NonNullable<VisualDesignMeta['template']>
type Props={
  template:RestaurantTemplateId; image:string; headline:string; text:string; price?:string; badge?:string; cta?:string
  primary:string; accent:string; logoUrl?:string|null; format?:'feed'|'story'; className?:string
  textSlots?:Record<string,string>; itemSlots?:Array<{title:string;price:string}>; baseFont?:string; scriptFont?:string
  fontScale?:number; photoPosition?:'left'|'center'|'right'; photoFocusX?:number; photoFocusY?:number; photoZoom?:number
  logoPosition?:'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-right'; logoSize?:'s'|'m'|'l'; logoBadge?:'none'|'white'|'dark'|'blur'
}
const labels:Record<RestaurantTemplateId,string>={luxe:'Iz kuhinje', 'hero-menu':'Najtraženije',editorial:'Danas izdvajamo',minimal:'',bold:'Sveže iz kuhinje',split:'Preporuka šefa',poster:'Danas u ponudi','promo-badge':'Posebna ponuda','premium-grid':'Naš izbor','bold-offer':'Samo danas','lunch-time':'Vreme za ručak',family:'Za našim stolom'}
const clean=(value:string|undefined,fallback:string)=>(value||'').trim()||fallback
export function RestaurantTemplateCanvas({template,image,headline,text,price='',badge='',cta='Svrati danas',primary,accent,logoUrl,format='feed',className='',textSlots={},itemSlots=[],baseFont,scriptFont='signature',fontScale=1,photoPosition='center',photoFocusX,photoFocusY=50,photoZoom=1,logoPosition='top-right',logoSize='m',logoBadge='white'}:Props){
  const wrapper=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null)
  const [scale,setScale]=useState(1),[dimensions,setDimensions]=useState({src:'',w:1800,h:1800})
  const id=useId().replace(/[^a-zA-Z0-9]/g,'')
  const d=D.find(entry=>entry.id===template)||D[0],H=format==='story'?1920:1080
  const L=(format==='story'?LS:LF)[format==='story'?d.S:d.F]
  const slot=(key:string,fallback:string)=>clean(textSlots[key],fallback)
  // Old posts may only have legacy slots. Read them without mutating their metadata.
  const title=slot('overlayTitle',clean(headline,'Današnja preporuka'))
  const description=slot('smallDesc',slot('whiteCardText',slot('footerText',clean(text,'Sveže pripremljeno za danas.'))))
  const action=slot('smallCta',slot('buttonText',clean(cta,'Svrati danas')))
  const kicker=clean(badge,slot('kicker',labels[d.id]))
  const finalPrice=clean(price,itemSlots[0]?.price||'')
  const p=safeColor(primary,'#16473f'),a=safeColor(accent,'#c08a5e'),tx=readableInk(p),ax=readableInk(a),kc=contrast(a,p)>=4.5?a:tx
  const customFont=baseFont&&baseFont!==defaultBaseFont(d.id)?baseFontStack(baseFont):d.tf
  const style={height:H,transform:`scale(${scale})`,'--p':p,'--a':a,'--tx':tx,'--ax':ax,'--kc':kc,'--tf':customFont,'--tw':d.tw,'--tc':d.tc,'--ls':d.ls,'--lh':d.lh,'--ts':`${d.ts}px`,'--pk':`${d.pk}px`,'--cap':format==='story'?'230px':'190px','--s':1,'--s2':1,'--rt-base-font':baseFontStack(baseFont),'--rt-script-font':scriptFontStack(scriptFont)} as CSSProperties
  const photo=photoCrop(L,H,dimensions.src===image?dimensions.w:1800,dimensions.src===image?dimensions.h:1800,photoFocusX??(photoPosition==='left'?30:photoPosition==='right'?70:50),photoFocusY,photoZoom)
  const paint=useMemo(()=>{
    const svg=brush(d,format,L,H,id,p).replace('<svg class="br"','<svg xmlns="http://www.w3.org/2000/svg"')
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  },[d,format,L,H,id,p])
  useLayoutEffect(()=>{
    const node=wrapper.current!
    const update=()=>setScale(node.clientWidth/1080)
    update();const observer=new ResizeObserver(update);observer.observe(node)
    return ()=>observer.disconnect()
  },[])
  useLayoutEffect(()=>{
    let cancelled=false
    const measure=()=>{if(!cancelled&&stage.current)fitPoster(stage.current,fontScale)}
    measure();void document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone',measure)
    return ()=>{cancelled=true;document.fonts.removeEventListener('loadingdone',measure)}
  },[title,description,action,kicker,finalPrice,d,H,fontScale,customFont,scriptFont,scale])
  const logoBottom=logoPosition.startsWith('bottom'),centered=logoPosition==='top-center'
  // Keep branding inside Instagram's safe zone as well.
  const logoWidth=logoSize==='s'?86:logoSize==='l'?140:108
  const logoStyle:CSSProperties={width:logoWidth,top:logoBottom?undefined:format==='story'?270:48,bottom:logoBottom?(format==='story'?360:48):undefined,left:logoPosition.endsWith('left')?48:centered?'50%':undefined,right:logoPosition.endsWith('right')?48:undefined,transform:centered?'translateX(-50%)':undefined}
  if(logoUrl){
    const lx=logoPosition.endsWith('left')?48:centered?(1080-logoWidth)/2:1080-48-logoWidth
    const ly=logoBottom?H-(format==='story'?360:48)-120:format==='story'?270:48
    const [bx,by,bw,bh]=[L.t[0]*1080,L.t[1]*H,L.t[2]*1080,L.t[3]*H]
    if(lx<bx+bw&&lx+logoWidth>bx&&ly<by+bh&&ly+120>by){
      // Keep the requested corner near its original anchor while protecting copy.
      // Side layouts place the logo in the photograph; top/bottom layouts shift it
      // past the copy block, entirely inside the Story safe zone.
      if(L.s==='l'||L.s==='r'){
        logoStyle.left=L.s==='l'?bx+bw+24:bx-logoWidth-24
        logoStyle.right=undefined;logoStyle.transform='none'
      }else{
        logoStyle.top=L.s==='t'?by+bh+24:by-144
        logoStyle.bottom=undefined
      }
    }
  }
  return <div ref={wrapper} className={`restaurant-template-canvas rtm ${format} ${className}`} data-template={d.id}>
    <div ref={stage} className="pe-stage" style={style} data-al={d.al} data-k={d.k} data-p={d.p} data-c={d.c} data-r={d.r} data-layout-clearance={layoutClearance(L,H)}>
      {image?<img className="pe-ph" src={image} alt="" style={photo} onLoad={event=>{const im=event.currentTarget;setDimensions({src:image,w:im.naturalWidth||1800,h:im.naturalHeight||1800})}}/>:<div className="pe-placeholder">Dodaj fotografiju jela</div>}
      <img className="pe-br" src={paint} width={1080} height={H} alt=""/>
      <div className="pe-frame"/>
      <div className="pe-tx" style={{left:L.t[0]*1080,top:L.t[1]*H,width:L.t[2]*1080,height:L.t[3]*H}}><div className="pe-in">
        <div className="pe-k" style={d.k==='script'?{fontFamily:scriptFontStack(scriptFont)}:undefined}>{kicker}</div>
        <h2 className="pe-t">{title}</h2><div className="pe-rl"/>
        <p className="pe-d rtpl-safe-copy">{description}</p>
        <div className="pe-row">{finalPrice&&<span className="pe-pr">{finalPrice}</span>}<span className="pe-c rtpl-safe-cta">{action}</span></div>
      </div></div>
      {logoUrl&&<img className={`pe-logo pe-logo-${logoBadge}`} src={logoUrl} alt="" style={logoStyle}/>}
    </div><span className="rtpl-accessible-headline">{title}</span>
  </div>
}
