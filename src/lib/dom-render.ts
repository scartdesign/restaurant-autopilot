type RenderOptions={
  width:number
  height:number
  type?:'image/jpeg'|'image/png'
  quality?:number
}

function copyComputedStyle(source:Element,target:HTMLElement){
  const computed=getComputedStyle(source)
  for(const property of Array.from(computed)){
    const value=computed.getPropertyValue(property)
    if(value)target.style.setProperty(property,value,computed.getPropertyPriority(property))
  }
}

function copyPseudo(source:Element,target:HTMLElement,pseudo:'::before'|'::after'){
  const computed=getComputedStyle(source,pseudo)
  const content=computed.getPropertyValue('content')
  const display=computed.getPropertyValue('display')
  if(display==='none'||content==='none')return
  const node=document.createElement('span')
  node.setAttribute('data-render-pseudo',pseudo)
  for(const property of Array.from(computed)){
    const value=computed.getPropertyValue(property)
    if(value)node.style.setProperty(property,value,computed.getPropertyPriority(property))
  }
  if(content&&content!=='""'&&content!=="''"){
    node.textContent=content.replace(/^['"]|['"]$/g,'')
  }else node.textContent=''
  if(pseudo==='::before')target.prepend(node)
  else target.append(node)
}

function blobToDataUrl(blob:Blob){
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader()
    reader.onload=()=>resolve(String(reader.result||''))
    reader.onerror=()=>reject(reader.error||new Error('Image conversion failed'))
    reader.readAsDataURL(blob)
  })
}

async function urlToDataUrl(url:string){
  if(!url||url.startsWith('data:'))return url
  try{
    const response=await fetch(url,{mode:'cors',credentials:'omit'})
    if(!response.ok)throw new Error(String(response.status))
    return await blobToDataUrl(await response.blob())
  }catch{
    return url
  }
}

function urlsFromBackground(value:string){
  const out:string[]=[]
  const re=/url\((['"]?)(.*?)\1\)/g
  let match:RegExpExecArray|null
  while((match=re.exec(value)))if(match[2])out.push(match[2])
  return out
}

async function inlineElementAssets(source:Element,target:HTMLElement){
  if(source instanceof HTMLImageElement&&target instanceof HTMLImageElement){
    const src=source.currentSrc||source.src
    if(src)target.src=await urlToDataUrl(src)
  }
  const background=getComputedStyle(source).backgroundImage
  if(background&&background!=='none'){
    let next=background
    for(const url of urlsFromBackground(background)){
      const data=await urlToDataUrl(url)
      if(data!==url)next=next.split(url).join(data)
    }
    target.style.backgroundImage=next
  }
}

async function cloneForRender(source:HTMLElement){
  const clone=source.cloneNode(true) as HTMLElement
  const sourceNodes=[source,...Array.from(source.querySelectorAll('*'))]
  const cloneNodes=[clone,...Array.from(clone.querySelectorAll('*'))] as HTMLElement[]
  for(let index=0;index<sourceNodes.length;index++){
    const src=sourceNodes[index]
    const dst=cloneNodes[index]
    if(!dst)continue
    copyComputedStyle(src,dst)
    await inlineElementAssets(src,dst)
  }
  // Materialise decorative pseudo-elements after normal descendants are styled.
  for(let index=0;index<sourceNodes.length;index++){
    const src=sourceNodes[index]
    const dst=cloneNodes[index]
    if(!dst)continue
    copyPseudo(src,dst,'::before')
    copyPseudo(src,dst,'::after')
  }
  clone.setAttribute('xmlns','http://www.w3.org/1999/xhtml')
  clone.style.margin='0'
  clone.style.transform='none'
  return clone
}

function loadImage(url:string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image()
    image.onload=()=>resolve(image)
    image.onerror=()=>reject(new Error('Final image render failed'))
    image.src=url
  })
}

export async function renderElementToBlob(element:HTMLElement,{width,height,type='image/jpeg',quality=.94}:RenderOptions){
  if(document.fonts?.ready)await document.fonts.ready
  const rect=element.getBoundingClientRect()
  if(!rect.width||!rect.height)throw new Error('Preview nije spreman za izvoz.')
  const clone=await cloneForRender(element)
  clone.style.width=rect.width+'px'
  clone.style.height=rect.height+'px'
  const serialized=new XMLSerializer().serializeToString(clone)
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}"><foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`
  const svgUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}))
  try{
    const image=await loadImage(svgUrl)
    const canvas=document.createElement('canvas')
    canvas.width=width
    canvas.height=height
    const ctx=canvas.getContext('2d',{alpha:type==='image/png'})
    if(!ctx)throw new Error('Canvas nije dostupan.')
    if(type==='image/jpeg'){
      ctx.fillStyle='#ffffff'
      ctx.fillRect(0,0,width,height)
    }
    ctx.drawImage(image,0,0,width,height)
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,quality))
    if(!blob)throw new Error('Finalna slika nije generisana.')
    return blob
  }finally{
    URL.revokeObjectURL(svgUrl)
  }
}

export function downloadBlob(blob:Blob,filename:string){
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url
  link.download=filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
