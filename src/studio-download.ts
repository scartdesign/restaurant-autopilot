import { exportTemplatePng } from './lib/export-template-png'
import './studio-download.css'

const BUTTON_CLASS='dts-download-png'

function slug(value:string){
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'').slice(0,54)||'restorapp-objava'
}

function attachDownloadButtons(){
  document.querySelectorAll<HTMLElement>('.dts-preview-shell').forEach(shell=>{
    const preview=shell.querySelector<HTMLElement>('.restaurant-template-canvas.dts-live-preview')
    const topbar=shell.querySelector<HTMLElement>('.dts-preview-topbar')
    if(!preview||!topbar||topbar.querySelector(`.${BUTTON_CLASS}`))return

    const button=document.createElement('button')
    button.type='button'
    button.className=BUTTON_CLASS
    button.innerHTML='<span aria-hidden="true">↓</span><b>Preuzmi PNG</b>'
    button.title='Preuzmi finalni dizajn u punoj rezoluciji'

    button.addEventListener('click',async()=>{
      if(button.dataset.busy==='1')return
      const story=preview.classList.contains('story')
      const title=preview.querySelector<HTMLElement>('.rtpl-accessible-headline')?.textContent||'restorapp-objava'
      button.dataset.busy='1'
      button.classList.add('working')
      button.innerHTML='<span class="dts-download-spinner" aria-hidden="true"></span><b>Renderujem…</b>'
      try{
        await exportTemplatePng({
          node:preview,
          width:1080,
          height:story?1920:1080,
          fileName:`${slug(title)}-${story?'story-1080x1920':'post-1080x1080'}.png`,
        })
        button.classList.add('done')
        button.innerHTML='<span aria-hidden="true">✓</span><b>Preuzeto</b>'
        window.setTimeout(()=>{
          button.classList.remove('done')
          button.innerHTML='<span aria-hidden="true">↓</span><b>Preuzmi PNG</b>'
        },1600)
      }catch(error){
        console.error('Restorapp PNG export failed',error)
        button.classList.add('error')
        button.innerHTML='<span aria-hidden="true">!</span><b>Pokušaj ponovo</b>'
        button.title=error instanceof Error?error.message:'PNG nije generisan.'
        window.setTimeout(()=>button.classList.remove('error'),2200)
      }finally{
        delete button.dataset.busy
        button.classList.remove('working')
      }
    })

    topbar.appendChild(button)
  })
}

let scheduled=false
function scheduleAttach(){
  if(scheduled)return
  scheduled=true
  requestAnimationFrame(()=>{
    scheduled=false
    attachDownloadButtons()
  })
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleAttach,{once:true})
else scheduleAttach()

new MutationObserver(scheduleAttach).observe(document.documentElement,{childList:true,subtree:true})
