import { useState } from 'react'
import { SimpleContentStudio } from './SimpleContentStudio'
import type { MenuItem, Post, Restaurant } from '../types'

const restaurant={id:'poster-preview',name:'Restorapp Food Studio',brand_style:'premium',primary_color:'#16473f',secondary_color:'#c08a5e',social_goal:'delivery',logo_url:null} as Restaurant
const menuItems=[{id:'burger',restaurant_id:restaurant.id,name:'Truffle Smash Burger',description:'Double beef, cheddar, caramelized onion & truffle sauce',price:1290,currency:'RSD',category:'Burger',image_url:'./demo-burger.jpg',is_active:true,marketing_priority:1}] as MenuItem[]
const posts:Post[]=[{id:'autopilot-example',content_plan_id:null,promotion_id:null,visual_brief:null,discovery_score:0,restaurant_id:restaurant.id,menu_item_id:'burger',post_type:'story',title:'Današnja preporuka: Truffle Smash Burger',caption:'Dupla pljeskavica, cheddar, karamelizovani luk i sos od tartufa. Probajte današnju preporuku i poručite svoj burger. Ovaj ceo tekst ostaje sačuvan kada se menja dizajn.',cta:'Poruči odmah',status:'draft',scheduled_for:'2026-10-06T12:00:00Z',generation_meta:{visual_design:{template:'bold',headline:'Truffle Smash Burger',subline:menuItems[0].description||'',image_url:'./demo-burger.jpg'}},hashtags:[],platform_content:{},seo_keywords:[]}]
export default function StudioPosterPreview(){
 const [notice,setNotice]=useState('')
 return <div style={{maxWidth:1500,margin:'auto',padding:20}}><div style={{padding:'12px 18px',background:'#16473f',color:'white',borderRadius:12,marginBottom:20}}>RESTORAPP · PREGLED GENERATORA <span style={{fontSize:12,opacity:.8}}> — sadržaj se ne upisuje u bazu.</span></div><SimpleContentStudio restaurant={restaurant} userId="poster-preview" menuItems={menuItems} posts={posts} onChanged={async()=>{}} onNavigate={()=>setNotice('Kalendar i zakazivanje ostaju dostupni u prijavljenoj aplikaciji.')} setNotice={setNotice} readOnlyPreview/>{notice&&<div className="app-toast">{notice}</div>}</div>
}
