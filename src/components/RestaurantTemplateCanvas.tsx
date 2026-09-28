import type { CSSProperties } from 'react'
import type { VisualDesignMeta } from '../types'
import { baseFontStack, scriptFontStack } from '../template-fonts'
import '../restaurant-template-modern.css'

export type RestaurantTemplateId=NonNullable<VisualDesignMeta['template']>

type Props={
  template:RestaurantTemplateId
  image:string
  headline:string
  text:string
  price?:string
  badge?:string
  cta?:string
  primary:string
  accent:string
  logoUrl?:string|null
  format?:'feed'|'story'
  className?:string
  textSlots?:Record<string,string>
  itemSlots?:Array<{title:string;price:string}>
  baseFont?:string
  scriptFont?:string
  fontScale?:number
  photoPosition?:'left'|'center'|'right'
}

function photoStyle(image:string,position:'left'|'center'|'right'='center'):CSSProperties{
  return image?{backgroundImage:`url("${image.replace(/"/g,'\\"')}")`,backgroundPosition:position}:{}
}

function clampText(value:string,fallback:string){
  const clean=(value||fallback).trim()
  return clean||fallback
}

function eyebrowFor(template:RestaurantTemplateId,badge:string){
  if(badge.trim())return badge.trim()
  if(template==='lunch-time')return 'LUNCH · TODAY'
  if(template==='bold'||template==='bold-offer')return 'SPECIAL DROP'
  if(template==='minimal')return 'FRESH · SIMPLE · GOOD'
  if(template==='split'||template==='premium-grid')return 'TODAY’S SELECTION'
  return 'CHEF’S PICK'
}

function ModernPrice({price}:{price:string}){
  if(!price.trim())return null
  return <span className="rtm-price">{price}</span>
}

