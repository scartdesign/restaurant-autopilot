import type { CSSProperties } from 'react'

export function RestorappLogo({
  variant='wordmark',
  surface='dark',
  tagline=false,
  className='',
  style,
}:{
  variant?:'wordmark'|'icon'
  surface?:'dark'|'light'
  tagline?:boolean
  className?:string
  style?:CSSProperties
}){
  const text=surface==='dark'?'#F7F5EF':'#111B17'
  const gold='#D6A84F'
  const muted=surface==='dark'?'#C9D0CB':'#6E756F'

  if(variant==='icon'){
    return <svg className={className} style={style} viewBox="0 0 120 120" role="img" aria-label="Restorapp">
      <path d="M24 58c-10-3-17-12-17-23C7 20 20 8 36 8c7 0 13 2 18 6C61 6 71 2 82 2c20 0 36 15 38 34 0 17-10 31-26 36" fill="none" stroke={gold} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M31 43v34M42 43v34M53 43v34M42 77v31" fill="none" stroke={text} strokeWidth="7" strokeLinecap="round"/>
      <path d="M23 103c22-20 49-30 79-27-21 5-39 16-56 34" fill="none" stroke={gold} strokeWidth="8" strokeLinecap="round"/>
    </svg>
  }

  return <svg className={className} style={style} viewBox="0 0 430 112" role="img" aria-label="Restorapp">
    <g transform="translate(2 2)">
      <path d="M22 55c-10-3-17-12-17-23C5 17 18 5 34 5c7 0 13 2 18 6C59 3 69 0 80 0c20 0 36 15 38 34 0 16-9 30-24 35" fill="none" stroke={gold} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M29 39v33M40 39v33M51 39v33M40 72v30" fill="none" stroke={text} strokeWidth="6" strokeLinecap="round"/>
      <path d="M20 97c21-19 47-28 76-25-20 5-38 16-54 32" fill="none" stroke={gold} strokeWidth="7" strokeLinecap="round"/>
    </g>
    <text x="118" y="67" fontFamily="Inter,Arial,sans-serif" fontSize="54" fontWeight="800" letterSpacing="-2.2" fill={text}>Restor<tspan fill={gold}>app</tspan></text>
    {tagline&&<text x="121" y="94" fontFamily="Inter,Arial,sans-serif" fontSize="10.5" fontWeight="700" letterSpacing="3.4" fill={muted}>SMART RESTAURANTS GROW FASTER</text>}
  </svg>
}
