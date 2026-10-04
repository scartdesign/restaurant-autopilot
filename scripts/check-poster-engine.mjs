import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('../src/lib/poster-engine.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const {D,LF,LS,layoutClearance,photoCrop,visiblePhotoBounds,posterPalettes,readableInk,contrast,brush,safeColor}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
const ids=['luxe','hero-menu','editorial','minimal','bold','split','poster','promo-badge','premium-grid','bold-offer','lunch-time','family']
assert.deepEqual(D.map(d=>d.id),ids)
assert.equal(new Set(D.map(d=>[d.tf,d.al,d.k,d.p,d.c,d.r,d.F,d.S].join('|'))).size,12)
for(const d of D){
 for(const [format,height,layout] of [['feed',1080,LF[d.F]],['story',1920,LS[d.S]]]){
  assert(layout,`${d.id}/${format}: missing layout`)
  assert(layoutClearance(layout,height)>=24,`${d.id}/${format}: text touches paint edge`)
  const [x,y,w,h]=layout.t
  assert(x>=0&&y>=0&&x+w<=1&&y+h<=1)
  if(format==='story'){assert(y*height>=249);assert((y+h)*height<=height-340+1)}
  for(const [iw,ih] of [[1800,1800],[2400,1600],[1600,2400]]){
   for(const focus of [0,30,50,70,100])for(const zoom of [1,1.5,2.2]){
    const crop=photoCrop(layout,height,iw,ih,focus,focus,zoom)
    assert(Math.abs(crop.width/crop.height-iw/ih)<1e-8,'Photo aspect ratio changed')
    const bounds=visiblePhotoBounds(layout,height)
    assert(crop.width>=bounds.right-bounds.left-.001&&crop.height>=bounds.bottom-bounds.top-.001)
    assert(crop.left<=bounds.left&&crop.top<=bounds.top&&crop.left+crop.width>=bounds.right-.001&&crop.top+crop.height>=bounds.bottom-.001,'Uncovered photo edge')
   }
  }
  const a=brush(d,format,layout,height,'test','#16473f'),b=brush(d,format,layout,height,'test','#f1e6d3')
  assert.equal(a.replaceAll('#16473f','PAINT'),b.replaceAll('#f1e6d3','PAINT'),'Brand Kit changed brush geometry')
  assert(a.includes('feTurbulence')&&a.includes('feDisplacementMap')&&a.includes('feComponentTransfer'))
 }
 assert.notDeepEqual(LF[d.F].t,LS[d.S].t,'Story copied Feed geometry')
}
for(const p of [...posterPalettes,...['#808080','#ffffff','#000000','#ffaa00','#99ccff'].map(primary=>({primary,accent:'#ff00ff'}))])assert(contrast(p.primary,readableInk(p.primary))>=4.5,`Un readable ${p.primary}`)
assert.equal(safeColor('#abc','fallback'),'#aabbcc')
assert.equal(safeColor('invalid','fallback'),'fallback')
const css=readFileSync(new URL('../src/restaurant-template-modern.css',import.meta.url),'utf8')
assert(!css.includes('!important')&&!css.includes('line-clamp'),'Renderer contains forced clipping overrides')
const studio=readFileSync(new URL('../src/components/SimpleContentStudio.tsx',import.meta.url),'utf8')
assert(studio.includes('...(existingPost?.generation_meta?.visual_design||{})'),'Existing design metadata discarded')
assert(studio.includes("poster_engine:'brush-v1'"))
console.log('Poster engine: 12 IDs, 24 layouts, safe zones, 1080 crop cases, contrast, stable brush and metadata guards passed.')

const fieldSource=readFileSync(new URL('../src/lib/poster-post-fields.ts',import.meta.url),'utf8')
const fieldCode=ts.transpileModule(fieldSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const {posterPostFields}=await import('data:text/javascript;base64,'+Buffer.from(fieldCode).toString('base64'))
const legacy={title:'Burger',caption:'Ceo tekst objave koji mora ostati sačuvan.',cta:'Poruči odmah',menu_item_id:'dish',generation_meta:{}}
const snapshot=JSON.stringify(legacy)
assert.deepEqual(posterPostFields(legacy,[{id:'dish',price:1290,currency:'RSD'}]),{headline:'Burger',description:legacy.caption,cta:'Poruči odmah',price:'1290 RSD',badge:''})
const generated={...legacy,generation_meta:{visual_design:{headline:'Truffle Smash Burger',subline:'Kratak opis za poster',cta:'Rezerviši sto'}}}
assert.equal(posterPostFields(generated).description,'Kratak opis za poster')
assert.equal(generated.caption,legacy.caption)
const oldSlots={...legacy,generation_meta:{manual_fields:{price:''},visual_design:{text_slots:{overlayTitle:'Stari naziv',smallDesc:'Stari opis',buttonText:'Stari CTA'},item_slots:[{title:'Jelo',price:'900 RSD'}]}}}
assert.deepEqual(posterPostFields(oldSlots),{headline:'Stari naziv',description:'Stari opis',cta:'Stari CTA',price:'',badge:''})
assert.equal(JSON.stringify(legacy),snapshot,'Legacy metadata was mutated')

// Render actual React components from legacy props without requiring new fields.
process.env.NODE_ENV='production'
const {createRequire}=await import('node:module'),{pathToFileURL}=await import('node:url')
const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href,jsxUrl=pathToFileURL(require.resolve('react/jsx-runtime')).href
const fontsCode=ts.transpileModule(readFileSync(new URL('../src/template-fonts.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
const dataUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
let rendererCode=ts.transpileModule(readFileSync(new URL('../src/components/RestaurantTemplateCanvas.tsx',import.meta.url),'utf8').replace(/^import ['"][^'"]+\.css['"]\s*$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
rendererCode=rendererCode.replace(/(['"])react\1/g,JSON.stringify(reactUrl)).replace(/(['"])react\/jsx-runtime\1/g,JSON.stringify(jsxUrl)).replace(/(['"])\.\.\/template-fonts\1/g,JSON.stringify(dataUrl(fontsCode))).replace(/(['"])\.\.\/lib\/poster-engine\1/g,JSON.stringify(dataUrl(compiled)))
const {RestaurantTemplateCanvas}=await import(dataUrl(rendererCode)),React=await import(reactUrl),{renderToStaticMarkup}=await import(pathToFileURL(require.resolve('react-dom/server')).href)
for(const template of ids)for(const format of ['feed','story']){
 const markup=renderToStaticMarkup(React.createElement(RestaurantTemplateCanvas,{template,format,image:'',headline:'Burger',text:'Opis',primary:'#16473f',accent:'#c08a5e'}))
 assert(markup.includes('Burger')&&markup.includes('Opis')&&markup.includes('Svrati danas'),`${template}/${format}: legacy defaults failed`)
}
console.log('Legacy React render: all 24 formats, missing new fields, slot copy, menu price and Autopilot caption preservation passed.')
