import { exportTemplatePng } from './lib/export-template-png'
import './studio-download.css'

const BUTTON_CLASS='dts-download-png'
const FONT_SCALE_CLASS='dts-font-scale-control'
const FONT_SCALE_KEY='restorapp-font-scale'

function slug(value:string){
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'').slice(0,54)||'restorapp-objava'
}

function storedFontScale(){
  const raw=Number(window.localStorage.getItem(FONT_SCALE_KEY)||100)
  return Number.isFinite(raw)?Math.min(115,Math.max(85,Math.round(raw))):100
}

function applyFontScale(value:number){
  const safe=Math.min(115,Math.max(85,Math.round(value)))
  window.localStorage.setItem(FONT_SCALE_KEY,String(safe))
  const scale=String(safe/100)
  document.querySelectorAll<HTMLElement>('.demo-shell .restaurant-template-canvas').forEach(canvas=>{
    canvas.style.setProperty('--rt-user-font-scale',scale)
  })
  document.querySelectorAll<HTMLElement>(`.demo-shell .${FONT_SCALE_CLASS}`).forEach(control=>{
    const range=control.querySelector<HTMLInputElement>('input[type="range"]')
    const valueLabel=control.querySelector<HTMLElement>('[data-font-scale-value]')
    if(range&&range.value!==String(safe))range.value=String(safe)
    if(valueLabel)valueLabel.textContent=`${safe}%`
  })
}

function attachFontScaleControls(){
  const current=storedFontScale()
  document.querySelectorAll<HTMLElement>('.demo-shell .dts-font-editor').forEach(editor=>{
    if(editor.querySelector(`.${FONT_SCALE_CLASS}`))return

    const control=document.createElement('div')
    control.className=FONT_SCALE_CLASS
    control.innerHTML=`
      <div class="dts-font-scale-copy">
        <strong>Veličina teksta</strong>
        <small>Brzo povećaj ili smanji tekst na svim šablonima.</small>
      </div>
      <div class="dts-font-scale-tools">
        <button type="button" data-font-scale-step="-5" aria-label="Smanji tekst">−</button>
        <input type="range" min="85" max="115" step="1" value="${current}" aria-label="Veličina teksta" />
        <button type="button" data-font-scale-step="5" aria-label="Povećaj tekst">+</button>
        <b data-font-scale-value>${current}%</b>
      </div>`

    const range=control.querySelector<HTMLInputElement>('input[type="range"]')
    range?.addEventListener('input',()=>applyFontScale(Number(range.value)))
    control.querySelectorAll<HTMLButtonElement>('[data-font-scale-step]').forEach(button=>{
      button.addEventListener('click',()=>{
        const next=storedFontScale()+Number(button.dataset.fontScaleStep||0)
        applyFontScale(next)
      })
    })

    const title=editor.querySelector('.dts-font-title')
    if(title?.nextSibling)editor.insertBefore(control,title.nextSibling)
    else editor.appendChild(control)
  })
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
    attachFontScaleControls()
    applyFontScale(storedFontScale())
  })
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleAttach,{once:true})
else scheduleAttach()

new MutationObserver(scheduleAttach).observe(document.documentElement,{childList:true,subtree:true})
