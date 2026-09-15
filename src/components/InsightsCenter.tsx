import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, Download, MousePointerClick, Pencil, PieChart, RefreshCw, Save, Sparkles, Target, TrendingUp, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Post, Restaurant } from '../types'

type Platform = 'combined'|'instagram'|'facebook'
type Performance = {
  id:string
  post_id:string
  restaurant_id:string
  platform:Platform
  impressions:number
  reach:number
  likes:number
  comments:number
  saves:number
  shares:number
  clicks:number
  conversions:number
  spend:number
  revenue:number
  currency:string
  notes:string|null
  source:'manual'|'meta'|'import'
  measured_at:string
  created_at:string
  updated_at:string
}
type FormState={
  platform:Platform
  impressions:string
  reach:string
  likes:string
  comments:string
  saves:string
  shares:string
  clicks:string
  conversions:string
  spend:string
  revenue:string
  currency:string
  notes:string
  measured_at:string
}
const emptyForm:FormState={
  platform:'combined',impressions:'',reach:'',likes:'',comments:'',saves:'',shares:'',clicks:'',conversions:'',spend:'',revenue:'',currency:'RSD',notes:'',measured_at:new Date().toISOString().slice(0,10),
}

export function InsightsCenter({restaurant,posts,menuItems,setNotice}:{restaurant:Restaurant;posts:Post[];menuItems:MenuItem[];setNotice:(value:string)=>void}){
  const[rows,setRows]=useState<Performance[]>([])
  const[loading,setLoading]=useState(true)
  const[editing,setEditing]=useState<Post|null>(null)
  const[form,setForm]=useState<FormState>(emptyForm)
  const[saving,setSaving]=useState(false)

  useEffect(()=>{void load()},[restaurant.id])

  async function load(){
    setLoading(true)
    const{data,error}=await supabase.from('post_performance').select('*').eq('restaurant_id',restaurant.id).order('measured_at',{ascending:false})
    if(error)setNotice(error.message);else setRows((data||[]) as Performance[])
    setLoading(false)
  }

  const menuMap=useMemo(()=>new Map(menuItems.map(item=>[item.id,item])),[menuItems])
  const postsForTracking=useMemo(()=>posts.filter(post=>post.status==='published'||post.status==='approved').sort((a,b)=>new Date(b.scheduled_for||0).getTime()-new Date(a.scheduled_for||0).getTime()),[posts])
  const metricsByPost=useMemo(()=>{
    const grouped=new Map<string,Performance[]>()
    for(const row of rows)grouped.set(row.post_id,[...(grouped.get(row.post_id)||[]),row])
    const result=new Map<string,ReturnType<typeof mergeMetrics>>()
    for(const [postId,list] of grouped)result.set(postId,mergeMetrics(list))
    return result
  },[rows])

  const tracked=useMemo(()=>postsForTracking.filter(post=>metricsByPost.has(post.id)),[postsForTracking,metricsByPost])
  const totals=useMemo(()=>{
    let reach=0,impressions=0,likes=0,comments=0,saves=0,shares=0,clicks=0,conversions=0,spend=0,revenue=0
    for(const post of tracked){const m=metricsByPost.get(post.id)!;reach+=m.reach;impressions+=m.impressions;likes+=m.likes;comments+=m.comments;saves+=m.saves;shares+=m.shares;clicks+=m.clicks;conversions+=m.conversions;spend+=m.spend;revenue+=m.revenue}
    const interactions=likes+comments+saves+shares
    return{reach,impressions,likes,comments,saves,shares,clicks,conversions,spend,revenue,interactions,engagement:reach?interactions/reach*100:0,ctr:reach?clicks/reach*100:0,roas:spend?revenue/spend:0}
  },[tracked,metricsByPost])

  const ranking=useMemo(()=>tracked.map(post=>{
    const m=metricsByPost.get(post.id)!
    const interactions=m.likes+m.comments+m.saves+m.shares
    const engagement=m.reach?interactions/m.reach*100:0
    return{post,m,interactions,engagement,score:engagement*10+m.saves*1.4+m.shares*1.8+m.clicks*.8+m.conversions*4}
  }).sort((a,b)=>b.score-a.score),[tracked,metricsByPost])

  const pillarStats=useMemo(()=>{
    const map=new Map<string,{reach:number;interactions:number;count:number}>()
    for(const item of ranking){const pillar=String(item.post.generation_meta?.pillar||'other');const prev=map.get(pillar)||{reach:0,interactions:0,count:0};prev.reach+=item.m.reach;prev.interactions+=item.interactions;prev.count+=1;map.set(pillar,prev)}
    return [...map.entries()].map(([pillar,v])=>({pillar,...v,engagement:v.reach?v.interactions/v.reach*100:0})).sort((a,b)=>b.engagement-a.engagement)
  },[ranking])

  const dishStats=useMemo(()=>{
    const map=new Map<string,{name:string;reach:number;interactions:number;conversions:number}>()
    for(const item of ranking){const id=item.post.menu_item_id;if(!id)continue;const name=menuMap.get(id)?.name||'Jelo';const prev=map.get(id)||{name,reach:0,interactions:0,conversions:0};prev.reach+=item.m.reach;prev.interactions+=item.interactions;prev.conversions+=item.m.conversions;map.set(id,prev)}
    return [...map.values()].map(v=>({...v,engagement:v.reach?v.interactions/v.reach*100:0})).sort((a,b)=>b.engagement-a.engagement)
  },[ranking,menuMap])

  function openEditor(post:Post){
    const existing=rows.find(row=>row.post_id===post.id&&row.platform==='combined')||rows.find(row=>row.post_id===post.id)
    setEditing(post)
    setForm(existing?{
      platform:existing.platform,impressions:String(existing.impressions||''),reach:String(existing.reach||''),likes:String(existing.likes||''),comments:String(existing.comments||''),saves:String(existing.saves||''),shares:String(existing.shares||''),clicks:String(existing.clicks||''),conversions:String(existing.conversions||''),spend:String(existing.spend||''),revenue:String(existing.revenue||''),currency:existing.currency||'RSD',notes:existing.notes||'',measured_at:new Date(existing.measured_at).toISOString().slice(0,10),
    }:{...emptyForm,currency:menuItems[0]?.currency||'RSD',measured_at:new Date().toISOString().slice(0,10)})
  }

  async function save(){
    if(!editing)return
    setSaving(true)
    const payload={
      post_id:editing.id,
      restaurant_id:restaurant.id,
      platform:form.platform,
      impressions:num(form.impressions),reach:num(form.reach),likes:num(form.likes),comments:num(form.comments),saves:num(form.saves),shares:num(form.shares),clicks:num(form.clicks),conversions:num(form.conversions),
      spend:money(form.spend),revenue:money(form.revenue),currency:form.currency||'RSD',notes:form.notes.trim()||null,source:'manual',measured_at:new Date(form.measured_at+'T12:00:00').toISOString(),
    }
    const{error}=await supabase.from('post_performance').upsert(payload,{onConflict:'post_id,platform'})
    if(error)setNotice(error.message)
    else{setNotice('Rezultati objave su sačuvani. Insights je preračunat.');setEditing(null);await load()}
    setSaving(false)
  }

  function exportCsv(){
    const header=['objava','datum','status','reach','impressions','likes','comments','saves','shares','clicks','conversions','engagement_%','spend','revenue','currency']
    const lines=ranking.map(item=>[
      item.post.title||'Objava',item.post.scheduled_for||'',item.post.status,item.m.reach,item.m.impressions,item.m.likes,item.m.comments,item.m.saves,item.m.shares,item.m.clicks,item.m.conversions,item.engagement.toFixed(2),item.m.spend,item.m.revenue,item.m.currency
    ].map(csvCell).join(';'))
    const blob=new Blob(['\ufeff'+[header.join(';'),...lines].join('\n')],{type:'text/csv;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slug(restaurant.name)}-performance.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
    setNotice('Performance CSV je preuzet.')
  }

  const best=ranking[0]
  const bestPillar=pillarStats[0]
  const bestDish=dishStats[0]
  const currency=ranking.find(x=>x.m.currency)?.m.currency||menuItems[0]?.currency||'RSD'

  return <div className="insights-center">
    <header className="page-header insights-header"><div><p className="eyebrow">PERFORMANCE LOOP</p><h1>Rezultati</h1><p className="muted">Upiši stvarne rezultate objava i Autopilot dobija povratnu informaciju šta kod tvog restorana radi najbolje.</p></div><div className="insights-head-actions"><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?'Osvežavam…':'Osveži'}</button><button className="primary" onClick={exportCsv} disabled={!ranking.length}><Download size={15}/> Izvezi CSV</button></div></header>

    <section className="insights-kpis">
      <article><span><Target size={16}/> Doseg</span><strong>{fmt(totals.reach)}</strong><small>{tracked.length} praćenih objava</small></article>
      <article><span><TrendingUp size={16}/> Engagement</span><strong>{totals.engagement.toFixed(1)}%</strong><small>{fmt(totals.interactions)} interakcija</small></article>
      <article><span><MousePointerClick size={16}/> Klikovi</span><strong>{fmt(totals.clicks)}</strong><small>CTR {totals.ctr.toFixed(1)}%</small></article>
      <article><span><CheckCircle2 size={16}/> Konverzije</span><strong>{fmt(totals.conversions)}</strong><small>{totals.spend>0?`ROAS ${totals.roas.toFixed(2)}x`:'bez unetog ad spend-a'}</small></article>
    </section>

    <section className="insights-smart panel">
      <div className="insights-smart-icon"><Sparkles size={21}/></div>
      <div><p className="eyebrow">SMART INSIGHT</p>{tracked.length<3?<><h2>Treba nam još stvarnih podataka.</h2><p>Unesi rezultate za bar 3 objave. Posle toga ovde dobijaš preporuku zasnovanu na stvarnom reach-u, engagementu i konverzijama tvog restorana.</p></>:<><h2>{bestPillar?pillarLabel(bestPillar.pillar)+' trenutno daje najbolji engagement.':'Rezultati se već razlikuju po sadržaju.'}</h2><p>{bestDish?<><b>{bestDish.name}</b> ima {bestDish.engagement.toFixed(1)}% engagement na praćenim objavama. </>:null}{best?<><b>{best.post.title||'Najbolja objava'}</b> je trenutno vodeća sa {best.engagement.toFixed(1)}% engagementa.</>:null} Ovo nije procena tržišta, već zaključak samo iz rezultata koje si uneo.</p></>}</div>
    </section>

    <div className="insights-grid">
      <section className="panel insights-ranking"><div className="panel-heading"><div><p className="eyebrow">TOP SADRŽAJ</p><h2>Šta radi najbolje</h2></div><BarChart3 size={20}/></div>
        {!ranking.length?<div className="insights-empty"><PieChart size={28}/><strong>Još nema rezultata.</strong><span>Objavi sadržaj, pa unesi stvarni reach i reakcije.</span></div>:ranking.slice(0,6).map((item,index)=><div className="ranking-row" key={item.post.id}><span className="ranking-no">0{index+1}</span><div className="ranking-copy"><strong>{item.post.title||'Objava'}</strong><small>{item.post.scheduled_for?fmtDate(item.post.scheduled_for):'Bez termina'} · {pillarLabel(String(item.post.generation_meta?.pillar||'other'))}</small><div className="ranking-track"><i style={{width:`${Math.max(5,Math.min(100,item.engagement*6))}%`}}/></div></div><div className="ranking-value"><strong>{item.engagement.toFixed(1)}%</strong><small>{fmt(item.m.reach)} reach</small></div></div>)}
      </section>

      <section className="panel insights-details"><div className="panel-heading"><div><p className="eyebrow">SIGNALI</p><h2>Šta publika radi</h2></div><Target size={20}/></div>
        <div className="signal-grid"><div><span>Saves</span><strong>{fmt(totals.saves)}</strong></div><div><span>Shares</span><strong>{fmt(totals.shares)}</strong></div><div><span>Comments</span><strong>{fmt(totals.comments)}</strong></div><div><span>Revenue</span><strong>{totals.revenue?moneyFmt(totals.revenue,currency):'—'}</strong></div></div>
        <div className="insights-note"><strong>Zašto ručni unos?</strong><span>Dok Meta nalog nije direktno povezan, ovo je siguran način da proizvod već koristi stvarne rezultate. Kada postoji integracija, isti model podataka može da se puni automatski.</span></div>
      </section>
    </div>

    <section className="panel insights-posts"><div className="panel-heading"><div><p className="eyebrow">OBJAVE</p><h2>Unesi rezultate</h2></div><small>{tracked.length}/{postsForTracking.length} praćeno</small></div>
      {!postsForTracking.length?<div className="insights-empty"><Target size={27}/><strong>Prvo odobri ili objavi sadržaj.</strong><span>Rezultati se prate za odobrene i objavljene postove.</span></div>:<div className="insights-post-list">{postsForTracking.map(post=>{const m=metricsByPost.get(post.id);const image=String(post.generation_meta?.image_url||post.generation_meta?.visual_design?.image_url||'');return <article key={post.id} className="insight-post-row">{image?<img src={image} alt=""/>:<div className="insight-post-placeholder"><BarChart3 size={19}/></div>}<div className="insight-post-copy"><strong>{post.title||'Objava'}</strong><small>{post.scheduled_for?fmtDate(post.scheduled_for):'Bez termina'} · {post.status==='published'?'Objavljeno':'Odobreno'}</small></div>{m?<div className="insight-post-numbers"><span><b>{fmt(m.reach)}</b> reach</span><span><b>{m.reach?(((m.likes+m.comments+m.saves+m.shares)/m.reach)*100).toFixed(1):'0.0'}%</b> eng.</span></div>:<span className="not-tracked">bez rezultata</span>}<button className={m?'secondary':'primary'} onClick={()=>openEditor(post)}><Pencil size={14}/>{m?'Izmeni':'Unesi'}</button></article>})}</div>}
    </section>

    {editing&&<div className="modal-backdrop" onMouseDown={()=>setEditing(null)}><div className="modal-card insights-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">PERFORMANCE</p><h2>{editing.title||'Rezultati objave'}</h2></div><button className="icon-button" onClick={()=>setEditing(null)}><X size={18}/></button></div>
      <div className="insights-form-grid">
        <label>Platforma<select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value as Platform})}><option value="combined">Ukupno / kombinovano</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label>
        <label>Datum merenja<input type="date" value={form.measured_at} onChange={e=>setForm({...form,measured_at:e.target.value})}/></label>
        <label>Reach<input type="number" min="0" value={form.reach} onChange={e=>setForm({...form,reach:e.target.value})}/></label>
        <label>Impressions<input type="number" min="0" value={form.impressions} onChange={e=>setForm({...form,impressions:e.target.value})}/></label>
        <label>Likes<input type="number" min="0" value={form.likes} onChange={e=>setForm({...form,likes:e.target.value})}/></label>
        <label>Comments<input type="number" min="0" value={form.comments} onChange={e=>setForm({...form,comments:e.target.value})}/></label>
        <label>Saves<input type="number" min="0" value={form.saves} onChange={e=>setForm({...form,saves:e.target.value})}/></label>
        <label>Shares<input type="number" min="0" value={form.shares} onChange={e=>setForm({...form,shares:e.target.value})}/></label>
        <label>Klikovi<input type="number" min="0" value={form.clicks} onChange={e=>setForm({...form,clicks:e.target.value})}/></label>
        <label>Konverzije<input type="number" min="0" value={form.conversions} onChange={e=>setForm({...form,conversions:e.target.value})}/></label>
        <label>Ad spend<input type="number" min="0" step="0.01" value={form.spend} onChange={e=>setForm({...form,spend:e.target.value})}/></label>
        <label>Revenue<input type="number" min="0" step="0.01" value={form.revenue} onChange={e=>setForm({...form,revenue:e.target.value})}/></label>
        <label>Valuta<select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>RSD</option><option>EUR</option><option>BAM</option><option>MKD</option><option>USD</option></select></label>
        <label className="span-2">Napomena<textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="npr. ručak kampanja, vikend, organski post..."/></label>
      </div>
      <div className="modal-actions"><button className="secondary" onClick={()=>setEditing(null)}>Otkaži</button><button className="primary" onClick={()=>void save()} disabled={saving}><Save size={15}/>{saving?'Čuvam…':'Sačuvaj rezultate'}</button></div>
    </div></div>}
  </div>
}

