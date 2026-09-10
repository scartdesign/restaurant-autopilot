import { useState } from 'react'
import { BadgePercent, Mail, ShieldCheck } from 'lucide-react'
import { OwnerControl } from './OwnerControl'
import { PromoCodesAdmin } from './PromoCodesAdmin'
import { EmailAdmin } from './EmailAdmin'

export function OwnerControlPlus({onCloseApp,setNotice}:{onCloseApp?:()=>void;setNotice:(v:string)=>void}){
  const[section,setSection]=useState<'control'|'promos'|'email'>('control')
  return <div className="owner-plus-shell">
    <div className="owner-plus-switch"><button className={section==='control'?'active':''} onClick={()=>setSection('control')}><ShieldCheck size={16}/> OWNER Control</button><button className={section==='promos'?'active':''} onClick={()=>setSection('promos')}><BadgePercent size={16}/> Promo kodovi</button><button className={section==='email'?'active':''} onClick={()=>setSection('email')}><Mail size={16}/> Email Center</button></div>
    {section==='control'?<OwnerControl onCloseApp={onCloseApp} setNotice={setNotice}/>:section==='promos'?<PromoCodesAdmin setNotice={setNotice}/>:<EmailAdmin setNotice={setNotice}/>} 
  </div>
}
