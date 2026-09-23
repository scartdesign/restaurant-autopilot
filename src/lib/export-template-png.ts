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

  const clone=node.cloneNode(true) as HTMLElement
  clone.setAttribute('xmlns','http://www.w3.org/1999/xhtml')
  clone.style.width=`${rect.width}px`
  clone.style.height=`${rect.height}px`
  clone.style.maxWidth='none'
  clone.style.maxHeight='none'
  clone.style.margin='0'
  clone.style.transform='none'

  await inlineAssets(node,clone)

  const css=collectCss().replace(/<\/style/gi,'<\\/style')
  const markup=new XMLSerializer().serializeToString(clone)
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${markup}</div></foreignObject></svg>`
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
