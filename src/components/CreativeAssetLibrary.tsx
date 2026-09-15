import { Download, Image as ImageIcon, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Restaurant } from '../types'

type Asset={id:string;menu_item_id:string|null;public_url:string;style:string;provider:string;model:string;created_at:string}

export function CreativeAssetLibrary({restaurant,menuItems,onChanged,setNotice}:{restaurant:Restaurant;menuItems:MenuItem[];onChanged:()=>Promise<void>;setNotice:(v:string)=>void}){
  const[assets,setAssets]=useState<Asset[]>([])
  const[loading,setLoading]=useState(false)
  const[working,setWorking]=useState('')
  const itemMap=useMemo(()=>new Map(menuItems.map(i=>[i.id,i])),[menuItems])

  useEffect(()=>{void load()},[restaurant.id])
  async function load(){setLoading(true);const{data,error}=await supabase.from('creative_assets').select('id,menu_item_id,public_url,style,provider,model,created_at').eq('restaurant_id',restaurant.id).order('created_at',{ascending:false}).limit(30);if(error)setNotice(error.message);else setAssets((data||[]) as Asset[]);setLoading(false)}
  async function select(asset:Asset){if(!asset.menu_item_id){setNotice('Ovaj asset nije vezan za jelo.');return}setWorking(asset.id);const{data,error}=await supabase.functions.invoke('creative-image',{body:{action:'select_variant',restaurantId:restaurant.id,menuItemId:asset.menu_item_id,assetId:asset.id}});if(error)setNotice(error.message);else if(data?.error)setNotice(data.error);else{setNotice('AI fotografija je postavljena kao glavna slika jela.');await onChanged()}setWorking('')}
  async function download(asset:Asset){try{const res=await fetch(asset.public_url);if(!res.ok)throw new Error();const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`restaurant-autopilot-ai-${asset.id.slice(0,8)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}catch{window.open(asset.public_url,'_blank','noopener,noreferrer')}}

  return <section className="creative-assets-section creative-section">
    <div className="creative-section-head"><div><p className="eyebrow">AI MEDIA LIBRARY</p><h2>Tvoje generisane fotografije</h2><p>Varijante se ne gube. Vrati bilo koju sliku na jelo ili je preuzmi za drugu upotrebu.</p></div><button type="button" className="creative-secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?'Učitavam…':'Osveži'}</button></div>
    {assets.length?<div className="creative-assets-grid">{assets.map(asset=>{const item=asset.menu_item_id?itemMap.get(asset.menu_item_id):null;const active=Boolean(item?.image_url===asset.public_url);return <article className={`creative-asset-card ${active?'active':''}`} key={asset.id}><div className="creative-asset-image"><img src={asset.public_url} alt={item?.name||'AI food photo'}/>{active&&<span><Sparkles size={12}/> GLAVNA</span>}</div><div className="creative-asset-copy"><strong>{item?.name||'AI food vizual'}</strong><small>{asset.style||'photoreal'} · {new Date(asset.created_at).toLocaleDateString('sr-RS')}</small><div><button type="button" onClick={()=>void select(asset)} disabled={working===asset.id||!asset.menu_item_id||active}>{working===asset.id?'Postavljam…':active?'Aktivna slika':'Koristi na jelu'}</button><button type="button" onClick={()=>void download(asset)} title="Preuzmi"><Download size={14}/></button></div></div></article>})}</div>:<div className="creative-assets-empty"><ImageIcon size={25}/><div><strong>Još nema AI fotografija</strong><span>U Meniju izaberi „AI slika“ ili „3 varijante“ i ovde će se čuvati biblioteka.</span></div></div>}
  </section>
}
