export function RestorappSidebarLogo(){
  return <svg className="restorapp-sidebar-logo-svg" viewBox="0 0 760 180" role="img" aria-label="Restorapp" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="restorappGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f4d47e"/>
        <stop offset="48%" stopColor="#d6a84e"/>
        <stop offset="100%" stopColor="#b77d20"/>
      </linearGradient>
      <linearGradient id="restorappWhite" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff"/>
        <stop offset="100%" stopColor="#e9ecea"/>
      </linearGradient>
    </defs>
    <g transform="translate(8 10)">
      <circle cx="80" cy="80" r="68" fill="none" stroke="url(#restorappGold)" strokeWidth="10"/>
      <path d="M31 102h98" stroke="url(#restorappGold)" strokeWidth="9" strokeLinecap="round"/>
      <path d="M43 96c3-29 19-48 37-48s34 19 37 48H43Z" fill="url(#restorappGold)"/>
      <circle cx="80" cy="42" r="8" fill="url(#restorappGold)"/>
      <path d="M103 56c17-12 18-28 9-42 17 12 25 28 18 43-5 11-15 17-27 21 6-7 7-14 0-22Z" fill="url(#restorappWhite)"/>
    </g>
    <text x="174" y="119" fontFamily="Inter, Arial, sans-serif" fontSize="86" fontWeight="800" letterSpacing="-3">
      <tspan fill="url(#restorappWhite)">Restor</tspan><tspan fill="url(#restorappGold)">app</tspan>
    </text>
  </svg>
}
