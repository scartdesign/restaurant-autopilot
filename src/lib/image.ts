export async function optimizeImage(file:File,{maxSide=1800,quality=.88}:{maxSide?:number;quality?:number}={}){
  if(file.type==='image/svg+xml') return file
  if(!file.type.startsWith('image/')) return file
  if(file.size<450*1024) return file

  const bitmap=await createImageBitmap(file)
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height))
  const width=Math.max(1,Math.round(bitmap.width*scale))
  const height=Math.max(1,Math.round(bitmap.height*scale))
  const canvas=document.createElement('canvas')
  canvas.width=width; canvas.height=height
  const ctx=canvas.getContext('2d',{alpha:true})
  if(!ctx){bitmap.close();return file}
  ctx.drawImage(bitmap,0,0,width,height)
  bitmap.close()
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality))
  if(!blob||blob.size>=file.size)return file
  const name=(file.name.replace(/\.[^.]+$/,'')||'image')+'.webp'
  return new File([blob],name,{type:'image/webp',lastModified:Date.now()})
}
