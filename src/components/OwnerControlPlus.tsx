import { useState } from 'react'
import { Activity, AlertTriangle, BadgePercent, Headphones, Mail, ShieldCheck, TrendingUp } from 'lucide-react'
import { OwnerControl } from './OwnerControl'
import { PromoCodesAdmin } from './PromoCodesAdmin'
import { EmailAdmin } from './EmailAdmin'
import { OwnerSupport } from './OwnerSupport'
import { OwnerHealth } from './OwnerHealth'
import { TrendIntelligenceOwner } from './TrendIntelligenceOwner'
import { SerpApiSetupCard } from './SerpApiSetupCard'
import { TrendReviewMetricsCard } from './TrendReviewMetricsCard'
import { OwnerLearningCard } from './OwnerLearningCard'
import { ProductionOpsCard } from './ProductionOpsCard'
import { OwnerIncidentCenter } from './OwnerIncidentCenter'

type OwnerSection='control'|'trend'|'incidents'|'promos'|'email'|'support'|'health'

function initialOwnerSection():OwnerSection{
  const requested=sessionStorage.getItem('restorapp-owner-section')
  if(requested==='trend'){
    sessionStorage.removeItem('restorapp-owner-section')
    return 'trend'
  }
  return 'control'
}

export function OwnerControlPlus({onCloseApp,setNotice}:{onCloseApp?:()=>void;setNotice:(v:string)=>void}){
  const[section,setSection]=useState<OwnerSection>(initialOwnerSection)
  const[trendVersion,setTrendVersion]=useState(0)
  return <div className="owner-plus-shell">
    <div className="owner-plus-switch">
      <button className={section==='control'?'active':''} onClick={()=>setSection('control')}><ShieldCheck size={16}/> OWNER Control</button>
      <button className={section==='trend'?'active':''} onClick={()=>setSection('trend')}><TrendingUp size={16}/> Trend Intelligence</button>
      <button className={section==='incidents'?'active':''} onClick={()=>setSection('incidents')}><AlertTriangle size={16}/> Incident Center</button>
      <button className={section==='promos'?'active':''} onClick={()=>setSection('promos')}><BadgePercent size={16}/> Promo kodovi</button>
      <button className={section==='email'?'active':''} onClick={()=>setSection('email')}><Mail size={16}/> Email Center</button>
      <button className={section==='support'?'active':''} onClick={()=>setSection('support')}><Headphones size={16}/> Support Inbox</button>
      <button className={section==='health'?'active':''} onClick={()=>setSection('health')}><Activity size={16}/> System Health</button>
    </div>
    {section==='control'?<OwnerControl onCloseApp={onCloseApp} setNotice={setNotice}/>:section==='trend'?<><SerpApiSetupCard setNotice={setNotice} onChanged={()=>setTrendVersion(v=>v+1)}/><TrendReviewMetricsCard setNotice={setNotice} version={trendVersion}/><OwnerLearningCard setNotice={setNotice} version={trendVersion}/><TrendIntelligenceOwner setNotice={setNotice} onLearningChanged={()=>setTrendVersion(v=>v+1)}/></>:section==='incidents'?<OwnerIncidentCenter setNotice={setNotice} onOpenTrend={()=>setSection('trend')}/>:section==='promos'?<PromoCodesAdmin setNotice={setNotice}/>:section==='email'?<EmailAdmin setNotice={setNotice}/>:section==='support'?<OwnerSupport setNotice={setNotice}/>
:section==='health'?<><ProductionOpsCard setNotice={setNotice}/><OwnerHealth setNotice={setNotice}/></>:<OwnerHealth setNotice={setNotice}/>}
  </div>
}
