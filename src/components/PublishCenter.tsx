import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CalendarRange, CheckCircle2, ClipboardCopy, Clock3, Download, ExternalLink, Facebook, Instagram, List, Pencil, RotateCcw, Save, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Post, Restaurant } from '../types'

type ScheduleDraft = { date: string; time: string }
type MetaCandidate={id:string;name:string;instagram_business_account?:{id:string;username:string}|null;tasks?:string[]}
type MetaConnection={
  id:string;status:'pending_oauth'|'pending_page_selection'|'connected'|'expired'|'error'|'disconnected';
  page_id:string|null;page_name:string|null;instagram_business_account_id:string|null;instagram_username:string|null;
  token_expires_at:string|null;scopes:string[];connection_meta?:{page_candidates?:MetaCandidate[]};connected_at:string|null;last_verified_at:string|null
}
type MetaState={provider_configured:boolean;connection:MetaConnection|null;insights_ready?:boolean;missing_insights_scopes?:string[];callback_url?:string}
type MetaJob={id:string;post_id:string;platform:'facebook'|'instagram';status:'queued'|'processing'|'published'|'failed'|'cancelled';publish_at:string;attempt_count:number;provider_media_id:string|null;error_message:string|null;published_at:string|null;result?:{recovery?:{manual_review_required?:boolean}}|null}

