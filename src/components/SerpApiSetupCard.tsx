import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../serpapi-setup.css'

type ProviderStatus={
  configured:boolean
  provider:string
  last_sync_at:string|null
  verified_terms:number
}

const emptyStatus:ProviderStatus={configured:false,provider:'serpapi_google_trends',last_sync_at:null,verified_terms:0}

export function SerpApiSetupCard({setNotice,onChanged}:{setNotice:(value:string)=>void;onChanged?:()=>void}){
  const[status,setStatus]=useState<ProviderStatus>(emptyStatus)
  const[key,setKey]=useState('')
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)

  useEffect(()=>{void loadStatus()},[])

  async function loadStatus(){
    setLoading(true)
    const{data,error}=await supabase.rpc('admin_discovery_provider_status')
    if(error)setNotice(error.message)
    else if(data)setStatus(data as ProviderStatus)
    setLoading(false)
  }

  async function save(event:FormEvent){
    event.preventDefault()
    const value=key.trim()
    if(value.length<20){setNotice('Unesi validan SerpApi API ključ.');return}
    setSaving(true)
    const{error}=await supabase.rpc('admin_set_discovery_provider_key',{p_key:value})
    if(error)setNotice(error.message)
    else{
      setKey('')
      setNotice(status.configured?'SerpApi ključ je bezbedno rotiran u Supabase Vault-u.':'SerpApi ključ je bezbedno sačuvan u Supabase Vault-u.')
      await loadStatus()
      onChanged?.()
    }
    setSaving(false)
  }

  return <section className={'serpapi-setup '+(status.configured?'configured':'missing')}>
    <div className="serpapi-setup-icon">{status.configured?<CheckCircle2 size={21}/>:<KeyRound size={21}/>}</div>
    <div className="serpapi-setup-copy">
      <span>EXTERNAL TREND PROVIDER</span>
      <strong>{status.configured?'SerpApi ključ je podešen':'Poveži SerpApi za Google Trends'}</strong>
      <p>{status.configured?'Ključ je šifrovan u Supabase Vault-u i nikada se ne vraća u browser. Novi Google Trends kandidati mogu da ulaze kroz planirani Discovery Sync.':'Bez ključa rade curated bank i lokalni performance learning, ali ne stižu novi Google Trends RELATED_QUERIES kandidati.'}</p>
      <small><ShieldCheck size={11}/> {status.last_sync_at?`Poslednja verifikacija: ${new Date(status.last_sync_at).toLocaleString('sr-RS')} · ${status.verified_terms} termina`:'Još nema spoljne verifikacije trendova.'}</small>
    </div>
    <form className="serpapi-setup-form" onSubmit={save}>
      <label>{status.configured?'Novi ključ za rotaciju':'SerpApi API ključ'}<input type="password" autoComplete="new-password" value={key} onChange={e=>setKey(e.target.value)} placeholder={status.configured?'Unesi samo ako menjaš ključ':'Unesi SerpApi API key'} /></label>
      <div><button type="submit" className="primary" disabled={saving||key.trim().length<20}><KeyRound size={14}/>{saving?'Čuvam…':status.configured?'Rotiraj ključ':'Sačuvaj ključ'}</button><button type="button" className="secondary" onClick={()=>void loadStatus()} disabled={loading}><RefreshCw size={13} className={loading?'spin':''}/> Status</button></div>
      <small>Ključ se ne prikazuje nakon čuvanja. Provider ga čita server-side iz Vault-a.</small>
    </form>
  </section>
}
