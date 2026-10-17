import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import RestaurantIntelligence from './RestaurantIntelligence'
import type { RestaurantLead } from './RestaurantIntelligence'

type LeadRow = { id:string; name:string; city:string; website:string; email:string; stage:RestaurantLead['stage']; findings:RestaurantLead['findings']; next_action:string }
const toLead = (r:LeadRow):RestaurantLead => ({
  id:r.id,name:r.name,city:r.city,website:r.website,email:r.email,stage:r.stage,
  findings:Array.isArray(r.findings)?r.findings:[],nextAction:r.next_action
})

export default function RestaurantIntelligenceCloud() {
  const [leads,setLeads] = useState<RestaurantLead[] | null>(null)
  const [error,setError] = useState('')
  const [revision,setRevision] = useState(0)
  useEffect(()=>{
    let active=true
    void (async ()=>{
      // RLS enforces ownership independently of the client-side superadmin navigation.
      const { data: permitted, error: permissionError } = await supabase.rpc('is_superadmin')
      if (!active) return
      if (permissionError || permitted !== true) { setError('Samo vlasnik sistema može pristupiti prodajnom CRM-u.');return }
      const {data,error:loadError}=await supabase.from('restaurant_intelligence_leads')
        .select('id,name,city,website,email,stage,findings,next_action').order('created_at',{ascending:false}).limit(1000)
      if (!active) return
      if (loadError) {setError('Centralna baza nije dostupna: '+loadError.message);return}
      setLeads(((data||[]) as LeadRow[]).map(toLead))
    })()
    return ()=>{active=false}
  },[revision])

  async function persist(next:RestaurantLead[]) {
    if (!leads) throw Error('Podaci nisu učitani')
    const prevIds=new Set(leads.map(l=>l.id))
    const nextIds=new Set(next.map(l=>l.id))
    const changed=next.filter(l=>!prevIds.has(l.id)||JSON.stringify(leads.find(old=>old.id===l.id))!==JSON.stringify(l))
    for(const lead of changed){
      const payload={id:lead.id,name:lead.name,city:lead.city,website:lead.website,
        email:lead.email,stage:lead.stage,findings:lead.findings,next_action:lead.nextAction}
      const {error}=await supabase.from('restaurant_intelligence_leads').upsert(payload,{onConflict:'id'})
      if(error){setRevision(x=>x+1);throw Error(error.message)}
    }
    for(const prior of leads.filter(l=>!nextIds.has(l.id))){
      const {error}=await supabase.from('restaurant_intelligence_leads').delete().eq('id',prior.id)
      if(error){setRevision(x=>x+1);throw Error(error.message)}
    }
    setLeads(next)
  }

  if(error) return <section style={{padding:32}} role="alert"><h2>Restaurant Intelligence</h2><p>{error}</p><button onClick={()=>{setError('');setLeads(null);setRevision(x=>x+1)}}>Pokušaj ponovo</button></section>
  if(!leads) return <p style={{padding:32}}>Učitavam interni CRM…</p>
  return <RestaurantIntelligence key={revision} initialLeads={leads} onChange={persist}/>
}
