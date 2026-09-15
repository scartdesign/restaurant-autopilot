import { Download, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{outcome:'accepted'|'dismissed';platform:string}>
}

export function InstallAppCard(){
  const[promptEvent,setPromptEvent]=useState<InstallPromptEvent|null>(null)
  const[installed,setInstalled]=useState(()=>window.matchMedia?.('(display-mode: standalone)').matches||false)

  useEffect(()=>{
    const before=(event:Event)=>{event.preventDefault();setPromptEvent(event as InstallPromptEvent)}
    const done=()=>{setInstalled(true);setPromptEvent(null)}
    window.addEventListener('beforeinstallprompt',before)
    window.addEventListener('appinstalled',done)
    return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done)}
  },[])

  async function install(){
    if(!promptEvent)return
    await promptEvent.prompt()
    const choice=await promptEvent.userChoice
    if(choice.outcome==='accepted')setPromptEvent(null)
  }

  if(installed)return <section className="settings-section panel install-app-card installed"><div className="settings-section-head"><div className="settings-icon"><Smartphone size={19}/></div><div><h2>Restaurant Autopilot je instaliran</h2><p>Pokreće se kao aplikacija sa početnog ekrana ovog uređaja.</p></div></div></section>

  return <section className="settings-section panel install-app-card"><div className="settings-section-head"><div className="settings-icon"><Smartphone size={19}/></div><div><h2>Instaliraj na telefon / računar</h2><p>Dodaj Restaurant Autopilot kao aplikaciju za brži pristup i rad preko celog ekrana.</p></div></div><div className="install-app-body"><span>{promptEvent?'Ovaj browser podržava instalaciju jednim klikom.':'Ako dugme nije dostupno, u meniju browsera izaberi „Install app“ / „Add to Home Screen“.'}</span>{promptEvent&&<button type="button" className="primary" onClick={()=>void install()}><Download size={15}/> Instaliraj aplikaciju</button>}</div></section>
}
