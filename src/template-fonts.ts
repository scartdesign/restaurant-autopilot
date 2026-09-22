export type BaseFontId='modern-sans'|'soft-sans'|'elegant-serif'|'classic-serif'|'bold-display'
export type ScriptFontId='signature'|'handwritten'|'elegant-script'|'casual-script'|'retro-script'

export const baseFontOptions:Array<{id:BaseFontId;name:string;stack:string;sample:string}>=[
  {id:'modern-sans',name:'DM Sans',stack:'"DM Sans", Arial, sans-serif',sample:'Aa'},
  {id:'soft-sans',name:'Manrope',stack:'Manrope, "DM Sans", Arial, sans-serif',sample:'Aa'},
  {id:'elegant-serif',name:'Playfair',stack:'"Playfair Display", Georgia, serif',sample:'Aa'},
  {id:'classic-serif',name:'DM Serif',stack:'"DM Serif Display", Georgia, serif',sample:'Aa'},
  {id:'bold-display',name:'Bebas',stack:'"Bebas Neue", Impact, sans-serif',sample:'Aa'},
]

export const scriptFontOptions:Array<{id:ScriptFontId;name:string;stack:string;sample:string}>=[
  {id:'signature',name:'Allura',stack:'Allura, "Brush Script MT", cursive',sample:'Today’s Menu'},
  {id:'handwritten',name:'Dancing Script',stack:'"Dancing Script", "Segoe Script", cursive',sample:'Today’s Menu'},
  {id:'elegant-script',name:'Great Vibes',stack:'"Great Vibes", Allura, cursive',sample:'Today’s Menu'},
  {id:'casual-script',name:'Caveat',stack:'Caveat, "Segoe Print", cursive',sample:'Today’s Menu'},
  {id:'retro-script',name:'Parisienne',stack:'Parisienne, Allura, cursive',sample:'Today’s Menu'},
]

export function baseFontStack(id?:string){
  return baseFontOptions.find(item=>item.id===id)?.stack||baseFontOptions[0].stack
}
export function scriptFontStack(id?:string){
  return scriptFontOptions.find(item=>item.id===id)?.stack||scriptFontOptions[0].stack
}
export function defaultBaseFont(template:string):BaseFontId{
  if(template==='luxe'||template==='editorial'||template==='premium-grid'||template==='split'||template==='family')return 'elegant-serif'
  if(template==='bold'||template==='poster'||template==='bold-offer'||template==='promo-badge'||template==='lunch-time')return 'bold-display'
  return 'modern-sans'
}
export function baseFontFromLegacyPair(pair?:string):BaseFontId{
  if(pair==='editorial')return 'elegant-serif'
  if(pair==='impact')return 'bold-display'
  return 'modern-sans'
}
