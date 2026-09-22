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
    {text&&<p>{text}</p>}
    {cta&&<b>{cta}</b>}
  </div>
}

export function RestaurantTemplateCanvas({
  template,image,headline,text,price='',badge='',cta='BUY',primary,accent,logoUrl,format='feed',className='',
}:Props){
  const rootStyle={
    '--rt-primary':primary,
    '--rt-accent':accent,
  } as CSSProperties
  const discount=badge||'20% OFF'

  let body
  switch(template){
    case 'luxe':
      body=<>
        <span className="rtpl-corner-dots top-left"/><span className="rtpl-corner-dots bottom-right"/>
        <div className="rtpl-frame"/>
        <div className="rtpl-photo photo-main" style={photoStyle(image)}/>
        <div className="rtpl-bottom-band">
          <Script>Good Morning</Script>
          <p>{text||'Your morning breakfast is ready'}</p>
          <button>{cta||'BUY'}</button>
        </div>
      </>
      break
    case 'editorial':
      body=<>
        <div className="rtpl-photo photo-center" style={photoStyle(image)}/>
        <div className="rtpl-top-curve"/>
        <Script className="rtpl-title-top">Today’s<br/>Menu</Script>
        <Discount value={discount}/>
        <span className="rtpl-dot-stack"/>
        <div className="rtpl-mini-copy"><strong>{headline}</strong><small>{text}</small></div>
      </>
      break
    case 'hero-menu':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <div className="rtpl-blob blob-a"/><div className="rtpl-blob blob-b"/>
        <span className="rtpl-orange-arc"/>
        <Discount value={discount}/>
        <Script className="rtpl-script-right">Today’s<br/>Menu</Script>
        <div className="rtpl-right-copy"><p>{text}</p><small>{cta}</small></div>
      </>
      break
    case 'minimal':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <div className="rtpl-diagonal-panel"/>
        <Discount value={discount}/>
        <span className="rtpl-vertical-label">SPECIAL DISCOUNT</span>
        <Script className="rtpl-breakfast">Breakfast</Script>
        <div className="rtpl-left-copy"><p>{text}</p><small>{cta}</small></div>
      </>
      break
    case 'bold':
      body=<>
        <div className="rtpl-photo photo-full" style={photoStyle(image)}/>
        <Script className="rtpl-huge-off">{badge||'70% OFF'}</Script>
        <Discount value={discount}/>
        <div className="rtpl-bottom-strip">
          <Script>Today’s Menu</Script>
          <small>{text}</small>
        </div>
      </>
      break
    case 'poster':
      body=<>
        <div className="rtpl-double-frame outer"/><div className="rtpl-double-frame inner"/>
        <div className="rtpl-photo photo-inset" style={photoStyle(image)}/>
        <div className="rtpl-steak-panel">
          <Script>{headline||'Grilled steak'}</Script>
          <p>{text}</p>
        </div>
      </>
      break
    case 'split':
      body=<>
        <span className="rtpl-corner-dots left"/>
        <span className="rtpl-label-white">Breakfast</span>
        <Script className="rtpl-split-script">Get Delicious<br/>With us</Script>
        <div className="rtpl-white-card"><p>{text}</p></div>
        <div className="rtpl-photo photo-bottom" style={photoStyle(image)}/>
        <span className="rtpl-pink-dots"/>
      </>
      break
    case 'promo-badge':
      body=<>
        <Script className="rtpl-grid-script">Breakfast</Script>
        <div className="rtpl-photo photo-oval" style={photoStyle(image)}/>
        <div className="rtpl-price-grid">
          {[0,1,2].map(i=><div key={i}><strong>{price||'$7'}</strong><small>Food<br/>Name</small></div>)}
        </div>
        <p className="rtpl-grid-footer">{text}</p>
      </>
      break
    case 'premium-grid':
      body=<>
        <div className="rtpl-photo photo-diagonal" style={photoStyle(image)}/>
        <div className="rtpl-black-cut"/>
        <Script className="rtpl-menu-script">Today’s<br/>Menu</Script>
        <Discount value={badge||'30% OFF'}/>
        <div className="rtpl-menu-copy"><p>{text}</p><small>{cta}</small></div>
      </>
      break
    case 'bold-offer':
      body=<>
        <span className="rtpl-corner-dots top-left"/>
        <div className="rtpl-photo-strip top" style={photoStyle(image)}/>
        <div className="rtpl-photo photo-box" style={photoStyle(image)}/>
        <div className="rtpl-photo-strip bottom" style={photoStyle(image)}/>
        <div className="rtpl-side-panel">
          <Script>Today’s<br/>Menu</Script>
          <p>{text}</p>
        </div>
        <Discount value={discount}/>
      </>
      break
    case 'lunch-time':
      body=<>
        <div className="rtpl-photo photo-right" style={photoStyle(image)}/>
        <div className="rtpl-sale-left">
          <Script>ANNUAL MEGA<br/>SALE</Script>
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
        <Script className="rtpl-special-title">Today’s<br/>Special menu</Script>
        <Discount value={discount}/>
        <div className="rtpl-photo photo-small" style={photoStyle(image)}/>
        <div className="rtpl-special-copy"><p>{text}</p><small>{cta}</small></div>
      </>
      break
  }

  return <div className={`restaurant-template-canvas rtpl-${template} ${format} ${className}`} style={rootStyle}>
    {body}
    {logoUrl&&<img className="rtpl-logo" src={logoUrl} alt=""/>}
    <span className="rtpl-accessible-headline">{headline}</span>
  </div>
}
