type ExportOptions={
  node:HTMLElement
  width:number
  height:number
  fileName:string
}

function readAsDataUrl(blob:Blob){
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader()
    reader.onload=()=>resolve(String(reader.result||''))
    reader.onerror=()=>reject(new Error('Ne mogu da pročitam fotografiju za eksport.'))
    reader.readAsDataURL(blob)
  })
}

async function urlToDataUrl(url:string){
  if(!url||url.startsWith('data:')||url.startsWith('blob:')){
    if(url.startsWith('blob:')){
      const response=await fetch(url)
      if(!response.ok)throw new Error('Fotografija nije dostupna za eksport.')
      return readAsDataUrl(await response.blob())
    }
    return url
  }
  const response=await fetch(url,{mode:'cors',credentials:'omit'})
  if(!response.ok)throw new Error('Fotografija nije dostupna za eksport.')
  return readAsDataUrl(await response.blob())
}

function collectCss(){
  const parts:string[]=[]
  for(const sheet of Array.from(document.styleSheets)){
    try{
      for(const rule of Array.from(sheet.cssRules))parts.push(rule.cssText)
    }catch{
      // Cross-origin stylesheets (for example Google Fonts) are already loaded
      // in the page and can be skipped here.
    }
  }
  return parts.join('\n')
}

function urlsFromBackground(value:string){
  const urls:string[]=[]
  const re=/url\((['"]?)(.*?)\1\)/g
  let match:RegExpExecArray|null
  while((match=re.exec(value)))if(match[2])urls.push(match[2])
  return urls
}

async function inlineAssets(source:HTMLElement,clone:HTMLElement){
  const sourceNodes=[source,...Array.from(source.querySelectorAll<HTMLElement>('*'))]
  const cloneNodes=[clone,...Array.from(clone.querySelectorAll<HTMLElement>('*'))]

  for(let i=0;i<Math.min(sourceNodes.length,cloneNodes.length);i++){
    const original=sourceNodes[i]
    const copy=cloneNodes[i]

    if(original instanceof HTMLImageElement&&copy instanceof HTMLImageElement&&original.src){
      try{copy.src=await urlToDataUrl(original.src)}catch{/* keep original if browser blocks it */}
    }

    const background=getComputedStyle(original).backgroundImage
    if(background&&background!=='none'){
      let next=background
      for(const url of urlsFromBackground(background)){
        try{
          const data=await urlToDataUrl(url)
          next=next.split(url).join(data)
        }catch{/* keep original if browser blocks it */}
      }
      copy.style.backgroundImage=next
    }
  }
}

function downloadBlob(blob:Blob,fileName:string){
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url
  link.download=fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1200)
}

export async function exportTemplatePng({node,width,height,fileName}:ExportOptions){
  if(document.fonts?.ready)await document.fonts.ready
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))

  const rect=node.getBoundingClientRect()
  if(rect.width<2||rect.height<2)throw new Error('Preview nije spreman za preuzimanje.')

  const poster=node.querySelector<HTMLElement>('.pe-stage')
  if(poster?.dataset.fit==='false')throw new Error('Tekst je predugačak za ovaj dizajn. Skrati naziv ili opis pre izvoza.')
  const exportWidth=poster?width:rect.width,exportHeight=poster?height:rect.height
  const clone=node.cloneNode(true) as HTMLElement
  clone.setAttribute('xmlns','http://www.w3.org/1999/xhtml')
  clone.style.width=`${exportWidth}px`
  clone.style.height=`${exportHeight}px`
  clone.style.maxWidth='none'
  clone.style.maxHeight='none'
  clone.style.margin='0'
  clone.style.transform='none'

  const artboard=clone.querySelector<HTMLElement>('.pe-stage')
  if(artboard)artboard.style.transform='none'
  await inlineAssets(node,clone)
  // A foreignObject image has no access to the page's loaded webfonts.
  // Embed the fonts actually used so exported line breaks match the live artboard.
  const families=new Set(Array.from(node.querySelectorAll<HTMLElement>('.pe-t,.pe-k,.pe-d,.pe-pr,.pe-c')).flatMap(el=>getComputedStyle(el).fontFamily.split(',').map(f=>f.trim().replace(/['"]/g,''))))
  const sheets=new Set<string>()
  for(const sheet of Array.from(document.styleSheets)){
    if(sheet.href)sheets.add(sheet.href)
    try{for(const rule of Array.from(sheet.cssRules))if(rule instanceof CSSImportRule)sheets.add(rule.href)}catch{ /* cross origin sheet fetched below */ }
  }
  let fontCss=''
  for(const href of sheets){
    if(!href.includes('fonts.googleapis.com'))continue
    const response=await fetch(href);if(!response.ok)throw new Error('Fontovi nisu dostupni za PNG izvoz.')
    const text=await response.text()
    for(const block of text.match(/@font-face\s*\{[^}]*\}/g)||[]){
      const family=block.match(/font-family:\s*['"]?([^;'"}]+)/)?.[1]?.trim()
      if(!family||!families.has(family))continue
      let embedded=block
      for(const url of urlsFromBackground(block))embedded=embedded.split(url).join(await urlToDataUrl(url))
      fontCss+=embedded+'\n'
    }
  }

  const css=(collectCss()+'\n'+fontCss).replace(/<\/style/gi,'<\\/style')
  const markup=new XMLSerializer().serializeToString(clone)
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${markup}</div></foreignObject></svg>`
  const svgBlob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'})
  const svgUrl=URL.createObjectURL(svgBlob)

  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image()
      img.onload=()=>resolve(img)
      img.onerror=()=>reject(new Error('Ne mogu da renderujem finalni dizajn.'))
      img.src=svgUrl
    })

    const canvas=document.createElement('canvas')
    canvas.width=width
    canvas.height=height
    const ctx=canvas.getContext('2d')
    if(!ctx)throw new Error('Canvas nije dostupan u browseru.')
    ctx.imageSmoothingEnabled=true
    ctx.imageSmoothingQuality='high'
    ctx.drawImage(image,0,0,width,height)

    const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG nije generisan.')),'image/png',1))
    downloadBlob(png,fileName)
  }finally{
    URL.revokeObjectURL(svgUrl)
  }
}
