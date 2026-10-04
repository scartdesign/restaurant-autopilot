// Ported from the supplied food-poster prototype. Coordinates use a 1080 px artboard.
export type PosterLayout={e:readonly number[];s:'b'|'t'|'l'|'r';t:readonly number[]}
const W=1080
export const LF:Record<string,PosterLayout>={fb1:{e:[0,.59,1,.49],s:'b',t:[.075,.63,.85,.32]},fb2:{e:[0,.49,1,.59],s:'b',t:[.075,.63,.85,.32]},ft1:{e:[0,.49,1,.57],s:'t',t:[.075,.055,.85,.39]},ft2:{e:[0,.57,1,.49],s:'t',t:[.075,.055,.85,.39]},fl1:{e:[.46,0,.38,1],s:'l',t:[.06,.1,.3,.8]},fl2:{e:[.38,0,.46,1],s:'l',t:[.06,.1,.3,.8]},fr1:{e:[.62,0,.54,1],s:'r',t:[.65,.1,.29,.8]},fr2:{e:[.54,0,.62,1],s:'r',t:[.65,.1,.29,.8]},fd:{e:[0,.66,1,.36],s:'b',t:[.15,.66,.79,.29]},fdl:{e:[0,.36,1,.66],s:'b',t:[.075,.66,.79,.29]}};
export const LS:Record<string,PosterLayout>={sb1:{e:[0,.6,1,.52],s:'b',t:[.08,.625,.84,.195]},sb2:{e:[0,.52,1,.6],s:'b',t:[.08,.625,.84,.195]},sbs:{e:[0,.62,1,.48],s:'b',t:[.08,.65,.84,.17]},sbs2:{e:[0,.48,1,.62],s:'b',t:[.08,.65,.84,.17]},st1:{e:[0,.38,1,.46],s:'t',t:[.08,.13,.84,.22]},st2:{e:[0,.46,1,.38],s:'t',t:[.08,.13,.84,.22]}};
export const D=([
['luxe',"'Playfair Display',Georgia,serif",700,'none','-.01em','left','script','tag','pill','line','fb1','sb1',104,72,1.05],
['hero-menu',"Anton,Impact,sans-serif",400,'uppercase','.02em','left','caps','badge','sq','none','ft2','st1',120,72,1],
['editorial',"'DM Serif Display',Georgia,serif",400,'none','-.01em','left','caps','inline','arrow','line','fl1','st2',100,72,1.02],
['minimal',"Montserrat,sans-serif",300,'uppercase','.16em','center','none','inline','out','none','fb2','sb2',74,72,1.15],
['bold',"'Archivo Black',Impact,sans-serif",400,'uppercase','-.01em','right','pill','big','sq','none','fd','sbs',100,84,.98],
['split',"Oswald,Impact,sans-serif",600,'uppercase','.03em','left','caps','badge','pill','line','fr1','sbs2',110,72,1.02],
['poster',"'Bebas Neue',Impact,sans-serif",400,'uppercase','.02em','left','script','big','pill','none','fdl','sb2',150,90,.92],
['promo-badge',"Poppins,sans-serif",800,'none','-.02em','left','pill','badge','pill','none','ft1','sbs',96,72,1.02],
['premium-grid',"'Cormorant Garamond',Georgia,serif",600,'uppercase','.08em','center','caps','tag','out','dots','fl2','st2',90,72,1.05],
['bold-offer',"Anton,Impact,sans-serif",400,'uppercase','.01em','center','pill','big','sq','line','fr2','sbs',84,110,1],
['lunch-time',"Pacifico,cursive",400,'none','0','left','caps','inline','pill','dots','fb1','sb1',88,72,1.25],
['family',"Fredoka,Poppins,sans-serif",700,'none','0','center','pill','tag','pill','none','ft2','st1',104,72,1.02]
] as const).map(a=>({id:a[0],tf:a[1],tw:a[2],tc:a[3],ls:a[4],al:a[5],k:a[6],p:a[7],c:a[8],r:a[9],F:a[10],S:a[11],ts:a[12],pk:a[13],lh:a[14]}));

