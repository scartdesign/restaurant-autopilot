import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, CheckCircle2, Download, FileDown, MousePointerClick, Pencil, PieChart, RefreshCw, Save, Sparkles, Target, TrendingUp, Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Post, Restaurant } from '../types'

type Platform = 'combined'|'instagram'|'facebook'
type Performance = {
  id:string
  post_id:string
  restaurant_id:string
  platform:Platform
  views:number
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
  views:string
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
  platform:'combined',views:'',impressions:'',reach:'',likes:'',comments:'',saves:'',shares:'',clicks:'',conversions:'',spend:'',revenue:'',currency:'RSD',notes:'',measured_at:new Date().toISOString().slice(0,10),
}

export function InsightsCenter({restaurant,posts,menuItems,setNotice,onChanged,onNavigate}:{restaurant:Restaurant;posts:Post[];menuItems:MenuItem[];setNotice:(value:string)=>void;onChanged:()=>Promise<void>;onNavigate?:(tab:'menu'|'publish'|'dashboard')=>void}){
  const[rows,setRows]=useState<Performance[]>([])
  const[loading,setLoading]=useState(true)
  const[editing,setEditing]=useState<Post|null>(null)
  const[form,setForm]=useState<FormState>(emptyForm)
  const[saving,setSaving]=useState(false)
  const[importing,setImporting]=useState(false)
  const[metaSyncing,setMetaSyncing]=useState(false)
  const[period,setPeriod]=useState<'30'|'90'|'all'>('90')
  const[testingItemId,setTestingItemId]=useState('')
  const importRef=useRef<HTMLInputElement|null>(null)

  useEffect(()=>{void load()},[restaurant.id])
  useEffect(()=>{
    if(loading)return
    const postId=sessionStorage.getItem('autopilot-performance-post')
    if(!postId)return
    const post=posts.find(item=>item.id===postId&&(item.status==='published'||item.status==='approved'))
    if(!post)return
    sessionStorage.removeItem('autopilot-performance-post')
    openEditor(post)
  },[loading,restaurant.id,posts])

  async function createOpportunityTest(item:MenuItem,kind:'gap'|'test'|'photo'){
    if(kind==='photo'){onNavigate?.('menu');setNotice('Prvo dodaj ili generiši fotografiju za ovo jelo, pa zatim pokreni test.');return}
    setTestingItemId(item.id)
    const{data,error}=await supabase.functions.invoke('content-engine',{body:{action:'test_item',restaurantId:restaurant.id,menuItemId:item.id,reason:kind}})
    if(error||data?.error){
      setNotice(data?.error||error?.message||'Opportunity test nije napravljen.')
      setTestingItemId('')
      return
    }
    await onChanged()
    const when=data?.scheduled_for?new Intl.DateTimeFormat('sr-RS',{dateStyle:'medium',timeStyle:'short',timeZone:restaurant.timezone}).format(new Date(data.scheduled_for)):'bez termina'
    setNotice(`Test draft za „${item.name}“ je spreman · ${when}. Proveri ga u Sadržaju ili Publish Centeru.`)
    setTestingItemId('')
  }

  async function load(){
    setLoading(true)
    const{data,error}=await supabase.from('post_performance').select('*').eq('restaurant_id',restaurant.id).order('measured_at',{ascending:false})
    if(error)setNotice(error.message);else setRows((data||[]) as Performance[])
    setLoading(false)
  }

  async function syncMetaInsights(){
    setMetaSyncing(true)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'sync_insights',restaurantId:restaurant.id}})
    if(error||data?.error)setNotice(data?.error||error?.message||'Meta Insights sync nije uspeo.')
    else{
      const synced=Number(data?.synced||0)
      const failed=Number(data?.failed||0)
      const processed=Number(data?.processed||0)
      const suffix=failed?' · '+failed+' nije uspelo':''
      setNotice(processed?'Meta Insights: osveženo '+synced+'/'+processed+suffix+'.':'Nema Meta objava za sinhronizaciju u poslednjih 90 dana.')
      await load()
    }
    setMetaSyncing(false)
  }

  const menuMap=useMemo(()=>new Map(menuItems.map(item=>[item.id,item])),[menuItems])
  const analysisRows=useMemo(()=>{
    if(period==='all')return rows
    const cutoff=Date.now()-Number(period)*86400000
    return rows.filter(row=>new Date(row.measured_at).getTime()>=cutoff)
  },[rows,period])
  const postsForTracking=useMemo(()=>posts.filter(post=>post.status==='published'||post.status==='approved').sort((a,b)=>new Date(b.scheduled_for||0).getTime()-new Date(a.scheduled_for||0).getTime()),[posts])
  const metricsByPost=useMemo(()=>{
    const grouped=new Map<string,Performance[]>()
    for(const row of analysisRows)grouped.set(row.post_id,[...(grouped.get(row.post_id)||[]),row])
    const result=new Map<string,ReturnType<typeof mergeMetrics>>()
    for(const [postId,list] of grouped)result.set(postId,mergeMetrics(list))
    return result
  },[analysisRows])

  const tracked=useMemo(()=>postsForTracking.filter(post=>metricsByPost.has(post.id)),[postsForTracking,metricsByPost])
  const totals=useMemo(()=>{
    let views=0,reach=0,impressions=0,likes=0,comments=0,saves=0,shares=0,clicks=0,conversions=0,spend=0,revenue=0
    for(const post of tracked){const m=metricsByPost.get(post.id)!;views+=m.views;reach+=m.reach;impressions+=m.impressions;likes+=m.likes;comments+=m.comments;saves+=m.saves;shares+=m.shares;clicks+=m.clicks;conversions+=m.conversions;spend+=m.spend;revenue+=m.revenue}
    const interactions=likes+comments+saves+shares
    return{views,reach,impressions,likes,comments,saves,shares,clicks,conversions,spend,revenue,interactions,engagement:reach?interactions/reach*100:0,ctr:reach?clicks/reach*100:0,roas:spend?revenue/spend:0}
  },[tracked,metricsByPost])

  const ranking=useMemo(()=>tracked.map(post=>{
    const m=metricsByPost.get(post.id)!
    const interactions=m.likes+m.comments+m.saves+m.shares
    const engagement=m.reach?interactions/m.reach*100:0
    return{post,m,interactions,engagement,score:engagement*10+m.saves*1.4+m.shares*1.8+m.clicks*.8+m.conversions*4}
  }).sort((a,b)=>b.score-a.score),[tracked,metricsByPost])

  const generationStats=useMemo(()=>{
    const groups={
      auto:{label:'AUTO WEEK',count:0,reach:0,interactions:0,conversions:0,clicks:0},
      manual:{label:'MANUAL',count:0,reach:0,interactions:0,conversions:0,clicks:0},
    }
    for(const item of ranking){
      const source=String(item.post.generation_meta?.generation_source||'')
      const key=source.startsWith('weekly_autopilot')?'auto':source==='manual_week'?'manual':null
      if(!key)continue
      const group=groups[key]
      group.count+=1;group.reach+=item.m.reach;group.interactions+=item.interactions;group.conversions+=item.m.conversions;group.clicks+=item.m.clicks
    }
    return Object.entries(groups).map(([key,value])=>({
      key:key as 'auto'|'manual',...value,
      engagement:value.reach?value.interactions/value.reach*100:0,
      ctr:value.reach?value.clicks/value.reach*100:0,
    }))
  },[ranking])

  const trendPerformance=useMemo(()=>{
    const groups={
      trend:{count:0,reach:0,interactions:0,clicks:0,conversions:0,revenue:0},
      baseline:{count:0,reach:0,interactions:0,clicks:0,conversions:0,revenue:0},
    }
    for(const item of ranking){
      const source=String(item.post.generation_meta?.generation_source||'')
      const isTrend=source==='trend_opportunity'||Boolean(item.post.generation_meta?.trend_opportunity_id)
      const group=isTrend?groups.trend:groups.baseline
      group.count+=1
      group.reach+=item.m.reach
      group.interactions+=item.interactions
      group.clicks+=item.m.clicks
      group.conversions+=item.m.conversions
      group.revenue+=item.m.revenue
    }
    const decorate=(group:typeof groups.trend)=>({...group,engagement:group.reach?group.interactions/group.reach*100:0,ctr:group.reach?group.clicks/group.reach*100:0})
    const trend=decorate(groups.trend),baseline=decorate(groups.baseline)
    const engagementDiff=trend.count&&baseline.count?trend.engagement-baseline.engagement:null
    const reachPerPostTrend=trend.count?trend.reach/trend.count:0
    const reachPerPostBaseline=baseline.count?baseline.reach/baseline.count:0
    const reachDiff=trend.count&&baseline.count?reachPerPostTrend-reachPerPostBaseline:null
    return{trend,baseline,engagementDiff,reachPerPostTrend,reachPerPostBaseline,reachDiff}
  },[ranking])

  const pillarStats=useMemo(()=>{
    const map=new Map<string,{reach:number;interactions:number;count:number}>()
    for(const item of ranking){const pillar=String(item.post.generation_meta?.pillar||'other');const prev=map.get(pillar)||{reach:0,interactions:0,count:0};prev.reach+=item.m.reach;prev.interactions+=item.interactions;prev.count+=1;map.set(pillar,prev)}
    return [...map.entries()].map(([pillar,v])=>({pillar,...v,engagement:v.reach?v.interactions/v.reach*100:0})).sort((a,b)=>b.engagement-a.engagement)
  },[ranking])

  const dishStats=useMemo(()=>{
    const map=new Map<string,{id:string;name:string;reach:number;interactions:number;conversions:number;samples:number}>()
    for(const item of ranking){const id=item.post.menu_item_id;if(!id)continue;const name=menuMap.get(id)?.name||'Jelo';const prev=map.get(id)||{id,name,reach:0,interactions:0,conversions:0,samples:0};prev.reach+=item.m.reach;prev.interactions+=item.interactions;prev.conversions+=item.m.conversions;prev.samples+=1;map.set(id,prev)}
    return [...map.values()].map(v=>({...v,engagement:v.reach?v.interactions/v.reach*100:0})).sort((a,b)=>b.engagement-a.engagement)
  },[ranking,menuMap])

  const timeStats=useMemo(()=>{
    const map=new Map<number,{score:number;count:number;engagement:number}>()
    for(const item of ranking){
      if(!item.post.scheduled_for)continue
      const hour=hourInTimeZone(item.post.scheduled_for,restaurant.timezone)
      if(hour===null)continue
      const prev=map.get(hour)||{score:0,count:0,engagement:0}
      prev.score+=item.score;prev.count+=1;prev.engagement+=item.engagement;map.set(hour,prev)
    }
    return [...map.entries()].map(([hour,v])=>({hour,count:v.count,avgScore:v.score/v.count,avgEngagement:v.engagement/v.count})).sort((a,b)=>b.avgScore-a.avgScore||b.count-a.count)
  },[ranking,restaurant.timezone])

  const dayStats=useMemo(()=>{
    const map=new Map<number,{score:number;count:number;engagement:number}>()
    for(const item of ranking){
      if(!item.post.scheduled_for)continue
      const day=dayInTimeZone(item.post.scheduled_for,restaurant.timezone)
      if(day===null)continue
      const prev=map.get(day)||{score:0,count:0,engagement:0}
      prev.score+=item.score;prev.count+=1;prev.engagement+=item.engagement;map.set(day,prev)
    }
    return [...map.entries()].map(([day,v])=>({day,count:v.count,avgScore:v.score/v.count,avgEngagement:v.engagement/v.count})).sort((a,b)=>b.avgScore-a.avgScore||b.count-a.count)
  },[ranking,restaurant.timezone])

  const opportunities=useMemo(()=>{
    const cutoff=Date.now()-30*86400000
    const recentIds=new Set(posts.filter(post=>post.menu_item_id&&post.scheduled_for&&new Date(post.scheduled_for).getTime()>=cutoff).map(post=>post.menu_item_id as string))
    const sampleCount=new Map(dishStats.map(dish=>[dish.id,dish.samples]))
    return menuItems.filter(item=>item.is_active).map(item=>{
      const priority=Number(item.marketing_priority||0)
      if(!recentIds.has(item.id))return{item,kind:'gap' as const,score:100+priority*20,reason:priority>=2?'Visok prioritet, ali nije bio u sadržaju poslednjih 30 dana.':'Nije bio u sadržaju poslednjih 30 dana.'}
      if(priority>=2&&(sampleCount.get(item.id)||0)<2)return{item,kind:'test' as const,score:70+priority*15,reason:`Prioritetno jelo ima ${sampleCount.get(item.id)||0}/2 potrebna performance uzorka — treba ga još testirati.`}
      if(!item.image_url)return{item,kind:'photo' as const,score:40+priority*10,reason:'Aktivno jelo nema fotografiju, pa ne može da dobije najjači vizual.'}
      return null
    }).filter(Boolean).sort((a,b)=>(b?.score||0)-(a?.score||0)).slice(0,3) as {item:MenuItem;kind:'gap'|'test'|'photo';score:number;reason:string}[]
  },[posts,menuItems,dishStats])


  function openEditor(post:Post){
    const existing=rows.find(row=>row.post_id===post.id&&row.platform==='combined')||rows.find(row=>row.post_id===post.id)
    setEditing(post)
    setForm(existing?{
      platform:existing.platform,views:String(existing.views||''),impressions:String(existing.impressions||''),reach:String(existing.reach||''),likes:String(existing.likes||''),comments:String(existing.comments||''),saves:String(existing.saves||''),shares:String(existing.shares||''),clicks:String(existing.clicks||''),conversions:String(existing.conversions||''),spend:String(existing.spend||''),revenue:String(existing.revenue||''),currency:existing.currency||'RSD',notes:existing.notes||'',measured_at:new Date(existing.measured_at).toISOString().slice(0,10),
    }:{...emptyForm,currency:menuItems[0]?.currency||'RSD',measured_at:new Date().toISOString().slice(0,10)})
  }

  async function save(){
    if(!editing)return
    setSaving(true)
    const payload={
      post_id:editing.id,
      restaurant_id:restaurant.id,
      platform:form.platform,
      views:num(form.views),impressions:num(form.impressions),reach:num(form.reach),likes:num(form.likes),comments:num(form.comments),saves:num(form.saves),shares:num(form.shares),clicks:num(form.clicks),conversions:num(form.conversions),
      spend:money(form.spend),revenue:money(form.revenue),currency:form.currency||'RSD',notes:form.notes.trim()||null,source:'manual',measured_at:new Date(form.measured_at+'T12:00:00').toISOString(),
    }
    const{error}=await supabase.from('post_performance').upsert(payload,{onConflict:'post_id,platform'})
    if(error)setNotice(error.message)
    else{setNotice('Rezultati objave su sačuvani. Insights je preračunat.');setEditing(null);await load()}
    setSaving(false)
  }

  function downloadImportTemplate(){
    const header=['post_id','title','platform','views','reach','impressions','likes','comments','saves','shares','clicks','conversions','spend','revenue','currency','measured_at','notes']
    const sample=postsForTracking.slice(0,3).map(post=>[post.id,post.title||'Objava','combined','','','','','','','','','','','',menuItems[0]?.currency||'RSD',new Date().toISOString().slice(0,10),''])
    const csv=[header,...sample].map(row=>row.map(csvCell).join(';')).join('\n')
    const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slug(restaurant.name)}-performance-import-template.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
    setNotice('CSV šablon za performance import je preuzet.')
  }

  async function importPerformanceCsv(file:File){
    setImporting(true)
    try{
      const text=await file.text()
      const table=parseCsvTable(text)
      if(table.length<2){setNotice('CSV nema podatke za import.');return}
      const headers=table[0].map(normalizeHeader)
      const rows=table.slice(1).filter(row=>row.some(cell=>String(cell||'').trim()))
      const byTitle=new Map(posts.map(post=>[(post.title||'').trim().toLowerCase(),post]))
      const payloads:any[]=[]
      let skipped=0

      for(const row of rows){
        const record:Record<string,string>={}
        headers.forEach((header,index)=>{if(header)record[header]=String(row[index]??'').trim()})
        const postId=record.post_id||record.postid||record.id||''
        const title=(record.title||record.naslov||record.objava||'').trim().toLowerCase()
        const post=posts.find(item=>item.id===postId)||byTitle.get(title)
        if(!post){skipped+=1;continue}
        const rawPlatform=(record.platform||record.mreza||record.network||'combined').toLowerCase()
        const platform:Platform=rawPlatform.includes('instagram')||rawPlatform==='ig'?'instagram':rawPlatform.includes('facebook')||rawPlatform==='fb'?'facebook':'combined'
        const measuredRaw=record.measured_at||record.datum||record.date||''
        const measuredDate=measuredRaw&&Number.isFinite(new Date(measuredRaw).getTime())?new Date(measuredRaw):new Date()
        payloads.push({
          post_id:post.id,restaurant_id:restaurant.id,platform,
          views:csvNumber(record.views||record.pregledi),impressions:csvNumber(record.impressions||record.prikazi),reach:csvNumber(record.reach||record.doseg),
          likes:csvNumber(record.likes||record.lajkovi),comments:csvNumber(record.comments||record.komentari),
          saves:csvNumber(record.saves||record.sacuvano),shares:csvNumber(record.shares||record.deljenja),
          clicks:csvNumber(record.clicks||record.klikovi),conversions:csvNumber(record.conversions||record.konverzije),
          spend:csvMoney(record.spend||record.trosak),revenue:csvMoney(record.revenue||record.prihod),
          currency:(record.currency||record.valuta||menuItems[0]?.currency||'RSD').toUpperCase(),
          notes:record.notes||record.napomena||null,source:'import',measured_at:measuredDate.toISOString(),
        })
      }

      if(!payloads.length){setNotice('Nijedan CSV red nije povezan sa postojećom objavom. Koristi post_id ili isti naslov kao u Content Library.');return}
      const{error}=await supabase.from('post_performance').upsert(payloads,{onConflict:'post_id,platform'})
      if(error){setNotice(error.message);return}
      await load()
      await supabase.functions.invoke('content-engine',{body:{action:'log_activity',restaurantId:restaurant.id,eventType:'performance_imported',metadata:{imported:payloads.length,skipped}}})
      setNotice(`Uvezeno ${payloads.length} performance redova${skipped?` · preskočeno ${skipped} bez odgovarajuće objave`:''}. Autopilot learning je osvežen.`)
    }catch(error:any){setNotice(error?.message||'CSV import nije uspeo.')}
    finally{setImporting(false);if(importRef.current)importRef.current.value=''}
  }

  function exportCsv(){
    const header=['objava','datum','status','views','reach','impressions','likes','comments','saves','shares','clicks','conversions','engagement_%','spend','revenue','currency']
    const lines=ranking.map(item=>[
      item.post.title||'Objava',item.post.scheduled_for||'',item.post.status,item.m.views,item.m.reach,item.m.impressions,item.m.likes,item.m.comments,item.m.saves,item.m.shares,item.m.clicks,item.m.conversions,item.engagement.toFixed(2),item.m.spend,item.m.revenue,item.m.currency
    ].map(csvCell).join(';'))
    const blob=new Blob(['\ufeff'+[header.join(';'),...lines].join('\n')],{type:'text/csv;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slug(restaurant.name)}-performance.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
    setNotice('Performance CSV je preuzet.')
  }

  const best=ranking[0]
  const bestPillar=pillarStats[0]
  const bestDish=dishStats[0]
  const bestTime=timeStats[0]
  const bestDay=dayStats[0]
  const currency=ranking.find(x=>x.m.currency)?.m.currency||menuItems[0]?.currency||'RSD'
  const learningLevel=tracked.length>=8?'strong':tracked.length>=3?'learning':'starting'
  const learningLabel=learningLevel==='strong'?'Jako učenje':learningLevel==='learning'?'Učenje aktivno':'Tek počinje'
  const learningProgress=Math.min(100,Math.round((tracked.length/8)*100))
  const activeDishCount=menuItems.filter(item=>item.is_active).length
  const learnedDishCount=dishStats.filter(dish=>dish.samples>=2).length
  const dishCoverage=activeDishCount?Math.round((learnedDishCount/activeDishCount)*100):0

  return <div className="insights-center">
    <header className="page-header insights-header"><div><p className="eyebrow">PERFORMANCE LOOP</p><h1>Rezultati</h1><p className="muted">Upiši stvarne rezultate objava i Autopilot dobija povratnu informaciju šta kod tvog restorana radi najbolje.</p></div><div className="insights-head-actions"><label className="insights-period"><span>Period</span><select value={period} onChange={e=>setPeriod(e.target.value as '30'|'90'|'all')}><option value="30">30 dana</option><option value="90">90 dana</option><option value="all">Sve</option></select></label><input ref={importRef} className="performance-file-input" type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file)void importPerformanceCsv(file)}}/><button className="secondary" onClick={downloadImportTemplate}><FileDown size={15}/> CSV šablon</button><button className="secondary" onClick={()=>importRef.current?.click()} disabled={importing}><Upload size={15}/>{importing?'Uvozim…':'Uvezi rezultate'}</button><button className="secondary" onClick={()=>void syncMetaInsights()} disabled={metaSyncing}><RefreshCw size={15}/>{metaSyncing?'Meta sync…':'Meta sync'}</button><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?'Osvežavam…':'Osveži'}</button><button className="primary" onClick={exportCsv} disabled={!ranking.length}><Download size={15}/> Izvezi CSV</button></div></header>

    <section className="insights-kpis">
      <article><span><Target size={16}/> Doseg</span><strong>{fmt(totals.reach)}</strong><small>{totals.views?`${fmt(totals.views)} pregleda · `:''}{tracked.length} praćenih objava</small></article>
      <article><span><TrendingUp size={16}/> Engagement</span><strong>{totals.engagement.toFixed(1)}%</strong><small>{fmt(totals.interactions)} interakcija</small></article>
      <article><span><MousePointerClick size={16}/> Klikovi</span><strong>{fmt(totals.clicks)}</strong><small>CTR {totals.ctr.toFixed(1)}%</small></article>
      <article><span><CheckCircle2 size={16}/> Konverzije</span><strong>{fmt(totals.conversions)}</strong><small>{totals.spend>0?`ROAS ${totals.roas.toFixed(2)}x`:'bez unetog ad spend-a'}</small></article>
    </section>

    <section className="generation-performance panel">
      <div className="panel-heading"><div><p className="eyebrow">GENERATION PERFORMANCE</p><h2>AUTO WEEK vs MANUAL</h2></div><Sparkles size={20}/></div>
      <div className="generation-performance-grid">{generationStats.map(stat=><article key={stat.key} className={stat.key}><div><span>{stat.label}</span><strong>{stat.count}</strong><small>izmerenih objava</small></div><div><span>Engagement</span><strong>{stat.count?stat.engagement.toFixed(1)+'%':'—'}</strong><small>{stat.count?fmt(stat.reach)+' reach':'nema uzorka'}</small></div><div><span>CTR</span><strong>{stat.count?stat.ctr.toFixed(1)+'%':'—'}</strong><small>{stat.clicks} klikova</small></div><div><span>Konverzije</span><strong>{stat.count?fmt(stat.conversions):'—'}</strong><small>{stat.count>=3?'stabilniji uzorak':stat.count?'mali uzorak':'čeka podatke'}</small></div></article>)}</div>
      <p className="generation-performance-note">Poređenje koristi samo objave sa unetim performance podacima u izabranom periodu. Za smisleniji signal koristi bar 3 izmerene objave po grupi.</p>
    </section>

    <section className="trend-performance panel">
      <div className="panel-heading"><div><p className="eyebrow">TREND PERFORMANCE</p><h2>Trend objave vs ostali sadržaj</h2></div><TrendingUp size={20}/></div>
      <div className="trend-performance-grid">
        <article><span>Trend uzorak</span><strong>{trendPerformance.trend.count}</strong><small>{trendPerformance.trend.count?fmt(trendPerformance.trend.reach)+' reach':'čeka prve rezultate'}</small></article>
        <article><span>Trend engagement</span><strong>{trendPerformance.trend.count?trendPerformance.trend.engagement.toFixed(1)+'%':'—'}</strong><small>{trendPerformance.engagementDiff===null?'nema poređenja':(trendPerformance.engagementDiff>=0?'+':'')+trendPerformance.engagementDiff.toFixed(1)+' pp vs ostale'}</small></article>
        <article><span>Reach / objava</span><strong>{trendPerformance.trend.count?fmt(Math.round(trendPerformance.reachPerPostTrend)):'—'}</strong><small>{trendPerformance.reachDiff===null?'nema poređenja':(trendPerformance.reachDiff>=0?'+':'')+fmt(Math.round(trendPerformance.reachDiff))+' vs ostale'}</small></article>
        <article><span>Konverzije</span><strong>{trendPerformance.trend.count?fmt(trendPerformance.trend.conversions):'—'}</strong><small>{trendPerformance.trend.revenue?moneyFmt(trendPerformance.trend.revenue,currency):'bez unetog prihoda'}</small></article>
      </div>
      <p className="generation-performance-note">Ovo je samo poređenje rezultata u izabranom periodu. Ne tvrdi da je trend uzrok boljeg ili lošijeg rezultata; smislenije je kada imaš bar 3 izmerene trend objave.</p>
    </section>

    <section className="learning-status panel">
      <div className="learning-status-head">
        <div><p className="eyebrow">AUTOPILOT LEARNING</p><h2>{learningLabel}</h2><span>{tracked.length} stvarnih objava trenutno hrani sledeću generaciju sadržaja.</span></div>
        <strong>{learningProgress}%</strong>
      </div>
      <div className="learning-progress"><i style={{width:`${learningProgress}%`}}/></div>
      <div className="learning-coverage-row"><span>Performance coverage menija <b>{learnedDishCount}/{activeDishCount}</b></span><div><i style={{width:`${dishCoverage}%`}}/></div></div>
      <div className="learning-signals">
        <div><span>Najbolje jelo</span><strong>{bestDish?.name||'čeka podatke'}</strong></div>
        <div><span>Najjači pillar</span><strong>{bestPillar?pillarLabel(bestPillar.pillar):'čeka podatke'}</strong></div>
        <div><span>Top engagement</span><strong>{best?best.engagement.toFixed(1)+'%':'—'}</strong></div>
        <div><span>Najbolji termin</span><strong>{bestTime?`${String(bestTime.hour).padStart(2,'0')}:30`:'čeka podatke'}</strong></div><div><span>Najbolji dan</span><strong>{bestDay?dayLabel(bestDay.day):'čeka podatke'}</strong></div><div><span>Praćeno</span><strong>{tracked.length}/{postsForTracking.length}</strong></div>
      </div>
      <p>{learningLevel==='strong'?'Autopilot sada ima dovoljno lokalnih signala da prioritet, izbor jela i format više oslanja na rezultate ovog restorana, a manje na početne pretpostavke.':learningLevel==='learning'?'Model već koristi tvoje stvarne rezultate. Dodaj još nekoliko objava da preporuke budu stabilnije.':'Unesi rezultate za prve 3 objave. Do tada sistem koristi prioritet jela, recency i sigurni početni miks sadržaja.'}</p>
    </section>

    <section className="opportunity-radar panel">
      <div className="panel-heading"><div><p className="eyebrow">OPPORTUNITY RADAR</p><h2>Šta sledeće vredi testirati</h2></div><Target size={20}/></div>
      {opportunities.length?<div className="opportunity-list">{opportunities.map(({item,kind,reason})=><article key={item.id}><div className={`opportunity-kind ${kind}`}>{kind==='gap'?'CONTENT GAP':kind==='test'?'TEST SIGNAL':'PHOTO GAP'}</div><strong>{item.name}</strong><span>{reason}</span><small>{item.marketing_priority===3?'HERO':item.marketing_priority===2?'VISOK PRIORITET':item.marketing_priority===1?'PRIORITET':'STANDARDNO'}</small><button className="opportunity-action" disabled={testingItemId===item.id} onClick={()=>void createOpportunityTest(item,kind)}>{testingItemId===item.id?'Pravim test…':kind==='photo'?'Dodaj fotografiju':'Testiraj sledeće'}</button></article>)}</div>:<div className="opportunity-clear"><CheckCircle2 size={19}/><div><strong>Nema očiglednih rupa.</strong><span>Aktivna jela imaju svež sadržaj, fotografije i bar osnovne performance signale.</span></div></div>}
    </section>

    <section className="insights-smart panel">
      <div className="insights-smart-icon"><Sparkles size={21}/></div>
      <div><p className="eyebrow">SMART INSIGHT</p>{tracked.length<3?<><h2>Treba nam još stvarnih podataka.</h2><p>Unesi rezultate za bar 3 objave. Posle toga ovde dobijaš preporuku zasnovanu na stvarnom reach-u, engagementu i konverzijama tvog restorana.</p></>:<><h2>{bestPillar?pillarLabel(bestPillar.pillar)+' trenutno daje najbolji engagement.':'Rezultati se već razlikuju po sadržaju.'}</h2><p>{bestDish?<><b>{bestDish.name}</b> ima {bestDish.engagement.toFixed(1)}% engagement na praćenim objavama. </>:null}{best?<><b>{best.post.title||'Najbolja objava'}</b> je trenutno vodeća sa {best.engagement.toFixed(1)}% engagementa. </>:null}{bestTime?<><b>{String(bestTime.hour).padStart(2,'0')}:30</b> je trenutno najjači termin u unetom uzorku. </>:null}{bestDay?<><b>{dayLabel(bestDay.day)}</b> je trenutno najjači dan.</>:null} Ovo nije procena tržišta, već zaključak samo iz rezultata koje si uneo.</p></>}</div>
    </section>

    <div className="insights-grid">
      <section className="panel insights-ranking"><div className="panel-heading"><div><p className="eyebrow">TOP SADRŽAJ</p><h2>Šta radi najbolje</h2></div><BarChart3 size={20}/></div>
        {!ranking.length?<div className="insights-empty"><PieChart size={28}/><strong>Još nema rezultata.</strong><span>Objavi sadržaj, pa unesi stvarni reach i reakcije.</span></div>:ranking.slice(0,6).map((item,index)=><div className="ranking-row" key={item.post.id}><span className="ranking-no">0{index+1}</span><div className="ranking-copy"><strong>{item.post.title||'Objava'}</strong><small>{item.post.scheduled_for?fmtDate(item.post.scheduled_for):'Bez termina'} · {pillarLabel(String(item.post.generation_meta?.pillar||'other'))}</small><div className="ranking-track"><i style={{width:`${Math.max(5,Math.min(100,item.engagement*6))}%`}}/></div></div><div className="ranking-value"><strong>{item.engagement.toFixed(1)}%</strong><small>{fmt(item.m.reach)} reach</small></div></div>)}
      </section>

      <section className="panel insights-details"><div className="panel-heading"><div><p className="eyebrow">SIGNALI</p><h2>Šta publika radi</h2></div><Target size={20}/></div>
        <div className="signal-grid"><div><span>Saves</span><strong>{fmt(totals.saves)}</strong></div><div><span>Shares</span><strong>{fmt(totals.shares)}</strong></div><div><span>Comments</span><strong>{fmt(totals.comments)}</strong></div><div><span>Revenue</span><strong>{totals.revenue?moneyFmt(totals.revenue,currency):'—'}</strong></div></div>
        <div className="insights-note"><strong>Automatski + ručni podaci</strong><span>Kada je Meta nalog povezan sa Insights dozvolama, Autopilot periodično povlači views, reach i interakcije za objave koje je sam poslao. Ručni unos i CSV ostaju za konverzije, prihod i druge izvore.</span></div>
      </section>
    </div>

    <section className="panel insights-posts"><div className="panel-heading"><div><p className="eyebrow">OBJAVE</p><h2>Unesi rezultate</h2></div><small>{tracked.length}/{postsForTracking.length} praćeno</small></div>
      {!postsForTracking.length?<div className="insights-empty"><Target size={27}/><strong>Prvo odobri ili objavi sadržaj.</strong><span>Rezultati se prate za odobrene i objavljene postove.</span></div>:<div className="insights-post-list">{postsForTracking.map(post=>{const m=metricsByPost.get(post.id);const image=String(post.generation_meta?.image_url||post.generation_meta?.visual_design?.image_url||'');return <article key={post.id} className="insight-post-row">{image?<img src={image} alt=""/>:<div className="insight-post-placeholder"><BarChart3 size={19}/></div>}<div className="insight-post-copy"><strong>{post.title||'Objava'}</strong><small>{post.scheduled_for?fmtDate(post.scheduled_for):'Bez termina'} · {post.status==='published'?'Objavljeno':'Odobreno'}</small></div>{m?<div className="insight-post-numbers"><span><b>{fmt(m.reach)}</b> reach</span><span><b>{m.reach?(((m.likes+m.comments+m.saves+m.shares)/m.reach)*100).toFixed(1):'0.0'}%</b> eng.</span></div>:<span className="not-tracked">bez rezultata</span>}<button className={m?'secondary':'primary'} onClick={()=>openEditor(post)}><Pencil size={14}/>{m?'Izmeni':'Unesi'}</button></article>})}</div>}
    </section>

    {editing&&<div className="modal-backdrop" onMouseDown={()=>setEditing(null)}><div className="modal-card insights-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">PERFORMANCE</p><h2>{editing.title||'Rezultati objave'}</h2></div><button className="icon-button" onClick={()=>setEditing(null)}><X size={18}/></button></div>
      <div className="insights-form-grid">
        <label>Platforma<select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value as Platform})}><option value="combined">Ukupno / kombinovano</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label>
        <label>Datum merenja<input type="date" value={form.measured_at} onChange={e=>setForm({...form,measured_at:e.target.value})}/></label>
        <label>Views / pregledi<input type="number" min="0" value={form.views} onChange={e=>setForm({...form,views:e.target.value})}/></label>
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
  const seed={id:'',post_id:rows[0]?.post_id||'',restaurant_id:rows[0]?.restaurant_id||'',platform:'combined' as Platform,views:0,impressions:0,reach:0,likes:0,comments:0,saves:0,shares:0,clicks:0,conversions:0,spend:0,revenue:0,currency:rows[0]?.currency||'RSD',notes:null,source:'manual' as const,measured_at:rows[0]?.measured_at||new Date().toISOString(),created_at:'',updated_at:''}
  return rows.reduce((a,b)=>({...a,views:a.views+Number(b.views||0),impressions:a.impressions+Number(b.impressions||0),reach:a.reach+Number(b.reach||0),likes:a.likes+Number(b.likes||0),comments:a.comments+Number(b.comments||0),saves:a.saves+Number(b.saves||0),shares:a.shares+Number(b.shares||0),clicks:a.clicks+Number(b.clicks||0),conversions:a.conversions+Number(b.conversions||0),spend:a.spend+Number(b.spend||0),revenue:a.revenue+Number(b.revenue||0)}),seed)
}
function num(v:string){const n=Math.floor(Number(v||0));return Number.isFinite(n)&&n>0?n:0}
function money(v:string){const n=Number(v||0);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:0}
function fmt(v:number){return new Intl.NumberFormat('sr-RS',{notation:v>=10000?'compact':'standard',maximumFractionDigits:1}).format(v)}
function fmtDate(v:string){return new Date(v).toLocaleDateString('sr-RS',{day:'2-digit',month:'short',year:'numeric'})}
function moneyFmt(v:number,currency:string){return new Intl.NumberFormat('sr-RS',{style:'currency',currency:currency==='RSD'?'RSD':currency,maximumFractionDigits:0}).format(v)}
function csvCell(v:unknown){const s=String(v??'');return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function slug(v:string){return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'restaurant'}
function pillarLabel(v:string){return({hero_dish:'Hero jelo',engagement:'Engagement',local_discovery:'Local discovery',kitchen_story:'Iza scene',social_prompt:'Social prompt',promotion:'Promocija',other:'Ostalo'} as Record<string,string>)[v]||v.replace(/_/g,' ')}

function hourInTimeZone(value:string,timeZone:string){
  try{
    const hour=new Intl.DateTimeFormat('en-US',{timeZone,hour:'2-digit',hourCycle:'h23'}).format(new Date(value))
    const n=Number(hour);return Number.isFinite(n)?n:null
  }catch{return null}
}

function dayInTimeZone(value:string,timeZone:string){
  try{
    const label=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short'}).format(new Date(value))
    const map:Record<string,number>={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6}
    return map[label]??null
  }catch{return null}
}
function dayLabel(day:number){return ['Ponedeljak','Utorak','Sreda','Četvrtak','Petak','Subota','Nedelja'][day]||'—'}

function parseCsvTable(text:string){
  const clean=text.replace(/^\uFEFF/,'')
  const first=(clean.split(/\r?\n/,1)[0]||'')
  const delimiter=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':','
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false
  for(let i=0;i<clean.length;i++){
    const ch=clean[i]
    if(ch==='"'){
      if(quoted&&clean[i+1]==='"'){cell+='"';i+=1}else quoted=!quoted
    }else if(ch===delimiter&&!quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&clean[i+1]==='\n')i+=1
      row.push(cell);rows.push(row);row=[];cell=''
    }else cell+=ch
  }
  if(cell.length||row.length){row.push(cell);rows.push(row)}
  return rows
}
function normalizeHeader(value:string){return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function csvNumber(value:string|undefined){const clean=String(value||'').trim().replace(/\s/g,'').replace(/(?<=\d)[.](?=\d{3}(?:\D|$))/g,'').replace(',','.');const n=Math.floor(Number(clean||0));return Number.isFinite(n)&&n>0?n:0}
function csvMoney(value:string|undefined){const clean=String(value||'').trim().replace(/\s/g,'').replace(/(?<=\d)[.](?=\d{3}(?:\D|$))/g,'').replace(',','.');const n=Number(clean||0);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:0}