export function PublishCenter({ restaurant, posts, onChanged, setNotice }: {
  restaurant: Restaurant
  posts: Post[]
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [workingId, setWorkingId] = useState('')
  const [qualityScores, setQualityScores] = useState<Record<string, number>>({})
  const [editingId, setEditingId] = useState('')
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({ date: '', time: '' })
  const [view,setView]=useState<'queue'|'calendar'>('queue')
  const [bulkWorking,setBulkWorking]=useState(false)
  const [metaState,setMetaState]=useState<MetaState|null>(null)
  const [metaWorking,setMetaWorking]=useState(false)
  const [metaPageId,setMetaPageId]=useState('')
  const [metaJobs,setMetaJobs]=useState<MetaJob[]>([])

  const ordered = useMemo(() => [...posts].sort((a, b) => new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()), [posts])
  const approved = posts.filter((post) => post.status === 'approved')
  const published = posts.filter((post) => post.status === 'published')
  const drafts = posts.filter((post) => post.status === 'draft' || post.status === 'rejected')
  const overdue = approved.filter((post) => post.scheduled_for && new Date(post.scheduled_for).getTime() < Date.now())
  const missingSchedule = posts.filter((post) => post.status !== 'published' && !post.scheduled_for).length
  const readyPercent = posts.length ? Math.round(((approved.length + published.length) / posts.length) * 100) : 0
  const nextPost = ordered.find((post) => post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now() && post.status !== 'published') || ordered.find((post) => post.scheduled_for && post.status !== 'published')
  const calendarDays=useMemo(()=>buildCalendarDays(restaurant,14),[restaurant.id,restaurant.timezone,restaurant.opening_hours])
  const calendarMap=useMemo(()=>{
    const map=new Map<string,Post[]>()
    for(const post of ordered){if(!post.scheduled_for)continue;const p=zonedParts(post.scheduled_for,restaurant.timezone);const key=`${p.year}-${p.month}-${p.day}`;map.set(key,[...(map.get(key)||[]),post])}
    return map
  },[ordered,restaurant.timezone])
  const conflicts=useMemo(()=>ordered.filter((post,index)=>{
    if(!post.scheduled_for||post.status==='published')return false
    return ordered.some((other,j)=>j!==index&&other.scheduled_for&&other.status!=='published'&&Math.abs(new Date(other.scheduled_for).getTime()-new Date(post.scheduled_for!).getTime())<45*60*1000)
  }).length,[ordered])
  const publishGate=useMemo(()=>{
    const reasons:string[]=[]
    if(drafts.length)reasons.push(`${drafts.length} čeka quality/odobrenje`)
    if(missingSchedule)reasons.push(`${missingSchedule} bez termina`)
    if(overdue.length)reasons.push(`${overdue.length} termin u prošlosti`)
    if(conflicts)reasons.push(`${conflicts} konflikt termina`)
    const allDone=posts.length>0&&published.length===posts.length
    const ready=posts.length>0&&!reasons.length
    return{ready,allDone,reasons,label:allDone?'Nedelja završena':ready?'Spremno za publishing':posts.length?'Treba završiti':'Čeka sadržaj'}
  },[posts.length,published.length,drafts.length,missingSchedule,overdue.length,conflicts])

  async function loadMetaJobs(){
    const{data}=await supabase.from('social_publish_jobs').select('id,post_id,platform,status,publish_at,attempt_count,provider_media_id,error_message,published_at,result').eq('restaurant_id',restaurant.id).order('created_at',{ascending:false}).limit(150)
    setMetaJobs((data||[]) as MetaJob[])
  }

  async function loadMetaStatus(){
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'status',restaurantId:restaurant.id}})
    if(!error&&!data?.error){
      setMetaState(data as MetaState)
      const candidates=(data?.connection?.connection_meta?.page_candidates||[]) as MetaCandidate[]
      if(data?.connection?.status==='pending_page_selection'&&candidates.length&&!metaPageId)setMetaPageId(candidates[0].id)
    }
  }

  useEffect(()=>{
    void loadMetaStatus()
    void loadMetaJobs()
    const handler=(event:MessageEvent)=>{
      if(event.data?.type!=='restaurant-autopilot-meta')return
      void loadMetaStatus()
      setNotice(event.data?.ok?'Meta povezivanje je završeno. Proveravam stranicu i Instagram nalog…':'Meta povezivanje nije završeno.')
    }
    window.addEventListener('message',handler)
    return()=>window.removeEventListener('message',handler)
  },[restaurant.id])

  async function verifyMetaConnection(){
    setMetaWorking(true)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'verify_connection',restaurantId:restaurant.id}})
    if(error||data?.error){
      setNotice(data?.error||error?.message||'Meta konekcija nije validna.')
    }else{
      setNotice(`Meta konekcija je potvrđena: ${data?.page_name||'Facebook Page'}${data?.instagram_username?` · @${data.instagram_username}`:''}.`)
    }
    await loadMetaStatus()
    await loadMetaJobs()
    setMetaWorking(false)
  }

  async function connectMeta(){
    setMetaWorking(true)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'start',restaurantId:restaurant.id}})
    if(error||data?.error){setNotice(data?.error||error?.message||'Meta Connect nije pokrenut.');setMetaWorking(false);return}
    const popup=window.open(data.authorization_url,'restaurant-autopilot-meta','popup=yes,width=620,height=760')
    if(!popup)window.location.href=data.authorization_url
    else setNotice('Meta Connect je otvoren u novom prozoru. Odobri pristup Facebook stranici i Instagram nalogu.')
    setMetaWorking(false)
  }

  async function selectMetaPage(){
    if(!metaPageId)return
    setMetaWorking(true)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'select_page',restaurantId:restaurant.id,pageId:metaPageId}})
    if(error||data?.error)setNotice(data?.error||error?.message||'Stranica nije povezana.')
    else{setNotice('Facebook stranica i povezani Instagram nalog su aktivirani.');await loadMetaStatus()}
    setMetaWorking(false)
  }

  async function disconnectMeta(){
    if(!window.confirm('Odvojiti Facebook / Instagram nalog od ovog restorana?'))return
    setMetaWorking(true)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'disconnect',restaurantId:restaurant.id}})
    if(error||data?.error)setNotice(data?.error||error?.message||'Meta nalog nije odvojen.')
    else{setNotice('Meta nalog je odvojen od restorana.');await loadMetaStatus()}
    setMetaWorking(false)
  }

  function metaJobsFor(postId:string){return metaJobs.filter(job=>job.post_id===postId&&job.status!=='cancelled')}
  function metaJobNeedsOwnerReview(job:MetaJob){return Boolean(job.result?.recovery?.manual_review_required)||Boolean(job.provider_media_id)||Number(job.attempt_count||0)>=3}

  function metaPlatforms(post:Post){
    const out:('facebook'|'instagram')[]=[]
    if(metaState?.connection?.status!=='connected')return out
    if(metaState.connection.page_id)out.push('facebook')
    const image=String(post.generation_meta?.image_url||'')
    if(metaState.connection.instagram_business_account_id&&image&&post.post_type!=='story')out.push('instagram')
    return out
  }

  async function sendToMeta(post:Post,publishNow:boolean){
    const platforms=metaPlatforms(post)
    if(!platforms.length){setNotice('Nema podržane Meta platforme za ovu objavu. Instagram zahteva povezani profesionalni nalog i javnu fotografiju.');return}
    setWorkingId('meta-'+post.id)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'queue',restaurantId:restaurant.id,postId:post.id,platforms,publishNow,publishAt:post.scheduled_for}})
    if(error||data?.error)setNotice(data?.error||error?.message||'Meta publishing nije uspeo.')
    else if(publishNow){
      const failed=(data?.results||[]).filter((x:any)=>x.error)
      if(failed.length)setNotice(`Meta: ${platforms.length-failed.length}/${platforms.length} platforme objavljeno. ${failed.map((x:any)=>x.error).join(' · ')}`)
      else{setNotice(`Objavljeno direktno na ${platforms.map(p=>p==='instagram'?'Instagram':'Facebook').join(' + ')}.`);await supabase.from('posts').update({status:'published'}).eq('id',post.id).eq('restaurant_id',restaurant.id);await onChanged()}
    }else setNotice(`Meta queue: ${platforms.length} platforme zakazane za ${post.scheduled_for?formatDateLong(post.scheduled_for,restaurant.timezone)+' u '+formatTime(post.scheduled_for,restaurant.timezone):'prvi mogući termin'}.`)
    await loadMetaJobs()
    setWorkingId('')
  }

  async function retryMetaJob(job:MetaJob){
    setWorkingId('job-'+job.id)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'retry_job',restaurantId:restaurant.id,jobId:job.id}})
    if(error||data?.error)setNotice(data?.error||error?.message||'Meta retry nije uspeo.')
    else{setNotice(`${job.platform==='instagram'?'Instagram':'Facebook'} publishing je ponovo pokrenut.`);await onChanged()}
    await loadMetaJobs()
    setWorkingId('')
  }

  async function cancelMetaJob(job:MetaJob){
    if(!window.confirm(`Otkaži zakazanu ${job.platform==='instagram'?'Instagram':'Facebook'} objavu?`))return
    setWorkingId('job-'+job.id)
    const{data,error}=await supabase.functions.invoke('meta-publisher',{body:{action:'cancel_job',restaurantId:restaurant.id,jobId:job.id}})
    if(error||data?.error)setNotice(data?.error||error?.message||'Meta job nije otkazan.')
    else setNotice(`${job.platform==='instagram'?'Instagram':'Facebook'} zakazivanje je otkazano.`)
    await loadMetaJobs()
    setWorkingId('')
  }

  function exportCsv() {
    if (!posts.length) { setNotice('Nema sadržaja za export.'); return }
    const headers = ['datum','vreme','status','format','naslov','instagram_caption','instagram_hashtags','facebook_caption','facebook_hashtags','cta','search_keywords']
    const rows = ordered.map((post) => [
      post.scheduled_for ? formatDate(post.scheduled_for, restaurant.timezone) : '',
      post.scheduled_for ? formatTime(post.scheduled_for, restaurant.timezone) : '',
      post.status, post.post_type, post.title || '',
      post.platform_content?.instagram?.caption || post.caption || '',
      (post.platform_content?.instagram?.hashtags || post.hashtags || []).join(' '),
      post.platform_content?.facebook?.caption || post.caption || '',
      (post.platform_content?.facebook?.hashtags || []).join(' '),
      post.cta || '', (post.seo_keywords || []).join(' | '),
    ])
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')
    downloadBlob(`autopilot-${slug(restaurant.name)}-content.csv`, new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    setNotice('Nedeljni plan je izvezen sa datumom i vremenom svake objave.')
  }

  function exportCalendar() {
    const scheduled = ordered.filter((post) => post.scheduled_for)
    if (!scheduled.length) { setNotice('Nema zakazanih termina za kalendar.'); return }
    const body = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Restaurant Autopilot//Content Calendar//SR']
    scheduled.forEach((post) => {
      const start = new Date(post.scheduled_for!).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
      const end = new Date(new Date(post.scheduled_for!).getTime() + 30 * 60 * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
      body.push('BEGIN:VEVENT', `UID:${post.id}@restaurant-autopilot`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${icsText(`${post.post_type.toUpperCase()} · ${post.title || 'Objava'}`)}`, `DESCRIPTION:${icsText(post.caption || '')}`, 'END:VEVENT')
    })
    body.push('END:VCALENDAR')
    downloadBlob(`autopilot-${slug(restaurant.name)}-calendar.ics`, new Blob([body.join('\r\n')], { type: 'text/calendar;charset=utf-8' }))
    setNotice('Content kalendar je izvezen sa tačnim terminima objava.')
  }

  async function copyReadyBundle() {
    if (!approved.length) { setNotice('Prvo odobri bar jednu objavu.'); return }
    const text = approved.map((post, index) => {
      const igCaption = post.platform_content?.instagram?.caption || post.caption || ''
      const tags = (post.platform_content?.instagram?.hashtags || post.hashtags || []).join(' ')
      return `${index + 1}. ${post.title || 'OBJAVA'}\n${post.scheduled_for ? `${formatDateLong(post.scheduled_for, restaurant.timezone)} u ${formatTime(post.scheduled_for, restaurant.timezone)}` : 'Bez termina'}\n\n${igCaption}\n\n${tags}`
    }).join('\n\n────────────────────\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`Kopirano je ${approved.length} odobrenih objava sa terminima.`)
    } catch { setNotice('Browser nije dozvolio kopiranje. Koristi CSV export.') }
  }

  async function qualityCheck(post: Post) {
    setWorkingId(post.id)
    const { data, error } = await supabase.functions.invoke('content-engine', { body: { action: 'quality_check', restaurantId: restaurant.id, postId: post.id } })
    if (error) setNotice(error.message)
    else if (data?.error) setNotice(data.error)
    else {
      const score = Number(data?.score || 0)
      setQualityScores((current) => ({ ...current, [post.id]: score }))
      const missing = Object.entries(data?.checks || {}).filter(([, ok]) => !ok).map(([key]) => qualityLabel(key))
      setNotice(missing.length ? `Quality ${score}/100 · popravi: ${missing.join(', ')}.` : `Quality ${score}/100 · objava je tehnički spremna.`)
    }
    setWorkingId('')
  }

  async function approveAll() {
    if (!drafts.length) { setNotice('Nema draft objava za odobravanje.'); return }
    setWorkingId('bulk-approve')
    const passed:string[]=[]
    const failed:string[]=[]
    for(const post of drafts){
      const {data,error}=await supabase.functions.invoke('content-engine',{body:{action:'quality_check',restaurantId:restaurant.id,postId:post.id}})
      if(error||data?.error||Number(data?.score||0)<70)failed.push(post.title||'Objava')
      else passed.push(post.id)
    }
    if(passed.length){
      const {error}=await supabase.from('posts').update({status:'approved'}).in('id',passed).eq('restaurant_id',restaurant.id)
      if(error){setNotice(error.message);setWorkingId('');return}
    }
    await onChanged()
    await supabase.functions.invoke('content-engine',{body:{action:'log_activity',restaurantId:restaurant.id,eventType:'weekly_review_completed',metadata:{approved:passed.length,flagged:failed.length,total:drafts.length}}})
    setNotice(failed.length
      ? `Odobreno ${passed.length}. Preskočeno ${failed.length} jer nisu prošle quality check.`
      : `Sve objave su prošle quality check i odobrene su (${passed.length}).`)
    setWorkingId('')
  }

  async function autoScheduleWeek(){
    const candidates=ordered.filter(post=>post.status!=='published')
    if(!candidates.length){setNotice('Nema sadržaja za automatsko raspoređivanje.');return}
    setBulkWorking(true)
    const start=localDateString(new Date(),restaurant.timezone)
    const updates:{id:string;scheduled_for:string}[]=[]
    let cursor=start
    for(let i=0;i<candidates.length;i++){
      if(i>0)cursor=addLocalDays(cursor,1)
      const draft=autopilotDraft(candidates[i],cursor,restaurant)
      cursor=draft.date
      updates.push({id:candidates[i].id,scheduled_for:zonedInputToIso(`${draft.date}T${draft.time}`,restaurant.timezone)})
    }
    for(const row of updates){
      const{error}=await supabase.from('posts').update({scheduled_for:row.scheduled_for}).eq('id',row.id).eq('restaurant_id',restaurant.id)
      if(error){setNotice(error.message);setBulkWorking(false);return}
    }
    await supabase.functions.invoke('meta-publisher',{body:{action:'sync_schedule',restaurantId:restaurant.id,updates:updates.map(row=>({postId:row.id,publishAt:row.scheduled_for}))}})
    await loadMetaJobs()
    await onChanged()
    await supabase.functions.invoke('content-engine',{body:{action:'log_activity',restaurantId:restaurant.id,eventType:'schedule_adjusted',metadata:{count:updates.length,learned:true}}})
    setNotice(`Autopilot je rasporedio ${updates.length} objava bez preklapanja i uz radno vreme restorana.`)
    setBulkWorking(false)
  }

  async function markOverduePublished(){
    if(!overdue.length)return
    const confirmed=window.confirm(`Potvrdi da je ${overdue.length} odobrenih objava zaista objavljeno na društvenim mrežama. Ova akcija samo menja status u Restaurant Autopilotu.`)
    if(!confirmed)return
    setBulkWorking(true)
    const ids=overdue.map(post=>post.id)
    const{error}=await supabase.from('posts').update({status:'published'}).in('id',ids).eq('restaurant_id',restaurant.id).eq('status','approved')
    if(error){setNotice(error.message);setBulkWorking(false);return}
    await supabase.functions.invoke('content-engine',{body:{action:'log_activity',restaurantId:restaurant.id,eventType:'publishing_confirmed',metadata:{count:ids.length}}})
    await onChanged()
    setNotice(`${ids.length} objava je potvrđeno kao objavljeno. Performance reminder će se pojaviti kada dođe vreme za unos rezultata.`)
    setBulkWorking(false)
  }

  async function markPublished(post: Post) {
    setWorkingId(post.id)
    const { error } = await supabase.from('posts').update({ status: 'published' }).eq('id', post.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Objava je označena kao objavljena.')
      await onChanged()
    }
    setWorkingId('')
  }

  function openSchedule(post: Post) {
    const initial = post.scheduled_for ? dateParts(post.scheduled_for, restaurant.timezone) : defaultDraft(post, restaurant)
    setScheduleDraft(initial)
    setEditingId(post.id)
  }

  function useAutopilotTime(post: Post) {
    const base = scheduleDraft.date ? scheduleDraft : defaultDraft(post, restaurant)
    setScheduleDraft(autopilotDraft(post, base.date, restaurant))
  }

  async function copyPlatform(post:Post,platform:'instagram'|'facebook'){
    const pack=post.platform_content?.[platform]
    const caption=pack?.caption||post.caption||''
    const tags=(pack?.hashtags||(platform==='instagram'?post.hashtags:[])||[]).join(' ')
    const text=[caption,tags].filter(Boolean).join('\n\n')
    if(!text){setNotice('Nema teksta za kopiranje.');return}
    try{await navigator.clipboard.writeText(text);setNotice(`${platform==='instagram'?'Instagram':'Facebook'} tekst je kopiran.`)}
    catch{setNotice('Browser nije dozvolio kopiranje.')}
  }

  async function openBusinessSuite(post:Post){
    await copyPlatform(post,'facebook')
    window.open('https://business.facebook.com/latest/composer','_blank','noopener,noreferrer')
  }

  async function saveSchedule(post: Post) {
    if (!scheduleDraft.date || !scheduleDraft.time) {
      setNotice('Izaberi datum i vreme objave.')
      return
    }
    let scheduledIso = ''
    try { scheduledIso = zonedInputToIso(`${scheduleDraft.date}T${scheduleDraft.time}`, restaurant.timezone) }
    catch { setNotice('Termin nije ispravan.'); return }
    setWorkingId(post.id)
    const { error } = await supabase.from('posts').update({ scheduled_for: scheduledIso }).eq('id', post.id)
    if (error) setNotice(error.message)
    else {
      await supabase.functions.invoke('meta-publisher',{body:{action:'sync_schedule',restaurantId:restaurant.id,updates:[{postId:post.id,publishAt:scheduledIso}]}})
      await loadMetaJobs()
      await supabase.functions.invoke('content-engine',{body:{action:'log_activity',restaurantId:restaurant.id,eventType:'schedule_adjusted',metadata:{post_id:post.id,learned:false,count:1}}})
      setNotice(`Termin je sačuvan: ${formatDateLong(scheduledIso, restaurant.timezone)} u ${formatTime(scheduledIso, restaurant.timezone)} · ${restaurant.timezone}. Meta queue je usklađen ako je objava već bila zakazana.`)
      setEditingId('')
      await onChanged()
    }
    setWorkingId('')
  }

  return (
    <>
      <header className="page-header publish-header">
        <div><p className="eyebrow">PUBLISH CENTER</p><h1>Tačan dan. Tačno vreme. Sve spremno.</h1><p className="muted">Svaka objava ima termin u vremenskoj zoni restorana: <strong>{restaurant.timezone}</strong>.</p></div>
        <div className="publish-actions">{drafts.length>0&&<button className="secondary" onClick={()=>void approveAll()} disabled={workingId==='bulk-approve'}><CheckCircle2 size={16}/>{workingId==='bulk-approve'?'Proveravam…':`Quality + odobri (${drafts.length})`}</button>}<button className="secondary" onClick={()=>void autoScheduleWeek()} disabled={bulkWorking}><Sparkles size={16}/>{bulkWorking?'Raspoređujem…':'Auto rasporedi'}</button><button className="secondary" onClick={exportCalendar}><CalendarClock size={16} /> .ICS kalendar</button><button className="primary" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
      </header>

      <section className={`meta-connect-panel ${metaState?.connection?.status==='connected'?'connected':metaState?.connection?.status==='expired'?'expired':''}`}>
        <div className="meta-connect-brand"><div><Facebook size={20}/><Instagram size={20}/></div><span><small>META PUBLISHING</small><strong>{metaState?.connection?.status==='connected'?'Facebook + Instagram povezani':metaState?.connection?.status==='pending_page_selection'?'Izaberi Facebook stranicu':metaState?.provider_configured?'Poveži poslovni nalog':'Meta App čeka OWNER konfiguraciju'}</strong><p>{metaState?.connection?.status==='connected'
          ? `${metaState.connection.page_name||'Facebook Page'}${metaState.connection.instagram_username?` · @${metaState.connection.instagram_username}`:' · Instagram nije povezan'} · ${metaJobs.filter(j=>j.status==='queued').length} queued · ${metaJobs.filter(j=>j.status==='failed').length} failed · ${metaState.insights_ready?'Insights AUTO':'Insights traži obnovu dozvola'}${metaState.connection.last_verified_at?` · provereno ${new Date(metaState.connection.last_verified_at).toLocaleString('sr-RS')}`:''}`
          : metaState?.connection?.status==='expired'
          ? 'Meta token je istekao. Poveži nalog ponovo.'
          : metaState?.provider_configured
          ? 'OAuth tokeni ostaju server-side u Vault-u. Posle povezivanja možeš direktno da objavljuješ ili zakažeš odobrene objave.'
          : 'OWNER prvo treba da unese Meta App ID i App Secret. Posle toga restoran sam povezuje svoju Facebook stranicu.'}</p></span></div>
        <div className="meta-connect-actions">
          {metaState?.connection?.status==='pending_page_selection'?<><select value={metaPageId} onChange={e=>setMetaPageId(e.target.value)}>{((metaState.connection.connection_meta?.page_candidates||[]) as MetaCandidate[]).map(page=><option value={page.id} key={page.id}>{page.name}{page.instagram_business_account?.username?` · @${page.instagram_business_account.username}`:''}</option>)}</select><button className="primary" onClick={()=>void selectMetaPage()} disabled={metaWorking||!metaPageId}><CheckCircle2 size={15}/> Poveži stranicu</button></>
          :metaState?.connection?.status==='connected'?<><span className="meta-connected-chip"><CheckCircle2 size={14}/> CONNECTED</span>{!metaState.insights_ready&&<button className="secondary" onClick={()=>void connectMeta()} disabled={metaWorking}><RotateCcw size={14}/>{metaWorking?'Otvaram…':'Obnovi Insights dozvole'}</button>}<button className="secondary" onClick={()=>void verifyMetaConnection()} disabled={metaWorking}><RotateCcw size={14}/>{metaWorking?'Proveravam…':'Proveri konekciju'}</button><button className="meta-disconnect" onClick={()=>void disconnectMeta()} disabled={metaWorking}>Odvoji</button></>
          :<button className="primary meta-connect-button" onClick={()=>void connectMeta()} disabled={metaWorking||!metaState?.provider_configured}><Facebook size={15}/>{metaWorking?'Otvaram…':'Poveži Facebook + Instagram'}</button>}
        </div>
      </section>

      <section className={`publish-gate ${publishGate.allDone?'done':publishGate.ready?'ready':'blocked'}`}>
        <div className="publish-gate-icon">{publishGate.allDone||publishGate.ready?<CheckCircle2 size={20}/>:<ShieldCheck size={20}/>}</div>
        <div><span>WEEK GATE</span><strong>{publishGate.label}</strong><small>{publishGate.reasons.length?publishGate.reasons.join(' · '):publishGate.allDone?'Sve planirane objave su označene kao objavljene.':'Nema tehničkih blokera: termini i approval status su spremni.'}</small></div>
        <b>{published.length}/{posts.length || 0}</b>
      </section>

      {nextPost && <section className="next-publish-card">
        <div className="next-publish-icon"><Clock3 size={22} /></div>
        <div><span>SLEDEĆA OBJAVA</span><strong>{formatDateLong(nextPost.scheduled_for!, restaurant.timezone)} · {formatTime(nextPost.scheduled_for!, restaurant.timezone)}</strong><small>{nextPost.post_type.toUpperCase()} · {nextPost.title || 'Objava'}</small></div>
        <button className="secondary" onClick={() => openSchedule(nextPost)}><Pencil size={14} /> Promeni termin</button>
      </section>}

      <section className="publish-stats">
        <div><span>Spremnost nedelje</span><strong>{readyPercent}%</strong><div className="readiness-track"><i style={{ width: `${readyPercent}%` }} /></div></div>
        <div><span>Odobreno</span><strong>{approved.length}</strong><small>čeka objavu</small></div>
        <div><span>Objavljeno</span><strong>{published.length}</strong><small>završeno</small></div>
        <button className="copy-bundle" onClick={copyReadyBundle}><ClipboardCopy size={18} /><div><strong>Kopiraj odobrene</strong><span>termin + caption + hashtagovi</span></div></button>
      </section>

      {overdue.length>0&&<div className="publish-overdue-note"><Clock3 size={17}/><div><strong>{overdue.length} odobrenih objava ima termin u prošlosti.</strong><span>Promeni termin pre objavljivanja da red za objavu ostane tačan.</span></div></div>}
      {conflicts>0&&<div className="publish-overdue-note publish-conflict-note"><Clock3 size={17}/><div><strong>{conflicts} objava ima termin koji se preklapa sa drugom objavom.</strong><span>Klikni „Auto rasporedi“ da razdvoji termine uz radno vreme restorana.</span></div></div>}
      <div className="publishing-note"><Sparkles size={17} /><div><strong>Autopilot raspoređuje, ti kontrolišeš</strong><span>Početni termini se generišu automatski prema tipu sadržaja i radnom vremenu. Svaki datum i vreme možeš ručno da promeniš.</span></div></div>

      <section className="publish-queue panel">
        <div className="panel-heading publish-view-head"><h2>{view==='queue'?<><Send size={18}/> Red za objavu</>:<><CalendarRange size={18}/> Kalendar sadržaja</>}</h2><div className="publish-view-switch"><button className={view==='queue'?'active':''} onClick={()=>setView('queue')}><List size={14}/> Red</button><button className={view==='calendar'?'active':''} onClick={()=>setView('calendar')}><CalendarRange size={14}/> 14 dana</button></div></div>
        {view==='calendar'?<div className="publish-calendar">{calendarDays.map(day=>{const dayPosts=calendarMap.get(day.key)||[];return <article key={day.key} className={`publish-day ${day.today?'today':''} ${day.open?'':'closed'}`}><header><span>{day.weekday}</span><strong>{day.label}</strong>{!day.open&&<small>Zatvoreno</small>}</header><div className="publish-day-posts">{dayPosts.length?dayPosts.map(post=><button key={post.id} className={`calendar-post ${post.status}`} onClick={()=>openSchedule(post)}><span>{post.scheduled_for?formatTime(post.scheduled_for,restaurant.timezone):'—'}</span><strong>{post.title||'Objava'}</strong><small>{post.post_type}</small></button>):<span className="calendar-empty">bez objave</span>}</div></article>})}</div>
        :ordered.length === 0 ? <div className="empty-small">Generiši nedelju sadržaja da bi se pojavio red za objavu.</div> : <div className="queue-list">
          {ordered.map((post) => <div className={`queue-item ${editingId === post.id ? 'editing-schedule' : ''}`} key={post.id}>
            <div className={`queue-date ${post.status}`}><strong>{post.scheduled_for ? formatDate(post.scheduled_for, restaurant.timezone) : '—'}</strong><span className="queue-time"><Clock3 size={11} /> {post.scheduled_for ? formatTime(post.scheduled_for, restaurant.timezone) : 'bez termina'}</span></div>
            <div className="queue-copy">
              <div className="queue-title"><span className="queue-format">{post.post_type}</span><strong>{post.title || 'Objava'}</strong>{post.scheduled_for && <span className="schedule-chip">{formatWeekday(post.scheduled_for, restaurant.timezone)} · {formatTime(post.scheduled_for, restaurant.timezone)}</span>}{post.generation_meta?.learning_signal?.schedule_hour !== null && post.generation_meta?.learning_signal?.schedule_hour !== undefined && <span className="learned-time-chip"><Sparkles size={11}/> LEARNED TIME</span>}{Number(post.generation_meta?.learning_signal?.approved_trend_boost||0)>0&&<span className="learned-time-chip"><Sparkles size={11}/> TREND BOOST</span>}{post.generation_meta?.generation_source&&<span className={`generation-source-chip ${String(post.generation_meta.generation_source).startsWith('weekly_autopilot')?'auto':'manual'}`}>{String(post.generation_meta.generation_source).startsWith('weekly_autopilot')?'AUTO WEEK':post.generation_meta.generation_source==='opportunity_test'?'TEST':'MANUAL'}</span>}</div>
              <p>{post.caption}</p>
              <div className="queue-platforms"><span><Instagram size={13} /> {(post.platform_content?.instagram?.hashtags || post.hashtags || []).length} IG tags</span><span><Facebook size={13} /> {(post.platform_content?.facebook?.hashtags || []).length} FB tags</span><span>{post.discovery_score || 0}/100 discovery</span>{qualityScores[post.id] !== undefined && <span className="quality-inline"><ShieldCheck size={13} /> {qualityScores[post.id]}/100 quality</span>}</div>{metaJobsFor(post.id).length>0&&<div className="meta-job-strip">{metaJobsFor(post.id).map(job=><span key={job.id} className={`meta-job-chip ${job.status}`}><b>{job.platform==='instagram'?'IG':'FB'}</b> {job.status}{job.status==='queued'?<small>{formatTime(job.publish_at,restaurant.timezone)}</small>:null}{job.status==='failed'&&(metaJobNeedsOwnerReview(job)?<small>OWNER provera</small>:<button disabled={workingId==='job-'+job.id} onClick={()=>void retryMetaJob(job)}>Retry</button>)}{job.status==='queued'&&<button className="cancel" disabled={workingId==='job-'+job.id} onClick={()=>void cancelMetaJob(job)}>Otkaži</button>}</span>)}</div>}

              {editingId === post.id && <div className="schedule-editor">
                <div className="schedule-fields"><label>Datum <small>{restaurant.timezone}</small><input type="date" value={scheduleDraft.date} onChange={(e) => setScheduleDraft({ ...scheduleDraft, date: e.target.value })} /></label><label>Vreme<input type="time" step="300" value={scheduleDraft.time} onChange={(e) => setScheduleDraft({ ...scheduleDraft, time: e.target.value })} /></label></div>
                <div className="schedule-suggestion"><Sparkles size={14} /><span>Autopilot proverava format + radno vreme restorana.</span><button type="button" onClick={() => useAutopilotTime(post)}>Predloži termin</button></div>
                <div className="schedule-editor-actions"><button type="button" className="secondary" onClick={() => setEditingId('')}><X size={14} /> Otkaži</button><button type="button" className="secondary" onClick={() => setScheduleDraft(defaultDraft(post, restaurant))}><RotateCcw size={14} /> Reset</button><button type="button" className="primary" disabled={workingId === post.id} onClick={() => void saveSchedule(post)}><Save size={14} /> Sačuvaj termin</button></div>
              </div>}
            </div>
            <div className="queue-state"><span className={`status ${post.status}`}>{post.status}</span><button className="mini-schedule" onClick={() => openSchedule(post)}><CalendarClock size={14} /> Datum i vreme</button><button className="mini-quality" disabled={workingId === post.id} onClick={() => qualityCheck(post)}><ShieldCheck size={14} /> Quality check</button><div className="platform-copy-actions"><button type="button" onClick={()=>void copyPlatform(post,'instagram')}><Instagram size={13}/> IG copy</button><button type="button" onClick={()=>void copyPlatform(post,'facebook')}><Facebook size={13}/> FB copy</button></div>{post.status === 'approved' && <>{metaState?.connection?.status==='connected'?<><button className="mini-meta-now" disabled={workingId==='meta-'+post.id||!metaPlatforms(post).length} onClick={()=>void sendToMeta(post,true)}><Send size={14}/> Meta sada</button><button className="mini-meta-queue" disabled={workingId==='meta-'+post.id||!post.scheduled_for||!metaPlatforms(post).length} onClick={()=>void sendToMeta(post,false)}><CalendarClock size={14}/> Zakaži Meta</button></>:<button className="mini-meta-suite" onClick={()=>void openBusinessSuite(post)}><ExternalLink size={14}/> Meta Business Suite</button>}<button className="mini-publish" disabled={workingId === post.id} onClick={() => markPublished(post)}><CheckCircle2 size={14} /> Označi objavljeno</button></>}{post.status === 'published' && <span className="published-ok"><CheckCircle2 size={15} /> završeno</span>}</div>
          </div>)}
        </div>}
      </section>

      <div className="meta-roadmap"><div><ExternalLink size={18} /><div><strong>{metaState?.connection?.status==='connected'?'Direktan Meta publishing je aktivan':'Ručni workflow ostaje kao fallback'}</strong><span>{metaState?.connection?.status==='connected'?(metaState.insights_ready?'Odobrene objave idu direktno na Meta, a views, reach i interakcije se automatski vraćaju u Rezultate.':'Publishing radi, ali za automatske rezultate jednom obnovi Meta dozvole za Insights.'):'CSV, copy i Meta Business Suite ostaju dostupni dok poslovni nalog nije povezan.'}</span></div></div><span className="roadmap-badge">{metaState?.connection?.status==='connected'?'META CONNECTED':'FALLBACK READY'}</span></div>
    </>
  )
}

function localDateString(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||''
  return `${get('year')}-${get('month')}-${get('day')}`
}
function buildCalendarDays(restaurant:Restaurant,count:number){
  const today=localDateString(new Date(),restaurant.timezone)
  return Array.from({length:count},(_,i)=>{
    const key=addLocalDays(today,i)
    const d=new Date(key+'T12:00:00Z')
    const weekday=new Intl.DateTimeFormat('sr-RS',{weekday:'short',timeZone:'UTC'}).format(d)
    const label=new Intl.DateTimeFormat('sr-RS',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(d)
    const weekdayKey=weekdayKeys[d.getUTCDay()]
    const row=restaurant.opening_hours?.[weekdayKey]
    return{key,weekday,label,today:key===today,open:row?.enabled!==false}
  })
}
function preferredMinutes(post:Post){
  const learnedHour=post.generation_meta?.learning_signal?.schedule_hour
  if(learnedHour!==null&&learnedHour!==undefined&&Number.isFinite(Number(learnedHour)))return Math.max(7,Math.min(22,Math.round(Number(learnedHour))))*60+30
  if(post.post_type==='promotion')return 17*60+30
  if(post.post_type==='story')return 11*60+30
  const pillar=String(post.generation_meta?.pillar||'')
  if(pillar==='social_prompt')return 19*60+30
  return 18*60+30
}
const weekdayKeys=['sun','mon','tue','wed','thu','fri','sat']
function openingRow(restaurant:Restaurant,date:string){
  const noon=zonedInputToIso(date+'T12:00',restaurant.timezone)
  const weekday=new Date(noon).toLocaleDateString('en-US',{timeZone:restaurant.timezone,weekday:'short'}).toLowerCase().slice(0,3)
  const row=restaurant.opening_hours?.[weekday]
  return row||{enabled:true,open:'09:00',close:'23:00'}
}
function toMinutes(value:string){const[h,m]=value.split(':').map(Number);return (Number.isFinite(h)?h:0)*60+(Number.isFinite(m)?m:0)}
function hhmm(value:number){const minutes=Math.max(0,Math.min(23*60+59,Math.round(value)));return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')}
function addLocalDays(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function mondayDayOffset(date:string,timeZone:string){
  try{
    const iso=zonedInputToIso(date+'T12:00',timeZone)
    const label=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short'}).format(new Date(iso))
    const map:Record<string,number>={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6}
    return map[label]??0
  }catch{return 0}
}
function autopilotDraft(post:Post,date:string,restaurant:Restaurant):ScheduleDraft{
  let chosenDate=date
  const learnedDay=post.generation_meta?.learning_signal?.schedule_day
  if(learnedDay!==null&&learnedDay!==undefined&&Number.isFinite(Number(learnedDay))){
    const wanted=Math.max(0,Math.min(6,Math.round(Number(learnedDay))))
    for(let i=0;i<7;i++){const candidate=addLocalDays(date,i);if(mondayDayOffset(candidate,restaurant.timezone)===wanted){chosenDate=candidate;break}}
  }
  let row=openingRow(restaurant,chosenDate)
  for(let i=0;i<7&&!row.enabled;i++){chosenDate=addLocalDays(chosenDate,1);row=openingRow(restaurant,chosenDate)}
  const preferred=preferredMinutes(post)
  const open=toMinutes(row.open||'09:00')
  const close=toMinutes(row.close||'23:00')
  const earliest=Math.max(7*60,open-60)
  const latest=Math.max(earliest,close-60)
  return{date:chosenDate,time:hhmm(Math.min(latest,Math.max(earliest,preferred)))}
}
function timeZoneOffsetMinutes(timeZone: string, date: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset', hour: '2-digit' }).formatToParts(date)
    const label = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT'
    const match = label.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i)
    if (!match) return 0
    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3] || 0))
  } catch { return -date.getTimezoneOffset() }
}
function zonedParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(value))
  const get=(type:string)=>parts.find((part)=>part.type===type)?.value||''
  return {year:get('year'),month:get('month'),day:get('day'),hour:get('hour'),minute:get('minute')}
}
function zonedInputToIso(value: string, timeZone: string) {
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if(!match)throw new Error('Invalid date')
  const desired=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]))
  let offset=timeZoneOffsetMinutes(timeZone,new Date(desired)),utc=desired-offset*60000
  const corrected=timeZoneOffsetMinutes(timeZone,new Date(utc)); if(corrected!==offset)utc=desired-corrected*60000
  return new Date(utc).toISOString()
}
function defaultDraft(post: Post, restaurant: Restaurant): ScheduleDraft {
  if (post.scheduled_for) return dateParts(post.scheduled_for,restaurant.timezone)
  const tomorrow = new Date(Date.now()+86400000)
  const p=zonedParts(tomorrow.toISOString(),restaurant.timezone)
  return autopilotDraft(post,`${p.year}-${p.month}-${p.day}`,restaurant)
}
function dateParts(iso: string, timeZone: string): ScheduleDraft {
  const p=zonedParts(iso,timeZone)
  return { date:`${p.year}-${p.month}-${p.day}`, time:`${p.hour}:${p.minute}` }
}
function formatDate(value: string, timeZone?: string) { return new Date(value).toLocaleDateString('sr-RS', { day:'2-digit', month:'short', ...(timeZone?{timeZone}:{}) }) }
function formatDateLong(value: string, timeZone?: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday:'long', day:'numeric', month:'long', ...(timeZone?{timeZone}:{}) }) }
function formatWeekday(value: string, timeZone?: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday:'short', ...(timeZone?{timeZone}:{}) }) }
function formatTime(value: string, timeZone?: string) { return new Date(value).toLocaleTimeString('sr-RS', { hour:'2-digit', minute:'2-digit', ...(timeZone?{timeZone}:{}) }) }
function qualityLabel(key: string) {
  const labels: Record<string, string> = { caption: 'dužina teksta', local_signal: 'lokalni signal', focused_hashtags: 'hashtag fokus', clear_cta: 'CTA', photo_ready: 'fotografija', platform_versions: 'IG/FB verzije', visual_design: 'vizuelni dizajn' }
  return labels[key] || key
}
function csvCell(value: string) { return `"${String(value).replace(/"/g, '""')}"` }
function icsText(value: string) { return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;') }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'restaurant' }
function downloadBlob(name: string, blob: Blob) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1200) }