export type PosterDesign=typeof D[number]
const rng=(s:number)=>{let a=s>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
const hash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
export function geo(L:PosterLayout,H:number){const[a,b,c,d]=L.e,p0=[a*W,b*H],p1=[c*W,d*H],dx=p1[0]-p0[0],dy=p1[1]-p0[1],len=Math.hypot(dx,dy);
const m=1.2,cor={b:[[m*W,m*H],[-.2*W,m*H]],t:[[m*W,-.2*H],[-.2*W,-.2*H]],l:[[-.2*W,m*H],[-.2*W,-.2*H]],r:[[m*W,m*H],[m*W,-.2*H]]}[L.s];
const cen=[(cor[0][0]+cor[1][0])/2,(cor[0][1]+cor[1][1])/2];let nx=-dy/len,ny=dx/len;
const mx=(p0[0]+p1[0])/2,my=(p0[1]+p1[1])/2;if(nx*(cen[0]-mx)+ny*(cen[1]-my)>0){nx=-nx;ny=-ny}
return{p0,p1,dx,dy,len,cor,nx,ny,sg:Math.sign(dx*(cen[1]-p0[1])-dy*(cen[0]-p0[0]))}}
export function brush(d:PosterDesign,fmt:string,L:PosterLayout,H:number,id:string,color:string){const g=geo(L,H),r=rng(hash(d.id+fmt)),sd=hash(d.id+fmt)%97,len=g.len,
ang=Math.atan2(g.dy,g.dx)*180/Math.PI,tx=`translate(${g.p0[0].toFixed(1)} ${g.p0[1].toFixed(1)}) rotate(${ang.toFixed(2)}) scale(1 ${g.sg||1})`,
x0=-.3*len,ww=1.6*len,A='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0',fy=(.05+r()*.04).toFixed(3),fx=(.006+r()*.004).toFixed(4);
let tex='';for(let k=0;k<44;k++){tex+=`<path d="M${(x0+r()*ww).toFixed(0)} ${(30+r()*150).toFixed(0)}h${(60+r()*320).toFixed(0)}" stroke="${r()<.5?'#000':'#fff'}" stroke-opacity="${(.04+r()*.06).toFixed(2)}" stroke-width="${(1+r()*4).toFixed(1)}"/>`}
return`<svg class="br" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="bg${id}" gradientUnits="userSpaceOnUse" x1="0" y1="-95" x2="0" y2="8"><stop offset="0" stop-opacity="0"/><stop offset="1"/></linearGradient>
<filter id="rf${id}" filterUnits="userSpaceOnUse" x="${x0}" y="-115" width="${ww}" height="190" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="3" seed="${sd}" result="n"/><feColorMatrix in="n" values="${A}" result="na"/>
<feTurbulence type="fractalNoise" baseFrequency=".003 .014" numOctaves="2" seed="${sd+7}" result="m"/><feColorMatrix in="m" values="${A}" result="ma"/>
<feComposite in="SourceAlpha" in2="na" operator="arithmetic" k2="1" k3="1.5" k4="-.75" result="c1"/>
<feComposite in="c1" in2="ma" operator="arithmetic" k2="1" k3=".6" k4="-.3" result="c2"/>
<feComponentTransfer in="c2" result="c3"><feFuncA type="linear" slope="9" intercept="-3.6"/></feComponentTransfer>
<feFlood style="flood-color:${color}" result="fl"/><feComposite in="fl" in2="c3" operator="in"/></filter><filter id="ed${id}" filterUnits="userSpaceOnUse" x="${x0}" y="-40" width="${ww}" height="130"><feTurbulence type="fractalNoise" baseFrequency=".006 .04" numOctaves="3" seed="${sd+3}"/><feDisplacementMap in="SourceGraphic" scale="20"/></filter></defs>
<g transform="${tx}"><rect x="${x0}" y="-105" width="${ww}" height="170" fill="url(#bg${id})" filter="url(#rf${id})"/><rect x="${x0}" y="-6" width="${ww}" height="70" fill="${color}" filter="url(#ed${id})"/><rect x="${x0}" y="50" width="${ww}" height="3200" fill="${color}"/></g></svg>`}

export const posterPalettes=[
 {name:'Šuma',primary:'#16473f',accent:'#c08a5e'},
 {name:'Bordo',primary:'#6b1d2a',accent:'#f0bd78'},
 {name:'Ugalj',primary:'#1f2328',accent:'#e8a93e'},
 {name:'Paradajz',primary:'#c8321f',accent:'#ffe3a3'},
 {name:'Krem',primary:'#f1e6d3',accent:'#9b3d1f'},
 {name:'Mornar',primary:'#14284b',accent:'#f4b86f'},
]
export function safeColor(value:string,fallback:string){
 const hex=value.trim();return /^#[0-9a-f]{6}$/i.test(hex)?hex:/^#[0-9a-f]{3}$/i.test(hex)?'#'+hex.slice(1).split('').map(c=>c+c).join(''):fallback
}
export function luminance(hex:string){
 const n=parseInt(hex.slice(1),16),f=(v:number)=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}
 return .2126*f(n>>16)+.7152*f(n>>8&255)+.0722*f(n&255)
}
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export function readableInk(background:string){return contrast(background,'#17120d')>contrast(background,'#fbf6ee')?'#17120d':'#fbf6ee'}
// Cover only the photo's visible bounding region, including the translucent brush fringe.
// Clamping against the entire artboard would lock square Feed photos at 50/50 and
// unnecessarily magnify square photos in Story, even though paint hides half the image.
export function visiblePhotoBounds(layout:PosterLayout,height:number){
 const g=geo(layout,height),fringe=80
 const xs=g.p0[0],xe=g.p1[0],ys=g.p0[1],ye=g.p1[1]
 const left=layout.s==='l'?Math.max(0,Math.min(xs,xe)-fringe):0
 const right=layout.s==='r'?Math.min(W,Math.max(xs,xe)+fringe):W
 const top=layout.s==='t'?Math.max(0,Math.min(ys,ye)-fringe):0
 const bottom=layout.s==='b'?Math.min(height,Math.max(ys,ye)+fringe):height
 return {left,right,top,bottom}
}
export function photoCrop(layout:PosterLayout,height:number,iw:number,ih:number,fx=50,fy=50,zoom=1){
 const b=visiblePhotoBounds(layout,height),cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2
 const scale=Math.max((b.right-b.left)/iw,(b.bottom-b.top)/ih)*Math.min(2.2,Math.max(1,zoom)),width=iw*scale,h=ih*scale
 return {width,height:h,left:Math.min(b.left,Math.max(b.right-width,cx-Math.min(100,Math.max(0,fx))/100*width)),top:Math.min(b.top,Math.max(b.bottom-h,cy-Math.min(100,Math.max(0,fy))/100*h))}
}
export function layoutClearance(layout:PosterLayout,height:number){
 const g=geo(layout,height),[x,y,w,h]=layout.t
 return Math.min(...[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([cx,cy])=>g.sg*(g.dx*(cy*height-g.p0[1])-g.dy*(cx*W-g.p0[0]))/g.len))
}
// Measure the complete block and every visible element; never clamp or hide copy.
export function fitPoster(stage:HTMLElement,preference=1){
 const box=stage.querySelector<HTMLElement>('.pe-tx')!,inner=stage.querySelector<HTMLElement>('.pe-in')!
 const elements=Array.from(inner.querySelectorAll<HTMLElement>('.pe-k,.pe-t,.pe-d,.pe-pr,.pe-c'))
 const start=(stage.offsetHeight>1080?2:1.7)*Math.min(1.15,Math.max(.85,preference))
 let fits=false
 for(const floor of [.95,.85,.72,.6,.48,.36,.24]){
  for(let s=start;s>=.16;s-=.025){
   stage.style.setProperty('--s',String(s));stage.style.setProperty('--s2',String(Math.min(1.3,Math.max(floor,s))))
   fits=inner.offsetHeight<=box.clientHeight+1&&elements.every(el=>{
    if(!el.offsetHeight)return true
    // Read artboard coordinates; rotated price badges and preview scale must not
    // force otherwise readable text down to thumbnail-size fonts.
    return el.scrollWidth<=el.clientWidth+2&&el.offsetLeft+el.offsetWidth<=inner.clientWidth+2
   })
   if(fits)break
  }
  const title=stage.querySelector<HTMLElement>('.pe-t')!
  const readableTitle=(title.textContent||'').length>45?38:58
  if(fits&&(parseFloat(getComputedStyle(title).fontSize)>=readableTitle||floor===.24))break
 }
 stage.dataset.fit=fits?'true':'false'
 return fits
}