function mergeMetrics(rows:Performance[]){
  const combined=rows.find(row=>row.platform==='combined')
  if(combined)return combined
  const seed={id:'',post_id:rows[0]?.post_id||'',restaurant_id:rows[0]?.restaurant_id||'',platform:'combined' as Platform,impressions:0,reach:0,likes:0,comments:0,saves:0,shares:0,clicks:0,conversions:0,spend:0,revenue:0,currency:rows[0]?.currency||'RSD',notes:null,source:'manual' as const,measured_at:rows[0]?.measured_at||new Date().toISOString(),created_at:'',updated_at:''}
  return rows.reduce((a,b)=>({...a,impressions:a.impressions+Number(b.impressions||0),reach:a.reach+Number(b.reach||0),likes:a.likes+Number(b.likes||0),comments:a.comments+Number(b.comments||0),saves:a.saves+Number(b.saves||0),shares:a.shares+Number(b.shares||0),clicks:a.clicks+Number(b.clicks||0),conversions:a.conversions+Number(b.conversions||0),spend:a.spend+Number(b.spend||0),revenue:a.revenue+Number(b.revenue||0)}),seed)
}
function num(v:string){const n=Math.floor(Number(v||0));return Number.isFinite(n)&&n>0?n:0}
function money(v:string){const n=Number(v||0);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:0}
function fmt(v:number){return new Intl.NumberFormat('sr-RS',{notation:v>=10000?'compact':'standard',maximumFractionDigits:1}).format(v)}
function fmtDate(v:string){return new Date(v).toLocaleDateString('sr-RS',{day:'2-digit',month:'short',year:'numeric'})}
function moneyFmt(v:number,currency:string){return new Intl.NumberFormat('sr-RS',{style:'currency',currency:currency==='RSD'?'RSD':currency,maximumFractionDigits:0}).format(v)}
function csvCell(v:unknown){const s=String(v??'');return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function slug(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'restaurant'}
function pillarLabel(v:string){return({hero_dish:'Hero jelo',engagement:'Engagement',local_discovery:'Local discovery',kitchen_story:'Iza scene',social_prompt:'Social prompt',promotion:'Promocija',other:'Ostalo'} as Record<string,string>)[v]||v.replace(/_/g,' ')}
