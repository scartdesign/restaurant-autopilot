import { Download, FileJson, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function AccountDataTools({setNotice}:{setNotice:(v:string)=>void}){
  const[working,setWorking]=useState(false)
  const[deleteWorking,setDeleteWorking]=useState(false)

  async function exportData(){
    setWorking(true);setNotice('Pripremam izvoz podataka naloga…')
    const userRes=await supabase.auth.getUser()
    if(!userRes.data.user){setNotice('Sesija je istekla.');setWorking(false);return}
    const uid=userRes.data.user.id
    const [profile,restaurants,menu,posts,promotions,subs,orders,assets,support,notifications]=await Promise.all([
      supabase.from('customer_profiles').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('restaurants').select('*').eq('owner_id',uid),
      supabase.from('menu_items').select('*'),
      supabase.from('posts').select('*'),
      supabase.from('promotions').select('*'),
      supabase.from('customer_subscriptions').select('*, sales_plans(name,code,billing_interval)').eq('user_id',uid),
      supabase.from('sales_orders').select('*, sales_plans(name,code,billing_interval)').eq('user_id',uid),
      supabase.from('creative_assets').select('id,restaurant_id,menu_item_id,kind,style,public_url,provider,model,created_at').eq('user_id',uid),
      supabase.from('support_tickets').select('*').eq('user_id',uid),
      supabase.from('notification_outbox').select('*').eq('user_id',uid),
    ])
    const error=[profile,restaurants,menu,posts,promotions,subs,orders,assets,support,notifications].find(x=>x.error)?.error
    if(error){setNotice(error.message);setWorking(false);return}
    const payload={exported_at:new Date().toISOString(),account:{id:uid,email:userRes.data.user.email},profile:profile.data,restaurants:restaurants.data||[],menu_items:menu.data||[],posts:posts.data||[],promotions:promotions.data||[],subscriptions:subs.data||[],orders:orders.data||[],creative_assets:assets.data||[],support_tickets:support.data||[],notifications:notifications.data||[]}
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'})
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`restaurant-autopilot-data-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    setNotice('Izvoz podataka je spreman.')
    setWorking(false)
  }

  async function requestDeletion(){
    if(!confirm('Pošalji OWNER-u zahtev za gašenje naloga i brisanje podataka koji nisu obavezni za zakonsko čuvanje?'))return
    setDeleteWorking(true)
    const userRes=await supabase.auth.getUser()
    if(!userRes.data.user){setNotice('Sesija je istekla.');setDeleteWorking(false);return}
    const{data:restaurant}=await supabase.from('restaurants').select('id').eq('owner_id',userRes.data.user.id).limit(1).maybeSingle()
    const{error}=await supabase.from('support_tickets').insert({user_id:userRes.data.user.id,restaurant_id:restaurant?.id||null,subject:'Zahtev za gašenje naloga / brisanje podataka',category:'account',priority:'high',message:'Molim OWNER podršku da pregleda zahtev za gašenje Restaurant Autopilot naloga i brisanje podataka koji nisu obavezni za zakonsko ili računovodstveno čuvanje. Kontaktirajte me pre konačnog izvršenja.'})
    if(error)setNotice(error.message);else setNotice('Zahtev je poslat OWNER podršci. Nalog nije automatski obrisan.')
    setDeleteWorking(false)
  }

  return <section className="settings-section panel account-data-tools"><div className="settings-section-head"><div className="settings-icon"><ShieldCheck size={19}/></div><div><h2>Tvoji podaci</h2><p>Izvezi podatke naloga ili pošalji kontrolisan zahtev za gašenje naloga.</p></div></div><div className="account-data-grid"><article><FileJson size={23}/><div><strong>Izvoz podataka</strong><span>Restorani, meni, sadržaj, narudžbine, AI asseti, podrška i obaveštenja u jednom JSON fajlu.</span></div><button type="button" className="secondary" onClick={()=>void exportData()} disabled={working}><Download size={15}/>{working?'Pripremam…':'Preuzmi moje podatke'}</button></article><article className="account-delete-card"><Trash2 size={23}/><div><strong>Gašenje naloga</strong><span>Šalje zahtev OWNER-u. Finansijski dokumenti se ne brišu automatski ako postoji obaveza čuvanja.</span></div><button type="button" className="danger-soft" onClick={()=>void requestDeletion()} disabled={deleteWorking}><Trash2 size={15}/>{deleteWorking?'Šaljem…':'Zatraži gašenje'}</button></article></div></section>
}
