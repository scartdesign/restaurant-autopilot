import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export function NetworkStatus(){
  const[online,setOnline]=useState(()=>navigator.onLine)
  useEffect(()=>{
    const on=()=>setOnline(true),off=()=>setOnline(false)
    window.addEventListener('online',on);window.addEventListener('offline',off)
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}
  },[])
  if(online)return null
  return <div className="offline-banner"><WifiOff size={15}/><strong>Nema internet veze.</strong><span>Sačuvane stranice ostaju otvorene, ali generisanje i čuvanje čekaju povratak mreže.</span></div>
}
