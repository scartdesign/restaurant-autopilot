import type { CSSProperties, ReactNode } from 'react'
import type { VisualDesignMeta } from '../types'
import { baseFontStack, scriptFontStack } from '../template-fonts'
import '../restaurant-template-pack.css'

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
}

function photoStyle(image:string):CSSProperties{
  return image?{backgroundImage:`url("${image.replace(/"/g,'\"')}")`}:{}
}

function Discount({value}:{value:string}){
  const clean=value.trim()||'20% OFF'
  const parts=clean.split(/\s+/)
  return <span className="rtpl-discount"><strong>{parts[0]}</strong><small>{parts.slice(1).join(' ')||'OFF'}</small></span>
}

function fitClass(value:string){
  const clean=value.replace(/\n/g,' ').trim()
  if(clean.length>34)return 'rtpl-fit-xlong'
  if(clean.length>24)return 'rtpl-fit-long'
  if(clean.length>16)return 'rtpl-fit-medium'
  return ''
}

function Script({children,className='',fitValue='' }:{children:ReactNode;className?:string;fitValue?:string}){
  return <span className={`rtpl-script ${fitClass(fitValue)} ${className}`}>{children}</span>
}

export function RestaurantTemplateCanvas({
  template,image,headline,text,price='',badge='',cta='BUY',primary,accent,logoUrl,format='feed',className='',textSlots={},itemSlots=[],baseFont='modern-sans',scriptFont='signature',
}:Props){
  const rootStyle={
    '--rt-primary':primary,
    '--rt-accent':accent,
    '--rt-base-font':baseFontStack(baseFont),
    '--rt-script-font':scriptFontStack(scriptFont),
  } as CSSProperties
  const discount=badge||'20% OFF'
  const slot=(key:string,fallback:string)=>textSlots[key]??fallback
  const lines=(value:string)=>value.split(/\n/).map((line,index)=><span key={index}>{line}{index<value.split(/\n/).length-1&&<br/>}</span>)

  let body
  switch(template){
    case 'luxe':
      body=<>
        <span className="rtpl-corner-dots top-left"/><span className="rtpl-corner-dots bottom-right"/>
        <div className="rtpl-frame"/>
        <div className="rtpl-photo photo-main" style={photoStyle(image)}/>
        <div className="rtpl-bottom-band">
          <Script fitValue={slot('scriptTop','Good Morning')}>{lines(slot('scriptTop','Good Morning'))}</Script>
          <p>{slot('smallDesc',text||'Your morning breakfast is ready')}</p>
          <button>{slot('buttonText',cta||'BUY')}</button>
        </div>
      </>
      break
    case 'editorial':
      body=<>
        <div className="rtpl-photo photo-center" style={photoStyle(image)}/>
        <div className="rtpl-top-curve"/>
        <Script fitValue={slot('scriptTop','Today’s\nMenu')} className="rtpl-title-top">{lines(slot('scriptTop','Today’s\nMenu'))}</Script>
        <Discount value={discount}/>
        <span className="rtpl-dot-stack"/>
        <div className="rtpl-mini-copy"><strong className={fitClass(slot('overlayTitle',headline))}>{slot('overlayTitle',headline)}</strong><small className="rtpl-safe-copy">{slot('smallDesc',text)}</small></div>
      </>
      break
    case 'hero-menu':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <div className="rtpl-blob blob-a"/><div className="rtpl-blob blob-b"/>
        <span className="rtpl-orange-arc"/>
        <Discount value={discount}/>
        <Script fitValue={slot('scriptRight','Today’s\nMenu')} className="rtpl-script-right">{lines(slot('scriptRight','Today’s\nMenu'))}</Script>
        <div className="rtpl-right-copy"><p className="rtpl-safe-copy">{slot('smallDesc',text)}</p><small className="rtpl-safe-cta">{slot('smallCta',cta)}</small></div>
      </>
      break
    case 'minimal':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <div className="rtpl-diagonal-panel"/>
        <Discount value={discount}/>
        <span className="rtpl-vertical-label">{slot('verticalText','SPECIAL DISCOUNT')}</span>
        <Script fitValue={slot('scriptMain','Breakfast')} className="rtpl-breakfast">{lines(slot('scriptMain','Breakfast'))}</Script>
        <div className="rtpl-left-copy"><p className="rtpl-safe-copy">{slot('smallDesc',text)}</p><small className="rtpl-safe-cta">{slot('smallCta',cta)}</small></div>
      </>
      break
    case 'bold':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <Script fitValue={slot('hugeOffer',badge||'70% OFF')} className="rtpl-huge-off">{lines(slot('hugeOffer',badge||'70% OFF'))}</Script>
        <Discount value={discount}/>
        <div className="rtpl-bottom-strip">
          <Script fitValue={slot('scriptBottom','Today’s Menu')}>{lines(slot('scriptBottom','Today’s Menu'))}</Script>
          <small className="rtpl-safe-copy">{slot('smallDesc',text)}</small>
        </div>
      </>
      break
    case 'poster':
      body=<>
        <div className="rtpl-double-frame outer"/><div className="rtpl-double-frame inner"/>
        <div className="rtpl-photo photo-inset" style={photoStyle(image)}/>
        <div className="rtpl-steak-panel">
          <Script fitValue={slot('scriptMain',headline||'Grilled steak')}>{lines(slot('scriptMain',headline||'Grilled steak'))}</Script>
          <p className="rtpl-safe-copy">{slot('smallDesc',text)}</p>
        </div>
      </>
      break
    case 'split':
      body=<>
        <span className="rtpl-corner-dots left"/>
        <span className="rtpl-label-white">{slot('topLabel','Breakfast')}</span>
        <Script fitValue={slot('scriptMain','Get Delicious\nWith us')} className="rtpl-split-script">{lines(slot('scriptMain','Get Delicious\nWith us'))}</Script>
        <div className="rtpl-white-card"><p className="rtpl-safe-copy">{slot('whiteCardText',text)}</p></div>
        <div className="rtpl-photo photo-bottom" style={photoStyle(image)}/>
        <span className="rtpl-pink-dots"/>
      </>
      break
    case 'promo-badge':
      body=<>
        <Script fitValue={slot('scriptMain','Breakfast')} className="rtpl-grid-script">{lines(slot('scriptMain','Breakfast'))}</Script>
        <div className="rtpl-photo photo-oval" style={photoStyle(image)}/>
        <div className="rtpl-price-grid">
          {(itemSlots.length?itemSlots:[{title:'Food Name',price:price||'$7'},{title:'Food Name',price:price||'$7'},{title:'Food Name',price:price||'$7'}]).slice(0,3).map((item,i)=><div key={i}><strong>{item.price||price||'$7'}</strong><small className={fitClass(item.title||'Food Name')}>{lines(item.title||'Food Name')}</small></div>)}
        </div>
        <p className="rtpl-grid-footer rtpl-safe-copy">{slot('footerText',text)}</p>
      </>
      break
    case 'premium-grid':
      body=<>
        <div className="rtpl-photo photo-diagonal" style={photoStyle(image)}/>
        <div className="rtpl-black-cut"/>
        <Script fitValue={slot('scriptMain','Today’s\nMenu')} className="rtpl-menu-script">{lines(slot('scriptMain','Today’s\nMenu'))}</Script>
        <Discount value={badge||'30% OFF'}/>
        <div className="rtpl-menu-copy"><p className="rtpl-safe-copy">{slot('smallDesc',text)}</p><small className="rtpl-safe-cta">{slot('smallCta',cta)}</small></div>
      </>
      break
    case 'bold-offer':
      body=<>
        <span className="rtpl-corner-dots top-left"/>
        <div className="rtpl-photo-strip top" style={photoStyle(image)}/>
        <div className="rtpl-photo photo-box" style={photoStyle(image)}/>
        <div className="rtpl-photo-strip bottom" style={photoStyle(image)}/>
        <div className="rtpl-side-panel">
          <Script fitValue={slot('scriptMain','Today’s\nMenu')}>{lines(slot('scriptMain','Today’s\nMenu'))}</Script>
          <p>{slot('smallDesc',text)}</p>
        </div>
        <Discount value={discount}/>
      </>
      break
    case 'lunch-time':
      body=<>
        <div className="rtpl-photo photo-right" style={photoStyle(image)}/>
        <div className="rtpl-sale-left">
          <Script fitValue={slot('scriptMain','ANNUAL MEGA\nSALE')}>{lines(slot('scriptMain','ANNUAL MEGA\nSALE'))}</Script>
          <Discount value={discount}/>
          <p>{slot('smallDesc',text)}</p>
        </div>
        <span className="rtpl-sale-slash"/>
      </>
      break
    case 'family':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <span className="rtpl-top-bar"><span className="rtpl-dot-inline"/></span>
        <Script fitValue={slot('scriptMain','Today’s\nSpecial menu')} className="rtpl-special-title">{lines(slot('scriptMain','Today’s\nSpecial menu'))}</Script>
        <Discount value={discount}/>
        <div className="rtpl-photo photo-small" style={photoStyle(image)}/>
        <div className="rtpl-special-copy"><p className="rtpl-safe-copy">{slot('smallDesc',text)}</p><small className="rtpl-safe-cta">{slot('smallCta',cta)}</small></div>
      </>
      break
  }

  return <div className={`restaurant-template-canvas rtpl-${template} ${format} ${className}`} style={rootStyle}>
    {body}
    {logoUrl&&<img className="rtpl-logo" src={logoUrl} alt=""/>}
    <span className="rtpl-accessible-headline">{headline}</span>
  </div>
}
