import type { CSSProperties } from 'react'
import type { VisualDesignMeta } from '../types'
import { baseFontStack, scriptFontStack } from '../template-fonts'
import '../restaurant-template-modern.css'

export type RestaurantTemplateId=NonNullable<VisualDesignMeta['template']>
type Props={
  template:RestaurantTemplateId; image:string; headline:string; text:string; price?:string; badge?:string; cta?:string
  primary:string; accent:string; logoUrl?:string|null; format?:'feed'|'story'; className?:string
  textSlots?:Record<string,string>; itemSlots?:Array<{title:string;price:string}>; baseFont?:string; scriptFont?:string
  fontScale?:number; photoPosition?:'left'|'center'|'right'
}
function photoStyle(image:string,position:'left'|'center'|'right'='center'):CSSProperties{
  return image?{backgroundImage:`url("${image.replace(/"/g,'\\"')}")`,backgroundPosition:position}:{}
}
function clean(value:string|undefined,fallback:string){return (value||'').trim()||fallback}
function eyebrowFor(template:RestaurantTemplateId,badge:string){
  if(badge.trim())return badge.trim()
  const labels:Record<RestaurantTemplateId,string>={
    luxe:'CHEF’S SIGNATURE','hero-menu':'HOUSE FAVORITE',editorial:'TODAY’S SELECTION',minimal:'FRESH TODAY',
    bold:'NEW DROP',split:'CHEF’S PICK',poster:'TONIGHT','promo-badge':'LIMITED OFFER',
    'premium-grid':'CURATED MENU','bold-offer':'TODAY ONLY','lunch-time':'LUNCH · TODAY',family:'AT THE TABLE',
  }
  return labels[template]
}
function Price({price}:{price:string}){return price.trim()?<span className="rtm-price">{price}</span>:null}
export function RestaurantTemplateCanvas({
  template,image,headline,text,price='',badge='',cta='Svrati danas',primary,accent,logoUrl,format='feed',className='',
  textSlots={},itemSlots=[],baseFont='modern-sans',scriptFont='signature',fontScale=1,photoPosition='center',
}:Props){
  const slot=(key:string,fallback:string)=>clean(textSlots[key],fallback)
  // Keep older saved layouts readable even when their legacy slots are not rendered.
  const legacySlots={verticalText:slot('verticalText',''),footerText:slot('footerText',''),scriptMain:slot('scriptMain','')}
  void legacySlots
  const title=clean(textSlots.overlayTitle||headline,'Današnja preporuka')
  const titleFit=title.length>36?'rtm-title-xlong':title.length>26?'rtm-title-long':title.length>18?'rtm-title-medium':''
  const description=clean(textSlots.smallDesc||textSlots.whiteCardText||textSlots.footerText||text,'Sveže pripremljeno za danas.')
  const action=clean(textSlots.smallCta||textSlots.buttonText||cta,'Svrati danas')
  const label=eyebrowFor(template,badge)
  const finalPrice=price||itemSlots[0]?.price||''
  const rootStyle={
    '--rt-primary':primary,'--rt-accent':accent,'--rt-base-font':baseFontStack(baseFont),
    '--rt-script-font':scriptFontStack(scriptFont),'--rt-user-font-scale':Math.min(1.15,Math.max(.85,fontScale)),
  } as CSSProperties
  let body
  switch(template){
    case 'luxe':
      body=<><div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/><div className="rtm-shade luxe"/>
        <div className="rtm-topline"><span>{label}</span><i/></div><div className="rtm-luxe-copy">
          <span className="rtm-luxe-index">01 / SIGNATURE</span><h2 className={`rtm-title ${titleFit}`}>{title}</h2><p className="rtpl-safe-copy">{description}</p>
          <div className="rtm-actions"><Price price={finalPrice}/><span className="rtm-cta rtpl-safe-cta">{action}</span></div></div></>
      break
    case 'editorial':
      body=<><div className="rtm-editorial-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-editorial-card"><span className="rtm-kicker">{label}</span><h2 className={`rtm-title ${titleFit}`}>{title}</h2>
          <p className="rtpl-safe-copy">{description}</p><div className="rtm-rule-row"><i/><Price price={finalPrice}/></div>
          <span className="rtm-text-link rtpl-safe-cta">{action} <b>↗</b></span></div></>
      break
    case 'hero-menu':
      body=<><div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/><div className="rtm-shade hero"/>
        <span className="rtm-index">01</span><Price price={finalPrice}/><div className="rtm-copy-hero">
          <span className="rtm-kicker light">{label}</span><h2 className={`rtm-title ${titleFit}`}>{title}</h2>
          <div className="rtm-hero-footer"><p className="rtpl-safe-copy">{description}</p><span className="rtpl-safe-cta">{action} ↗</span></div></div></>
      break
    case 'minimal':
      body=<><div className="rtm-minimal-bg"/><div className="rtm-minimal-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-minimal-copy"><span className="rtm-kicker dark">{label}</span><h2 className={`rtm-title ${titleFit}`}>{title}</h2>
          <p className="rtpl-safe-copy">{description}</p><div className="rtm-minimal-foot"><Price price={finalPrice}/><span className="rtpl-safe-cta">{action}</span></div></div></>
      break
    case 'bold':
      body=<><div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/><div className="rtm-shade bold"/>
        <span className="rtm-bold-label">{label}</span><div className="rtm-bold-price"><Price price={finalPrice}/></div>
        <div className="rtm-bold-copy"><h2 className={`rtm-title ${titleFit}`}>{title}</h2><div><p className="rtpl-safe-copy">{description}</p><span className="rtpl-safe-cta">{action} ↗</span></div></div></>
      break
    case 'split':
      body=<><div className="rtm-split-photo rtm-photo" style={photoStyle(image,photoPosition)}/><div className="rtm-split-panel">
        <span className="rtm-kicker">{label}</span><h2 className={`rtm-title ${titleFit}`}>{title}</h2><p className="rtpl-safe-copy">{description}</p>
        <Price price={finalPrice}/><span className="rtm-split-cta rtpl-safe-cta">{action} ↗</span></div>
        <div className="rtm-split-detail rtm-photo" style={photoStyle(image,photoPosition)}/></>
      break
    case 'poster':
      body=<><div className="rtm-poster-bg"/><div className="rtm-poster-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
        <span className="rtm-poster-side">{label}</span><div className="rtm-poster-copy"><span className="rtm-poster-number">TONIGHT’S TABLE</span>
        <h2 className={`rtm-title ${titleFit}`}>{title}</h2><p className="rtpl-safe-copy">{description}</p><Price price={finalPrice}/><span className="rtpl-safe-cta">{action} ↗</span></div></>
      break
    case 'promo-badge':
      body=<><div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/><div className="rtm-shade soft"/>
        <span className="rtm-kicker floating">{label}</span><div className="rtm-promo-card"><h2 className={`rtm-title ${titleFit}`}>{title}</h2>
        <p className="rtpl-safe-copy">{description}</p><div><Price price={finalPrice}/><span className="rtpl-safe-cta">{action}</span></div></div></>
      break
    case 'premium-grid':
      body=<><div className="rtm-grid-photo rtm-photo" style={photoStyle(image,photoPosition)}/><div className="rtm-grid-panel">
        <span className="rtm-grid-index">MENU / 01</span><span className="rtm-kicker">{label}</span><h2 className={`rtm-title ${titleFit}`}>{title}</h2>
        <p className="rtpl-safe-copy">{description}</p><div className="rtm-grid-bottom"><Price price={finalPrice}/><span className="rtpl-safe-cta">{action} ↗</span></div></div></>
      break
    case 'bold-offer':
      body=<><div className="rtm-offer-photo rtm-photo" style={photoStyle(image,photoPosition)}/><div className="rtm-offer-wash"/>
        <span className="rtm-offer-tag">{label}</span><div className="rtm-offer-copy"><span className="rtm-offer-kicker">SPECIAL DROP</span>
        <h2 className={`rtm-title ${titleFit}`}>{title}</h2><p className="rtpl-safe-copy">{description}</p><div><Price price={finalPrice}/><span className="rtpl-safe-cta">{action} →</span></div></div></>
      break
    case 'lunch-time':
      body=<><div className="rtm-lunch-left"><span className="rtm-kicker light">{label}</span><h2 className={`rtm-title ${titleFit}`}>{title}</h2>
        <p className="rtpl-safe-copy">{description}</p><Price price={finalPrice}/><span className="rtm-lunch-time">{slot('lunchHours','12:00 — 16:00')}</span>
        <span className="rtm-lunch-cta rtpl-safe-cta">{action} ↗</span></div>
        <div className="rtm-lunch-photo rtm-photo" style={photoStyle(image,photoPosition)}/></>
      break
    case 'family':
      body=<><div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/><div className="rtm-shade family"/>
        <span className="rtm-family-ribbon">{label}</span><div className="rtm-family-card"><span className="rtm-family-script">{slot('familyNote','Made with love')}</span>
        <h2 className={`rtm-title ${titleFit}`}>{title}</h2><p className="rtpl-safe-copy">{description}</p><div><Price price={finalPrice}/><span className="rtpl-safe-cta">{action} ↗</span></div></div></>
      break
  }
  return <div className={`restaurant-template-canvas rtm rtm-${template} ${format} ${className}`} style={rootStyle}>
    {body}{logoUrl&&<img className="rtm-logo" src={logoUrl} alt=""/>}<span className="rtpl-accessible-headline">{headline}</span>
  </div>
}
