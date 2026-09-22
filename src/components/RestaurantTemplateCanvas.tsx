import type { CSSProperties, ReactNode } from 'react'
import type { VisualDesignMeta } from '../types'
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
}

function photoStyle(image:string):CSSProperties{
  return image?{backgroundImage:`url("${image.replace(/"/g,'\"')}")`}:{}
}

function Discount({value}:{value:string}){
  const clean=value.trim()||'20% OFF'
  const parts=clean.split(/\s+/)
  return <span className="rtpl-discount"><strong>{parts[0]}</strong><small>{parts.slice(1).join(' ')||'OFF'}</small></span>
}

function Script({children,className=''}:{children:ReactNode;className?:string}){
  return <span className={`rtpl-script ${className}`}>{children}</span>
}

function CommonCopy({headline,text,price,cta}:{headline:string;text:string;price?:string;cta?:string}){
  return <div className="rtpl-common-copy">
    {price&&<em>{price}</em>}
    <h3>{headline}</h3>
    {text&&<p>{slot('smallDesc',text)}</p>}
    {cta&&<b>{cta}</b>}
  </div>
}

export function RestaurantTemplateCanvas({
  template,image,headline,text,price='',badge='',cta='BUY',primary,accent,logoUrl,format='feed',className='',textSlots={},itemSlots=[],
}:Props){
  const rootStyle={
    '--rt-primary':primary,
    '--rt-accent':accent,
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
          <Script>{lines(slot('scriptTop','Good Morning'))}</Script>
          <p>{slot('smallDesc',text||'Your morning breakfast is ready')}</p>
          <button>{slot('buttonText',cta||'BUY')}</button>
        </div>
      </>
      break
    case 'editorial':
      body=<>
        <div className="rtpl-photo photo-center" style={photoStyle(image)}/>
        <div className="rtpl-top-curve"/>
        <Script className="rtpl-title-top">{lines(slot('scriptTop','Today’s\nMenu'))}</Script>
        <Discount value={discount}/>
        <span className="rtpl-dot-stack"/>
        <div className="rtpl-mini-copy"><strong>{slot('overlayTitle',headline)}</strong><small>{slot('smallDesc',text)}</small></div>
      </>
      break
    case 'hero-menu':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <div className="rtpl-blob blob-a"/><div className="rtpl-blob blob-b"/>
        <span className="rtpl-orange-arc"/>
        <Discount value={discount}/>
        <Script className="rtpl-script-right">{lines(slot('scriptRight','Today’s\nMenu'))}</Script>
        <div className="rtpl-right-copy"><p>{slot('smallDesc',text)}</p><small>{slot('smallCta',cta)}</small></div>
      </>
      break
    case 'minimal':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <div className="rtpl-diagonal-panel"/>
        <Discount value={discount}/>
        <span className="rtpl-vertical-label">{slot('verticalText','SPECIAL DISCOUNT')}</span>
        <Script className="rtpl-breakfast">{lines(slot('scriptMain','Breakfast'))}</Script>
        <div className="rtpl-left-copy"><p>{slot('smallDesc',text)}</p><small>{slot('smallCta',cta)}</small></div>
      </>
      break
    case 'bold':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <Script className="rtpl-huge-off">{lines(slot('hugeOffer',badge||'70% OFF'))}</Script>
        <Discount value={discount}/>
        <div className="rtpl-bottom-strip">
          <Script>{lines(slot('scriptBottom','Today’s Menu'))}</Script>
          <small>{slot('smallDesc',text)}</small>
        </div>
      </>
      break
    case 'poster':
      body=<>
        <div className="rtpl-double-frame outer"/><div className="rtpl-double-frame inner"/>
        <div className="rtpl-photo photo-inset" style={photoStyle(image)}/>
        <div className="rtpl-steak-panel">
          <Script>{lines(slot('scriptMain',headline||'Grilled steak'))}</Script>
          <p>{slot('smallDesc',text)}</p>
        </div>
      </>
      break
    case 'split':
      body=<>
        <span className="rtpl-corner-dots left"/>
        <span className="rtpl-label-white">{slot('topLabel','Breakfast')}</span>
        <Script className="rtpl-split-script">{lines(slot('scriptMain','Get Delicious\nWith us'))}</Script>
        <div className="rtpl-white-card"><p>{slot('whiteCardText',text)}</p></div>
        <div className="rtpl-photo photo-bottom" style={photoStyle(image)}/>
        <span className="rtpl-pink-dots"/>
      </>
      break
    case 'promo-badge':
      body=<>
        <Script className="rtpl-grid-script">{lines(slot('scriptMain','Breakfast'))}</Script>
        <div className="rtpl-photo photo-oval" style={photoStyle(image)}/>
        <div className="rtpl-price-grid">
          {(itemSlots.length?itemSlots:[{title:'Food Name',price:price||'$7'},{title:'Food Name',price:price||'$7'},{title:'Food Name',price:price||'$7'}]).slice(0,3).map((item,i)=><div key={i}><strong>{item.price||price||'$7'}</strong><small>{lines(item.title||'Food Name')}</small></div>)}
        </div>
        <p className="rtpl-grid-footer">{slot('footerText',text)}</p>
      </>
      break
    case 'premium-grid':
      body=<>
        <div className="rtpl-photo photo-diagonal" style={photoStyle(image)}/>
        <div className="rtpl-black-cut"/>
        <Script className="rtpl-menu-script">{lines(slot('scriptMain','Today’s\nMenu'))}</Script>
        <Discount value={badge||'30% OFF'}/>
        <div className="rtpl-menu-copy"><p>{slot('smallDesc',text)}</p><small>{slot('smallCta',cta)}</small></div>
      </>
      break
    case 'bold-offer':
      body=<>
        <span className="rtpl-corner-dots top-left"/>
        <div className="rtpl-photo-strip top" style={photoStyle(image)}/>
        <div className="rtpl-photo photo-box" style={photoStyle(image)}/>
        <div className="rtpl-photo-strip bottom" style={photoStyle(image)}/>
        <div className="rtpl-side-panel">
          <Script>{lines(slot('scriptMain','Today’s\nMenu'))}</Script>
          <p>{slot('smallDesc',text)}</p>
        </div>
        <Discount value={discount}/>
      </>
      break
    case 'lunch-time':
      body=<>
        <div className="rtpl-photo photo-right" style={photoStyle(image)}/>
        <div className="rtpl-sale-left">
          <Script>{lines(slot('scriptMain','ANNUAL MEGA\nSALE'))}</Script>
          <Discount value={discount}/>
          <p>{text}</p>
        </div>
        <span className="rtpl-sale-slash"/>
      </>
      break
    case 'family':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <span className="rtpl-top-bar"><span className="rtpl-dot-inline"/></span>
        <Script className="rtpl-special-title">{lines(slot('scriptMain','Today’s\nSpecial menu'))}</Script>
        <Discount value={discount}/>
        <div className="rtpl-photo photo-small" style={photoStyle(image)}/>
        <div className="rtpl-special-copy"><p>{slot('smallDesc',text)}</p><small>{slot('smallCta',cta)}</small></div>
      </>
      break
  }

  return <div className={`restaurant-template-canvas rtpl-${template} ${format} ${className}`} style={rootStyle}>
    {body}
    {logoUrl&&<img className="rtpl-logo" src={logoUrl} alt=""/>}
    <span className="rtpl-accessible-headline">{headline}</span>
  </div>
}