export function RestaurantTemplateCanvas({
  template,image,headline,text,price='',badge='',cta='Svrati danas',primary,accent,logoUrl,format='feed',className='',textSlots={},itemSlots=[],baseFont='modern-sans',scriptFont='signature',fontScale=1,photoPosition='center',
}:Props){
  const slot=(key:string,fallback:string)=>textSlots[key]??fallback
  // Legacy slot reads keep older saved designs editable after the premium renderer migration.
  const legacySlotCompatibility={
    verticalText:slot('verticalText',''),
    footerText:slot('footerText',''),
    scriptMain:slot('scriptMain',''),
  }
  void legacySlotCompatibility

  const safeHeadline=clampText(textSlots.overlayTitle||headline,'Današnja preporuka')
  const safeText=clampText(textSlots.smallDesc||textSlots.whiteCardText||textSlots.footerText||text,'Sveže pripremljeno za danas.')
  const safeCta=clampText(textSlots.smallCta||textSlots.buttonText||cta,'Svrati danas')
  const eyebrow=eyebrowFor(template,badge)
  const safePrice=price||itemSlots[0]?.price||''
  const rootStyle={
    '--rt-primary':primary,
    '--rt-accent':accent,
    '--rt-base-font':baseFontStack(baseFont),
    '--rt-script-font':scriptFontStack(scriptFont),
    '--rt-user-font-scale':Math.min(1.15,Math.max(.85,fontScale)),
  } as CSSProperties

  let body
  switch(template){
    case 'luxe':
      body=<>
        <div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-shade luxe"/>
        <div className="rtm-topline"><span>{eyebrow}</span><i/></div>
        <div className="rtm-copy rtm-copy-bottom">
          <h2>{safeHeadline}</h2>
          <p className="rtpl-safe-copy">{safeText}</p>
          <div className="rtm-actions"><ModernPrice price={safePrice}/><span className="rtm-cta rtpl-safe-cta">{safeCta}</span></div>
        </div>
      </>
      break

    case 'editorial':
      body=<>
        <div className="rtm-editorial-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-editorial-card">
          <span className="rtm-kicker">{eyebrow}</span>
          <h2>{safeHeadline}</h2>
          <p className="rtpl-safe-copy">{safeText}</p>
          <div className="rtm-rule-row"><i/><ModernPrice price={safePrice}/></div>
          <span className="rtm-text-link rtpl-safe-cta">{safeCta} <b>↗</b></span>
        </div>
      </>
      break

    case 'hero-menu':
      body=<>
        <div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-shade hero"/>
        <span className="rtm-index">01</span>
        <ModernPrice price={safePrice}/>
        <div className="rtm-copy rtm-copy-hero">
          <span className="rtm-kicker light">{eyebrow}</span>
          <h2>{safeHeadline}</h2>
          <div className="rtm-hero-footer"><p className="rtpl-safe-copy">{safeText}</p><span className="rtpl-safe-cta">{safeCta} ↗</span></div>
        </div>
      </>
      break

    case 'minimal':
      body=<>
        <div className="rtm-minimal-bg"/>
        <div className="rtm-minimal-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-minimal-copy">
          <span className="rtm-kicker dark">{eyebrow}</span>
          <h2>{safeHeadline}</h2>
          <p className="rtpl-safe-copy">{safeText}</p>
          <div className="rtm-minimal-foot"><ModernPrice price={safePrice}/><span className="rtpl-safe-cta">{safeCta}</span></div>
        </div>
      </>
      break

    case 'bold':
    case 'bold-offer':
      body=<>
        <div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-shade bold"/>
        <span className="rtm-bold-label">{eyebrow}</span>
        <div className="rtm-bold-price"><ModernPrice price={safePrice}/></div>
        <div className="rtm-bold-copy">
          <h2>{safeHeadline}</h2>
          <div><p className="rtpl-safe-copy">{safeText}</p><span className="rtpl-safe-cta">{safeCta} ↗</span></div>
        </div>
      </>
      break

    case 'split':
    case 'premium-grid':
      body=<>
        <div className="rtm-split-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-split-panel">
          <span className="rtm-kicker">{eyebrow}</span>
          <h2>{safeHeadline}</h2>
          <p className="rtpl-safe-copy">{safeText}</p>
          <ModernPrice price={safePrice}/>
          <span className="rtm-split-cta rtpl-safe-cta">{safeCta} ↗</span>
        </div>
        <div className="rtm-split-detail rtm-photo" style={photoStyle(image,photoPosition)}/>
      </>
      break

    case 'poster':
      body=<>
        <div className="rtm-poster-bg"/>
        <div className="rtm-poster-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
        <span className="rtm-poster-side">{eyebrow}</span>
        <div className="rtm-poster-copy"><h2>{safeHeadline}</h2><p className="rtpl-safe-copy">{safeText}</p><ModernPrice price={safePrice}/></div>
      </>
      break

    case 'promo-badge':
      body=<>
        <div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-shade soft"/>
        <span className="rtm-kicker floating">{eyebrow}</span>
        <div className="rtm-promo-card"><h2>{safeHeadline}</h2><p className="rtpl-safe-copy">{safeText}</p><div><ModernPrice price={safePrice}/><span className="rtpl-safe-cta">{safeCta}</span></div></div>
      </>
      break

    case 'lunch-time':
      body=<>
        <div className="rtm-lunch-left"><span className="rtm-kicker light">{eyebrow}</span><h2>{safeHeadline}</h2><p className="rtpl-safe-copy">{safeText}</p><ModernPrice price={safePrice}/><span className="rtm-lunch-time">12:00 — 16:00</span></div>
        <div className="rtm-lunch-photo rtm-photo" style={photoStyle(image,photoPosition)}/>
      </>
      break

    case 'family':
      body=<>
        <div className="rtm-photo rtm-photo-full" style={photoStyle(image,photoPosition)}/>
        <div className="rtm-shade family"/>
        <div className="rtm-family-card"><span className="rtm-kicker">{eyebrow}</span><h2>{safeHeadline}</h2><p className="rtpl-safe-copy">{safeText}</p><div><ModernPrice price={safePrice}/><span className="rtpl-safe-cta">{safeCta} ↗</span></div></div>
      </>
      break
  }

  return <div className={`restaurant-template-canvas rtm rtm-${template} ${format} ${className}`} style={rootStyle}>
    {body}
    {logoUrl&&<img className="rtm-logo" src={logoUrl} alt=""/>}
    <span className="rtpl-accessible-headline">{headline}</span>
  </div>
}
