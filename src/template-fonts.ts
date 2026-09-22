export type BaseFontId='modern-sans'|'soft-sans'|'elegant-serif'|'classic-serif'|'bold-display'
export type ScriptFontId='signature'|'handwritten'|'elegant-script'|'casual-script'|'retro-script'

export const baseFontOptions:Array<{id:BaseFontId;name:string;stack:string;sample:string}>=[
  {id:'modern-sans',name:'Modern Sans',stack:'Arial, Helvetica, sans-serif',sample:'Aa'},
  {id:'soft-sans',name:'Soft Sans',stack:'"Trebuchet MS", Arial, sans-serif',sample:'Aa'},
  {id:'elegant-serif',name:'Elegant Serif',stack:'Georgia, "Times New Roman", serif',sample:'Aa'},
  {id:'classic-serif',name:'Classic Serif',stack:'"Times New Roman", Times, serif',sample:'Aa'},
  {id:'bold-display',name:'Bold Display',stack:'Impact, "Arial Black", Arial, sans-serif',sample:'Aa'},
]

export const scriptFontOptions:Array<{id:ScriptFontId;name:string;stack:string;sample:string}>=[
  {id:'signature',name:'Signature',stack:'"Brush Script MT", "Segoe Script", "URW Chancery L", cursive',sample:'Today’s Menu'},
  {id:'handwritten',name:'Handwritten',stack:'"Segoe Script", "Lucida Handwriting", "Brush Script MT", cursive',sample:'Today’s Menu'},
  {id:'elegant-script',name:'Elegant Script',stack:'"Snell Roundhand", "Apple Chancery", "URW Chancery L", cursive',sample:'Today’s Menu'},
  {id:'casual-script',name:'Casual Script',stack:'"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',sample:'Today’s Menu'},
  {id:'retro-script',name:'Retro Script',stack:'"Lucida Handwriting", "Brush Script MT", "Segoe Script", cursive',sample:'Today’s Menu'},
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
