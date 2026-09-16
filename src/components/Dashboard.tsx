import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Activity, ArrowUpRight, CalendarDays, CheckCircle2, ChefHat, Clock3, Copy, CopyPlus, Facebook, Hash, Instagram, MapPin, Pencil, RefreshCw, Save, Search, ShieldCheck, Sparkles, Trash2, TrendingUp, UtensilsCrossed, WandSparkles, X, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Entitlement, MenuItem, Post, Restaurant } from '../types'

export function Dashboard({ restaurant, menuItems, posts, entitlement, onChanged, setNotice, onNavigate }: {
  restaurant: Restaurant
  menuItems: MenuItem[]
  posts: Post[]
  entitlement?: Entitlement | null
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
  onNavigate?: (tab: 'menu' | 'publish' | 'settings' | 'billing') => void
}) {
  const [generating, setGenerating] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [bulkReviewing,setBulkReviewing]=useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [contentQuery,setContentQuery]=useState('')
  const [contentStatus,setContentStatus]=useState<'all'|Post['status']>('all')
  const [contentType,setContentType]=useState<'all'|Post['post_type']>('all')
  const [preflight,setPreflight]=useState<any>(null)
  const [preflightLoading,setPreflightLoading]=useState(false)
  const [activityRows,setActivityRows]=useState<any[]>([])
  const activeItems = useMemo(() => menuItems.filter((item) => item.is_active).sort((a, b) => (b.marketing_priority || 0) - (a.marketing_priority || 0)), [menuItems])
  const approvedCount = useMemo(() => posts.filter((post) => post.status === 'approved' || post.status === 'published').length, [posts])
  const averageDiscovery = useMemo(() => posts.length ? Math.round(posts.reduce((sum, post) => sum + (post.discovery_score || 0), 0) / posts.length) : 0, [posts])
  const photoCoverage = useMemo(() => activeItems.length ? Math.round((activeItems.filter((item) => item.image_url).length / activeItems.length) * 100) : 0, [activeItems])
  const priorityCount = useMemo(() => activeItems.filter((item) => (item.marketing_priority || 0) >= 2).length, [activeItems])
  const heroItem = useMemo(() => activeItems.find((item) => (item.marketing_priority || 0) >= 3) || null, [activeItems])
  const marketingFocus = useMemo(() => activeItems.filter((item) => (item.marketing_priority || 0) > 0).slice(0, 3), [activeItems])
  const autopilotHealth = useMemo(() => {
    const hoursConfigured = Boolean(restaurant.opening_hours && Object.keys(restaurant.opening_hours).length >= 7)
    const quotaOk = entitlement?.is_superadmin === true || entitlement?.generation_limit == null || Number(entitlement?.generated_this_month || 0) < Number(entitlement?.generation_limit || 0)
    const checks = [
      { key: 'auto', label: 'Auto week', ok: Boolean(restaurant.weekly_autopilot_enabled) },
      { key: 'quota', label: 'Generation quota', ok: quotaOk },
      { key: 'menu', label: '3+ jela', ok: activeItems.length >= 3 },
      { key: 'hero', label: 'HERO', ok: Boolean(heroItem) },
      { key: 'photos', label: '70% fotografija', ok: photoCoverage >= 70 },
      { key: 'hours', label: 'Radno vreme', ok: hoursConfigured },
    ]
    const done = checks.filter((check) => check.ok).length
    const score = Math.round((done / checks.length) * 100)
    const action = !quotaOk
      ? { label: 'Otvori paket', tab: 'billing' as const }
      : !restaurant.weekly_autopilot_enabled || !hoursConfigured
      ? { label: 'Sredi automatizaciju', tab: 'settings' as const }
      : activeItems.length < 3 || !heroItem || photoCoverage < 70
        ? { label: 'Sredi meni', tab: 'menu' as const }
        : null
    return { checks, score, action }
  }, [restaurant.weekly_autopilot_enabled, restaurant.opening_hours, activeItems.length, heroItem, photoCoverage, entitlement?.is_superadmin, entitlement?.generation_limit, entitlement?.generated_this_month])
  const orderedPosts = useMemo(() => [...posts].sort((a, b) => new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()), [posts])
  const reviewQueue = useMemo(() => orderedPosts.filter((post) => post.status === 'draft'), [orderedPosts])
  const filteredPosts=useMemo(()=>{
    const q=contentQuery.trim().toLocaleLowerCase('sr')
    return posts.filter(post=>{
      if(contentStatus!=='all'&&post.status!==contentStatus)return false
      if(contentType!=='all'&&post.post_type!==contentType)return false
      if(q&&!([post.title||'',post.caption||'',...(post.seo_keywords||[]),...(post.hashtags||[])].join(' ').toLocaleLowerCase('sr').includes(q)))return false
      return true
    })
  },[posts,contentQuery,contentStatus,contentType])
  const nextScheduled = useMemo(() => orderedPosts.find((post) => post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now() && post.status !== 'published') || orderedPosts.find((post) => post.scheduled_for && post.status !== 'published'), [orderedPosts])
  const heroImage = useMemo(() => {
    const itemPhoto = activeItems.find((item) => item.image_url)?.image_url
    const postPhoto = posts.map((post) => resolvePostImage(post, menuItems)).find(Boolean)
    return itemPhoto || postPhoto || null
  }, [activeItems, posts, menuItems])

  const weekQuality = useMemo(() => {
    const planned = orderedPosts.filter((post) => post.status !== 'rejected')
    if (!planned.length) return { score: 0, label: 'Čeka plan', issues: ['Generiši nedelju da Autopilot proveri kvalitet plana.'], uniqueDishes: 0, heroPosts: 0, scheduled: 0, formats: 0, duplicateCopy: 0, pastScheduled: 0 }
    const ids = planned.map((post) => post.menu_item_id).filter(Boolean) as string[]
    const uniqueDishes = new Set(ids).size
    const heroPosts = heroItem ? planned.filter((post) => post.menu_item_id === heroItem.id || Number(post.generation_meta?.learning_signal?.marketing_priority || post.generation_meta?.marketing_priority || 0) >= 3).length : 0
    const scheduled = planned.filter((post) => Boolean(post.scheduled_for)).length
    const pastScheduled = planned.filter((post) => post.status !== 'published' && post.scheduled_for && new Date(post.scheduled_for).getTime() < Date.now() - 15 * 60 * 1000).length
    const formats = new Set(planned.map((post) => post.post_type)).size
    let adjacentRepeats = 0
    for (let i = 1; i < planned.length; i += 1) {
      if (planned[i].menu_item_id && planned[i].menu_item_id === planned[i - 1].menu_item_id) adjacentRepeats += 1
    }
    const copyKeys = planned.map((post) => normalizeCopyKey(post.caption || post.title || '')).filter(Boolean)
    const duplicateCopy = copyKeys.length - new Set(copyKeys).size

    let score = 100
    const issues: string[] = []
    const expected = Math.max(1, restaurant.posting_frequency || planned.length)
    if (planned.length < expected) { score -= Math.min(24, (expected - planned.length) * 8); issues.push(`Plan ima ${planned.length}/${expected} ciljnih objava.`) }
    if (activeItems.length > 1 && uniqueDishes < Math.min(3, activeItems.length)) { score -= 16; issues.push('Premalo različitih jela u nedeljnom planu.') }
    if (adjacentRepeats > 0) { score -= Math.min(24, adjacentRepeats * 12); issues.push(`${adjacentRepeats} uzastopno ponavljanje istog jela.`) }
    if (duplicateCopy > 0) { score -= Math.min(20, duplicateCopy * 10); issues.push(`${duplicateCopy} objava ima previše sličan tekst.`) }
    if (heroItem && heroPosts === 0) { score -= 18; issues.push('HERO jelo nije zastupljeno u planu.') }
    if (heroItem && heroPosts > Math.max(2, Math.ceil(planned.length * 0.4))) { score -= 12; issues.push('HERO jelo se ponavlja previše često.') }
    if (scheduled < planned.length) { score -= Math.min(18, (planned.length - scheduled) * 6); issues.push(`${planned.length - scheduled} objava nema termin.`) }
    if (pastScheduled > 0) { score -= Math.min(24, pastScheduled * 8); issues.push(`${pastScheduled} neobjavljena ${pastScheduled===1?'objava ima':'objave imaju'} termin u prošlosti.`) }
    if (planned.length >= 3 && formats < 2) { score -= 10; issues.push('Nedelja nema dovoljno različitih formata.') }
    score = Math.max(0, Math.min(100, score))
    const label = score >= 90 ? 'Odličan plan' : score >= 75 ? 'Dobar plan' : score >= 55 ? 'Treba doradu' : 'Slab plan'
    return { score, label, issues, uniqueDishes, heroPosts, scheduled, formats, duplicateCopy, pastScheduled }
  }, [orderedPosts, heroItem, activeItems.length, restaurant.posting_frequency])

  const weekQualityAction = useMemo(() => {
    if (!orderedPosts.length || weekQuality.score >= 90) return null
    if (!heroItem || (activeItems.length > 1 && weekQuality.uniqueDishes < Math.min(3, activeItems.length))) return { label: 'Sredi meni', kind: 'menu' as const }
    if (weekQuality.scheduled < orderedPosts.length || weekQuality.pastScheduled > 0) return { label: 'Sredi termine', kind: 'publish' as const }
    return { label: 'Auto popravi plan', kind: 'regenerate' as const }
  }, [orderedPosts.length, weekQuality.score, weekQuality.uniqueDishes, weekQuality.scheduled, weekQuality.pastScheduled, heroItem, activeItems.length])


  async function loadPreflight(recordActivity=false){
    setPreflightLoading(true)
    const{data,error}=await supabase.functions.invoke('content-engine',{body:{action:'preflight',restaurantId:restaurant.id,recordActivity}})
    if(!error&&!data?.error)setPreflight(data)
    else if(recordActivity)setNotice(data?.error||error?.message||'Preflight provera nije uspela.')
    setPreflightLoading(false)
  }

  async function loadActivity(){
    const{data}=await supabase.from('autopilot_activity').select('id,event_type,title,summary,metadata,created_at').eq('restaurant_id',restaurant.id).order('created_at',{ascending:false}).limit(8)
    setActivityRows(data||[])
  }

  useEffect(()=>{void loadPreflight(false);void loadActivity()},[restaurant.id,menuItems.length,posts.length,entitlement?.generated_this_month])
  async function reviewWholeWeek() {
    if (!reviewQueue.length) { setNotice('Nema draft objava za proveru.'); return }
    setBulkReviewing(true)
    let approved = 0
    const flagged: string[] = []
    for (let index = 0; index < reviewQueue.length; index += 1) {
      const post = reviewQueue[index]
      setNotice(`Proveravam nedelju ${index + 1}/${reviewQueue.length} · ${post.title || 'objava'}…`)
      const { data, error } = await supabase.functions.invoke('content-engine', {
        body: { action: 'quality_check', restaurantId: restaurant.id, postId: post.id },
      })
      if (!error && !data?.error && Number(data?.score || 0) >= 70) {
        const { error: updateError } = await supabase.from('posts').update({ status: 'approved' }).eq('id', post.id).eq('restaurant_id', restaurant.id)
        if (!updateError) approved += 1
        else flagged.push(post.title || 'Objava')
      } else flagged.push(post.title || 'Objava')
    }
    await onChanged()
    await supabase.functions.invoke('content-engine',{body:{action:'log_activity',restaurantId:restaurant.id,eventType:'weekly_review_completed',metadata:{approved,flagged:flagged.length,total:reviewQueue.length}}})
    void loadActivity()
    void loadPreflight(false)
    setNotice(flagged.length
      ? `Review završen: ${approved} odobreno · ${flagged.length} ostavljeno za doradu (${flagged.slice(0,3).join(', ')}${flagged.length>3?'…':''}).`
      : `Review završen: svih ${approved} draftova je prošlo quality gate i odobreno je.`)
    setBulkReviewing(false)
  }

  async function generateWeek() {
    if (!activeItems.length) {
      setNotice('Prvo dodaj bar jedno aktivno jelo u meni.')
      return
    }
    setGenerating(true)
    setNotice('Autopilot pravi strukturu nedelje…')
    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: { action: 'week', restaurantId: restaurant.id, prioritySnapshot: activeItems.map((item) => ({ id: item.id, marketing_priority: item.marketing_priority || 0 })) },
    })
    if (error) {
      setNotice(error.message)
      setGenerating(false)
      return
    }
    if (data?.error) {
      setNotice(data.error)
      setGenerating(false)
      return
    }

    const generated = (data?.posts || []) as Post[]
    const performanceSamples=Number(data?.learning?.performance_samples||0)
    const heroGenerated=generated.filter((post)=>Number(post.generation_meta?.learning_signal?.marketing_priority||0)>=3).length
    let aiEnhanced = 0
    try {
      const { data: aiStatus } = await supabase.functions.invoke('creative-advisor', {
        body: { action: 'status', restaurantId: restaurant.id },
      })
      if (aiStatus?.ai_text_ready && generated.length) {
        for (let i = 0; i < generated.length; i += 1) {
          const post = generated[i]
          setNotice(`AI doteruje tekst ${i + 1}/${generated.length} · ${post.title || 'objava'}…`)
          const { data: aiData, error: aiError } = await supabase.functions.invoke('creative-advisor', {
            body: { action: 'post_copy', restaurantId: restaurant.id, postId: post.id },
          })
          if (!aiError && !aiData?.error) aiEnhanced += 1
        }
      }
    } catch {
      // Deterministički sadržaj ostaje validan fallback ako AI provider trenutno nije dostupan.
    }

    await onChanged()
    void loadActivity()
    void loadPreflight(false)
    const count = generated.length || restaurant.posting_frequency || 0
    setNotice(aiEnhanced
      ? `Nedelja je spremna: ${count} objava, AI je doradio ${aiEnhanced}/${count} tekstova${heroGenerated?` · HERO fokus u ${heroGenerated} ${heroGenerated===1?'objavi':'objave'}`:''}${performanceSamples?` · učenje iz ${performanceSamples} stvarnih rezultata`:''}. Dizajn, datum i vreme su sačuvani.`
      : `Autopilot je napravio ${count} dizajniranih predloga sa datumom i vremenom${heroGenerated?` · HERO fokus u ${heroGenerated} ${heroGenerated===1?'objavi':'objave'}`:''}${performanceSamples?` · korišćeno ${performanceSamples} stvarnih performance rezultata`:''}. Tekst koristi Smart fallback gde AI nije dostupan.`)
    setGenerating(false)
  }

  async function changeStatus(post: Post, status: Post['status']) {
    setWorkingId(post.id)
    if (status === 'approved') {
      const { data, error } = await supabase.functions.invoke('content-engine', {
        body: { action: 'quality_check', restaurantId: restaurant.id, postId: post.id },
      })
      if (error) {
        setNotice(error.message)
        setWorkingId('')
        return
      }
      if (data?.score < 70) {
        const missing = Object.entries(data?.checks || {}).filter(([, ok]) => !ok).map(([key]) => key.replaceAll('_', ' ')).join(', ')
        setNotice(`Objava nije spremna za odobrenje (${data.score}/100). Sredi: ${missing || 'kvalitet sadržaja'}.`)
        setWorkingId('')
        return
      }
    }
    const { error } = await supabase.from('posts').update({ status }).eq('id', post.id)
    if (error) setNotice(error.message)
    else {
      if (status === 'approved') setNotice('Objava je prošla proveru kvaliteta i odobrena je.')
      await onChanged()
    }
    setWorkingId('')
  }

  async function duplicatePost(post: Post) {
    setWorkingId(post.id)
    const scheduled = post.scheduled_for ? new Date(new Date(post.scheduled_for).getTime() + 24 * 60 * 60 * 1000).toISOString() : null
    const { id: _id, ...rest } = post
    const payload = {
      restaurant_id: restaurant.id,
      content_plan_id: null,
      menu_item_id: post.menu_item_id,
      promotion_id: post.promotion_id,
      post_type: post.post_type,
      scheduled_for: scheduled,
      title: post.title ? post.title + ' · kopija' : 'Kopija objave',
      caption: post.caption,
      cta: post.cta,
      hashtags: post.hashtags || [],
      visual_brief: post.visual_brief,
      status: 'draft' as const,
      generation_meta: { ...(post.generation_meta || {}), duplicated_from: post.id, duplicated_at: new Date().toISOString() },
      platform_content: post.platform_content || {},
      discovery_score: post.discovery_score || 0,
      seo_keywords: post.seo_keywords || [],
    }
    void rest
    const { error } = await supabase.from('posts').insert(payload)
    if (error) setNotice(error.message)
    else {
      setNotice('Objava je duplirana kao draft. Termin je pomeren za jedan dan.')
      await onChanged()
    }
    setWorkingId('')
  }

  async function deletePost(post: Post) {
    if (post.status === 'approved' || post.status === 'published') {
      setNotice('Odobrenu ili objavljenu objavu prvo vrati u draft ako želiš da je obrišeš.')
      return
    }
    if (!window.confirm(`Obriši „${post.title || 'ovu objavu'}“?`)) return
    setWorkingId(post.id)
    const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('restaurant_id', restaurant.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Draft objava je obrisana.')
      await onChanged()
    }
    setWorkingId('')
  }

  async function optimizeDiscovery(post: Post) {
    setWorkingId(post.id)
    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: { action: 'optimize_discovery', restaurantId: restaurant.id, postId: post.id },
    })
    if (error) setNotice(error.message)
    else if (data?.error) setNotice(data.error)
    else { setNotice('Discovery je ponovo optimizovan.'); await onChanged() }
    setWorkingId('')
  }

  async function aiCopy(post: Post) {
    setWorkingId(post.id)
    setNotice('AI piše novu Instagram/Facebook verziju…')
    const ai = await supabase.functions.invoke('creative-advisor', { body: { action: 'post_copy', restaurantId: restaurant.id, postId: post.id } })
    if (!ai.error && !ai.data?.error) {
      setNotice('AI je napravio novi tekst, CTA, platformske verzije i search termine. Vizual i termin ostaju sačuvani.')
      await onChanged()
      setWorkingId('')
      return
    }
    const fallback = await supabase.functions.invoke('content-engine', { body: { action: 'regenerate', restaurantId: restaurant.id, postId: post.id } })
    if (fallback.error) setNotice(fallback.error.message)
    else if (fallback.data?.error) setNotice(fallback.data.error)
    else { setNotice('AI provider trenutno nije dostupan; Smart fallback je napravio novu verziju teksta.'); await onChanged() }
    setWorkingId('')
  }

  return (
    <>
      <section className={`wow-hero ${heroImage ? 'has-image' : ''}`} style={heroImage ? { backgroundImage: `linear-gradient(90deg, rgba(7,12,9,.96) 0%, rgba(7,12,9,.76) 45%, rgba(7,12,9,.16) 100%), url(${heroImage})` } : undefined}>
        <div className="wow-hero-copy">
          <div className="hero-kicker"><span className="live-dot" /> AUTOPILOT ACTIVE <b className={restaurant.weekly_autopilot_enabled?'auto-week-on':'auto-week-off'}>{restaurant.weekly_autopilot_enabled?'AUTO WEEK ON':'MANUAL WEEK'}</b></div>
          <span className="wow-brand-label">{restaurant.name.toUpperCase()}</span>
          <h1>{restaurant.description || 'Sadržaj koji izgleda kao tvoj restoran.'}</h1>
          <p>{restaurant.cuisine_type ? `${restaurant.cuisine_type} · ` : ''}{restaurant.neighborhood || restaurant.city || 'Tvoj grad'} · planirano, brendirano i spremno za objavu.</p>
          <div className="wow-hero-actions">
            <button className="wow-primary" onClick={generateWeek} disabled={generating}><Sparkles size={18} /> {generating ? 'AI Autopilot radi…' : 'Kreiraj AI nedelju'}</button>
            <div className="wow-hero-meta"><span><MapPin size={14} /> {restaurant.neighborhood || restaurant.city || 'lokalni discovery'}</span><span><Hash size={14} /> Smart Discovery</span><span><Zap size={14}/> {restaurant.weekly_autopilot_enabled?'Nova nedelja se priprema automatski':'Automatska nedelja nije uključena'}</span></div>
          </div>
        </div>
        <div className="wow-score-card">
          <div><TrendingUp size={19} /><span>{nextScheduled ? 'Sledeća objava' : 'Discovery score'}</span></div>
          <strong>{nextScheduled?.scheduled_for ? formatTime(nextScheduled.scheduled_for, restaurant.timezone) : (averageDiscovery || '—')}{!nextScheduled && averageDiscovery ? <small>/100</small> : null}</strong>
          <p>{nextScheduled?.scheduled_for ? `${formatWeekday(nextScheduled.scheduled_for, restaurant.timezone)} · ${nextScheduled.title || 'Objava'}` : posts.length ? 'prosek aktivnog sadržaja' : 'generiši prvu nedelju'}</p>
        </div>
      </section>

      <section className="wow-kpi-grid">
        <Kpi icon={<UtensilsCrossed size={18} />} label="Aktivna jela" value={String(activeItems.length)} detail={priorityCount ? `${priorityCount} prioritetna · ${photoCoverage}% sa fotografijom` : `${photoCoverage}% sa fotografijom`} />
        <Kpi icon={<CalendarDays size={18} />} label="Sadržaj" value={String(posts.length)} detail="feed · story · promo" />
        <Kpi icon={<Clock3 size={18} />} label="Sledeći termin" value={nextScheduled?.scheduled_for ? formatTime(nextScheduled.scheduled_for, restaurant.timezone) : '—'} detail={nextScheduled?.scheduled_for ? formatDateShort(nextScheduled.scheduled_for, restaurant.timezone) : 'čeka generaciju'} />
        <Kpi icon={<CheckCircle2 size={18} />} label="Spremno" value={String(approvedCount)} detail={posts.length ? `${Math.round((approvedCount / posts.length) * 100)}% od plana` : 'čeka generaciju'} />
      </section>

      <section className="marketing-focus-panel panel">
        <div className="marketing-focus-copy">
          <div className="marketing-focus-kicker"><p className="eyebrow">MARKETING FOKUS</p><span className="priority-engine-badge"><Zap size={12}/> PRIORITY ENGINE ACTIVE</span></div>
          <h2>{heroItem ? `HERO: ${heroItem.name}` : 'Izaberi HERO jelo'}</h2>
          <p>{heroItem ? 'Ovo je glavno jelo koje nosi najjače kampanje i premium vizuale. Priority Engine ga gura češće, ali ograničava ponavljanje da feed ne postane monoton.' : 'Označi jedno aktivno jelo kao HERO u Meniju. Autopilot će ga automatski uključivati u glavne kampanje i nedeljni plan bez preteranog ponavljanja.'}</p>
        </div>
        <div className="marketing-focus-items">
          {marketingFocus.length ? marketingFocus.map((item) => (
            <div className={`marketing-focus-item priority-${item.marketing_priority || 0}`} key={item.id}>
              <span>{item.marketing_priority === 3 ? 'HERO' : item.marketing_priority === 2 ? 'VISOK' : 'PRIORITET'}</span>
              <strong>{item.name}</strong>
              <small>{item.price ? `${item.price} ${item.currency || 'RSD'}` : item.category || 'Aktivno jelo'}</small>
            </div>
          )) : <div className="marketing-focus-empty"><Sparkles size={18} /><span>Još nema marketinški prioritetnih jela.</span></div>}
        </div>
      </section>

      <section className={'autopilot-preflight panel '+(preflight?.status||'loading')}>
        <div className="preflight-head">
          <div className="preflight-icon"><ShieldCheck size={20}/></div>
          <div><p className="eyebrow">AUTO WEEK PREFLIGHT</p><h2>{preflightLoading&&!preflight?'Proveravam…':preflight?.existing?'Plan već postoji':preflight?.ready?'Spreman za generisanje':'Ima blokera'}</h2><span>{preflight?.week_start?('Ciljna nedelja: '+formatWeekStart(preflight.week_start)+(preflight.next_week?' · sledeća nedelja':'')):'Server proverava paket, meni, radno vreme, kvotu i postojeći plan.'}</span></div>
          <button className="secondary preflight-refresh" onClick={()=>void loadPreflight(true)} disabled={preflightLoading}><RefreshCw size={13} className={preflightLoading?'spin':''}/>{preflightLoading?'Proveravam':'Proveri sada'}</button>
        </div>
        {preflight&&<div className="preflight-checks">{(preflight.checks||[]).map((check:any)=><span key={check.key} className={check.ok?'ok':check.severity==='blocker'?'blocker':'warning'}>{check.ok?<CheckCircle2 size={11}/>:<X size={11}/>} {check.label}{check.key==='photos'&&typeof check.value==='number'?(' '+check.value+'%'):''}</span>)}</div>}
        {preflight?.existing&&<div className="preflight-existing"><CalendarDays size={14}/><span>Postojeći plan: <b>{preflight.plan?.posts||0} objava</b> · {preflight.plan?.locked_posts||0} zaključano · {preflight.plan?.replaceable_posts||0} draft/rejected</span></div>}
        {!preflight?.existing&&preflight?.blockers?.length>0&&<div className="preflight-blockers">{preflight.blockers.map((item:any)=><span key={item.key}>{item.label}</span>)}</div>}
      </section>
      <section className="autopilot-health panel">
        <div className="autopilot-health-score"><span>{autopilotHealth.score}<small>%</small></span><div><p className="eyebrow">AUTOPILOT HEALTH</p><h2>{autopilotHealth.score===100?'Spreman za automatizaciju':autopilotHealth.score>=60?'Skoro spreman':'Treba podešavanje'}</h2><p>{autopilotHealth.score===100?'Svi ključni uslovi za automatsku nedelju su spremni.':'Dovrši crvene stavke da automatski plan radi bez ručnih intervencija.'}</p></div></div>
        <div className="autopilot-health-checks">{autopilotHealth.checks.map(check=><span key={check.key} className={check.ok?'ok':'missing'}>{check.ok?<CheckCircle2 size={12}/>:<X size={12}/>} {check.label}</span>)}</div>
        {autopilotHealth.action&&<button className="secondary autopilot-health-action" onClick={()=>onNavigate?.(autopilotHealth.action!.tab)}>{autopilotHealth.action.label}<ArrowUpRight size={14}/></button>}
      </section>

      {reviewQueue.length>0&&<section className="review-queue-bar panel">
        <div><span><CheckCircle2 size={16}/> REVIEW QUEUE</span><strong>{reviewQueue.length} {reviewQueue.length===1?'draft čeka':'draftova čeka'} proveru</strong><small>Quality gate proverava copy, CTA, discovery, platform verzije, fotografiju i vizuelni sistem. Prolaz ≥70/100 može biti odobren.</small></div>
        <button className="primary" onClick={()=>void reviewWholeWeek()} disabled={bulkReviewing}>{bulkReviewing?<><Sparkles size={15}/> Proveravam…</>:<><CheckCircle2 size={15}/> Proveri + odobri sve</>}</button>
      </section>}

      {activityRows.length>0&&<section className="autopilot-activity panel">
        <div className="activity-head"><div><p className="eyebrow">AUTOPILOT ACTIVITY</p><h2>Šta je sistem uradio</h2></div><Activity size={19}/></div>
        <div className="activity-list">{activityRows.map((row:any)=><article key={row.id}><span className="activity-dot"/><div><strong>{row.title}</strong><p>{row.summary||activityFallback(row.event_type)}</p><small>{relativeActivityTime(row.created_at)}</small></div></article>)}</div>
      </section>}
      <section className="week-quality-panel panel">
        <div className="week-quality-score">
          <span className="week-quality-ring" style={{ '--quality': weekQuality.score } as CSSProperties}><strong>{weekQuality.score}</strong><small>/100</small></span>
          <div><p className="eyebrow">WEEK QUALITY</p><h2>{weekQuality.label}</h2><span>{weekQuality.issues[0] || 'Plan je izbalansiran i spreman za dalju obradu.'}</span>{weekQualityAction && <button className="week-quality-fix" onClick={() => weekQualityAction.kind === 'regenerate' ? void generateWeek() : onNavigate?.(weekQualityAction.kind)} disabled={generating}><Sparkles size={13}/>{generating&&weekQualityAction.kind==='regenerate'?'Popravljam plan…':weekQualityAction.label}</button>}</div>
        </div>
        <div className="week-quality-metrics">
          <div><strong>{weekQuality.uniqueDishes}</strong><span>različita jela</span></div>
          <div><strong>{weekQuality.heroPosts}</strong><span>HERO objave</span></div>
          <div><strong>{weekQuality.scheduled}/{orderedPosts.length}</strong><span>sa terminom</span></div>
          <div><strong>{weekQuality.formats}</strong><span>formata</span></div>
        </div>
        {weekQuality.issues.length > 1 && <div className="week-quality-issues">{weekQuality.issues.slice(1, 4).map((issue) => <span key={issue}><Zap size={12}/>{issue}</span>)}</div>}
      </section>

      <section className="wow-dashboard-grid">
        <div className="wow-week panel">
          <div className="wow-panel-head"><div><p className="eyebrow">NEDELJNI PLAN</p><h2>Sledeće objave</h2></div><span>{orderedPosts.length} stavki</span></div>
          {orderedPosts.length ? (
            <div className="wow-week-strip">
              {orderedPosts.slice(0, 6).map((post) => {
                const image = resolvePostImage(post, menuItems)
                return <div className="wow-day" key={post.id}>
                  <div className={`wow-day-image ${image ? 'has-photo' : ''}`} style={image ? { backgroundImage: `url(${image})` } : { background: `linear-gradient(145deg, ${restaurant.primary_color || '#17211b'}, #314137)` }}>
                    <span>{post.post_type === 'story' ? 'STORY' : post.post_type === 'promotion' ? 'PROMO' : 'FEED'}</span>
                    {post.status === 'approved' || post.status === 'published' ? <i><CheckCircle2 size={14} /></i> : null}
                  </div>
                  <strong>{post.scheduled_for ? formatDateShort(post.scheduled_for, restaurant.timezone) : 'Bez datuma'}</strong>
                  {post.scheduled_for && <span className="demo-time-pill"><Clock3 size={11} /> {formatTime(post.scheduled_for, restaurant.timezone)}</span>}
                  <p>{post.title || 'Nova objava'}</p>
                </div>
              })}
            </div>
          ) : <div className="wow-week-empty"><Sparkles size={24} /><div><strong>Plan je prazan</strong><span>Jedan klik pravi celu nedelju sadržaja iz tvog menija.</span></div><button onClick={generateWeek}>Pokreni Autopilot <ArrowUpRight size={15} /></button></div>}
        </div>

        <aside className="wow-insight panel">
          <div className="wow-insight-icon"><WandSparkles size={20} /></div>
          <p className="eyebrow">CONTENT HEALTH</p>
          <h2>{photoCoverage >= 70 ? 'Vizuelno si spreman.' : 'Fotografije su sledeći veliki dobitak.'}</h2>
          <p>{photoCoverage >= 70 ? 'Većina aktivnih jela ima realne fotografije, što daje mnogo jače feed i story vizuale.' : `Trenutno ${photoCoverage}% aktivnih jela ima fotografiju. Dodaj realne ili AI food fotografije da Visual Studio radi punom snagom.`}</p>
          <div className="wow-health-bar"><i style={{ width: `${Math.max(6, photoCoverage)}%` }} /></div>
          <small>{photoCoverage}% photo coverage</small>
        </aside>
      </section>

      <section className="discovery-ribbon discovery-ribbon-wow">
        <div className="discovery-ribbon-icon"><Zap size={20} /></div>
        <div><strong>AI Copy + Smart Discovery</strong><span>AI tekst kada je provider aktivan; siguran fallback uvek ostaje. Brend + grad/kraj + konkretno jelo + niša.</span></div>
        <div className="platform-mini"><span><Instagram size={15} /> IG optimized</span><span><Facebook size={15} /> FB clean</span><span><Search size={15} /> Search ready</span></div>
      </section>

      <section className="content-section wow-content-section">
        <div className="section-title">
          <div><p className="eyebrow">CONTENT LIBRARY</p><h2>Sadržaj ove nedelje</h2></div>
          <span className="engine-badge"><Sparkles size={14} /> AI Copy + Design + Schedule + Discovery</span>
        </div>
        {posts.length>0&&<div className="content-filterbar"><label><Search size={15}/><input value={contentQuery} onChange={e=>setContentQuery(e.target.value)} placeholder="Pretraži naslov, tekst, hashtag…"/></label><select value={contentStatus} onChange={e=>setContentStatus(e.target.value as typeof contentStatus)}><option value="all">Svi statusi</option><option value="draft">Draft</option><option value="approved">Odobreno</option><option value="published">Objavljeno</option><option value="rejected">Odbijeno</option></select><select value={contentType} onChange={e=>setContentType(e.target.value as typeof contentType)}><option value="all">Svi formati</option><option value="feed">Feed</option><option value="story">Story</option><option value="promotion">Promo</option></select><span>{filteredPosts.length}/{posts.length}</span></div>}
        {posts.length === 0 ? (
          <div className="empty-state wow-empty"><Sparkles size={30} /><h3>Još nema sadržaja</h3><p>Dodaj kvalitetne fotografije i jela u meni, zatim pokreni nedelju.</p><button className="wow-primary" onClick={generateWeek}><Sparkles size={17} /> Generiši sada</button></div>
        ) : filteredPosts.length===0 ? (
          <div className="empty-state wow-empty"><Search size={28}/><h3>Nema rezultata za ovaj filter.</h3><p>Promeni status, format ili pojam za pretragu.</p><button className="secondary" onClick={()=>{setContentQuery('');setContentStatus('all');setContentType('all')}}>Očisti filtere</button></div>
        ) : (
          <div className="post-grid post-grid-pro wow-post-grid">
            {filteredPosts.map((post) => <PostCard key={post.id} post={post} restaurant={restaurant} menuItems={menuItems} working={workingId === post.id} onEdit={() => setEditing(post)} onAiCopy={() => aiCopy(post)} onOptimize={() => optimizeDiscovery(post)} onDuplicate={() => duplicatePost(post)} onDelete={() => deletePost(post)} onStatus={(status) => changeStatus(post, status)} setNotice={setNotice} />)}
          </div>
        )}
      </section>

      {editing && <PostEditor post={editing} timezone={restaurant.timezone} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged() }} setNotice={setNotice} />}
    </>
  )
}

function Kpi({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="wow-kpi"><div className="wow-kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>
}

function resolvePostImage(post: Post, menuItems: MenuItem[]) {
  const visualImage = post.generation_meta?.visual_design?.image_url
  if (typeof visualImage === 'string' && visualImage) return visualImage
  const meta = typeof post.generation_meta?.image_url === 'string' ? post.generation_meta.image_url : null
  if (meta) return meta
  return menuItems.find((item) => item.id === post.menu_item_id)?.image_url || null
}

function PostCard({ post, restaurant, menuItems, working, onEdit, onAiCopy, onOptimize, onDuplicate, onDelete, onStatus, setNotice }: {
  post: Post
  restaurant: Restaurant
  menuItems: MenuItem[]
  working: boolean
  onEdit: () => void
  onAiCopy: () => void
  onOptimize: () => void
  onDuplicate: () => void
  onDelete: () => void
  onStatus: (status: Post['status']) => void
  setNotice: (value: string) => void
}) {
  const instagramTags = post.platform_content?.instagram?.hashtags || post.hashtags || []
  const facebookTags = post.platform_content?.facebook?.hashtags || []
  const imageUrl = resolvePostImage(post, menuItems)
  const item = menuItems.find((entry) => entry.id === post.menu_item_id)
  const design = post.generation_meta?.visual_design
  const template = design?.template || (post.post_type === 'promotion' ? 'bold' : 'editorial')
  const visualHeadline = design?.headline || post.title || 'Nova objava'
  const visualCta = design?.cta || post.cta || 'Svrati danas'
  const price = item?.price ? `${item.price} ${item.currency || 'RSD'}` : ''
  const photoPosition = design?.photo_position === 'left' ? 'left center' : design?.photo_position === 'right' ? 'right center' : 'center center'
  const learning = post.generation_meta?.learning_signal
  const generationSource = String(post.generation_meta?.generation_source || '')
  const selectionSignals = [
    Number(learning?.marketing_priority || 0) >= 3 ? 'HERO' : Number(learning?.marketing_priority || 0) >= 2 ? 'PRIORITET' : '',
    Number(learning?.item_score || 0) > 0 ? 'PERFORMANCE' : '',
    Number(learning?.approved_trend_boost || 0) > 0 ? `TREND +${Math.round(Number(learning?.approved_trend_boost || 0))}` : '',
    Number(learning?.coverage_bonus || 0) > 0 ? 'COVERAGE' : '',
    Number(learning?.exploration_bonus || 0) > 0 ? 'EXPLORATION' : '',
    Number(learning?.performance_samples_item || 0) > 0 ? `CONF ${Number(learning?.performance_confidence || 0)}%` : '',
  ].filter(Boolean).slice(0, 4)

  async function copyInstagram() {
    const caption = post.platform_content?.instagram?.caption || post.caption || ''
    const text = `${caption}\n\n${instagramTags.join(' ')}`.trim()
    try { await navigator.clipboard.writeText(text); setNotice('Instagram tekst i hashtagovi su kopirani.') }
    catch { setNotice('Browser nije dozvolio kopiranje. Otvori „Izmeni“ i kopiraj ručno.') }
  }

  return (
    <article className="post-card post-card-pro wow-post-card">
      <div className={`post-preview post-preview-pro wow-post-preview card-template-${template} ${imageUrl ? 'has-photo' : ''}`} style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundPosition: photoPosition } : { background: `radial-gradient(circle at 80% 20%, ${restaurant.secondary_color || '#b9df72'}33, transparent 32%), linear-gradient(145deg, ${restaurant.primary_color || '#17211b'}, #27352b)` }}>
        <div className="wow-preview-shade" />
        <div className="preview-top"><span className="format-badge">{post.post_type === 'story' ? 'STORY 9:16' : post.post_type === 'promotion' ? 'PROMO 4:5' : 'FEED 4:5'}</span><span className="score-pill">{post.discovery_score || 0}<small>/100</small></span></div>
        <div className="wow-card-art-copy">{price && <span className="wow-card-price">{price}</span>}<h3>{visualHeadline}</h3><span className="wow-card-cta">{visualCta} →</span></div>
        <div className="preview-brand">{restaurant.logo_url ? <img className="wow-card-logo" src={restaurant.logo_url} alt="" /> : <div className="preview-logo"><ChefHat size={20} /></div>}<div><strong>{restaurant.name}</strong><small>{restaurant.neighborhood || restaurant.city || restaurant.cuisine_type}</small></div></div>
      </div>
      <div className="post-body post-body-pro">
        <div className="post-meta"><span>{post.scheduled_for ? formatDateLong(post.scheduled_for, restaurant.timezone) : 'Bez termina'}{post.scheduled_for && <> · <b className="post-time-strong"><Clock3 size={11} /> {formatTime(post.scheduled_for, restaurant.timezone)}</b></>}</span><div className="post-meta-badges">{generationSource&&<span className={`generation-source-chip ${generationSource==='weekly_autopilot'?'auto':'manual'}`}>{generationSource.startsWith('weekly_autopilot')?'AUTO WEEK':generationSource==='opportunity_test'?'TEST':'MANUAL'}</span>}<span className={`status ${post.status}`}>{post.status}</span></div></div>
        <div className="post-title-line"><h3>{post.title}</h3><span className="visual-template-chip">{template}</span></div>
        {selectionSignals.length > 0 && <div className="ai-selection-signals"><span>AI IZBOR</span>{selectionSignals.map((signal)=><b key={signal}>{signal}</b>)}</div>}
        <p className="caption-preview">{post.caption}</p>
        <div className="platform-discovery"><div className="platform-row"><div className="platform-label ig"><Instagram size={14} /> Instagram</div><div className="tag-cloud">{instagramTags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="platform-row"><div className="platform-label fb"><Facebook size={14} /> Facebook</div><div className="tag-cloud fb-tags">{facebookTags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div></div>{post.seo_keywords?.length > 0 && <div className="keyword-line"><Search size={13} /><span>{post.seo_keywords.slice(0, 4).join(' · ')}</span></div>}</div>
        <div className="post-actions post-actions-pro"><button className="icon-button" title="Kopiraj Instagram objavu" onClick={copyInstagram}><Copy size={15} /></button><button className="icon-button" title="Izmeni objavu i termin" onClick={onEdit}><Pencil size={15} /></button><button className="icon-button" title="Dupliraj kao draft" disabled={working} onClick={onDuplicate}><CopyPlus size={15}/></button><button className="icon-button ai-copy-button" title="AI napiši novu verziju teksta" disabled={working} onClick={onAiCopy}><WandSparkles size={16} /></button><button className="icon-button discovery-button" title="Optimizuj discovery" disabled={working} onClick={onOptimize}><Hash size={15} /></button>{post.status !== 'approved' && post.status !== 'published'&&<button className="icon-button danger-icon" title="Obriši draft" disabled={working} onClick={onDelete}><Trash2 size={15}/></button>}{post.status !== 'approved' && post.status !== 'published'? <button className="secondary action-grow" disabled={working} onClick={() => onStatus('approved')}><CheckCircle2 size={16} /> Proveri + odobri</button>: <button className="approved-button action-grow" onClick={() => onStatus('draft')}><CheckCircle2 size={16} /> Spremno</button>}</div>
      </div>
    </article>
  )
}

function PostEditor({ post, timezone, onClose, onSaved, setNotice }: { post: Post; timezone: string; onClose: () => void; onSaved: () => Promise<void>; setNotice: (value: string) => void }) {
  const [form, setForm] = useState({ title: post.title || '', caption: post.caption || '', cta: post.cta || '', instagram_caption: post.platform_content?.instagram?.caption || post.caption || '', instagram_hashtags: (post.platform_content?.instagram?.hashtags || post.hashtags || []).join(' '), facebook_caption: post.platform_content?.facebook?.caption || post.caption || '', facebook_hashtags: (post.platform_content?.facebook?.hashtags || []).join(' '), visual_brief: post.visual_brief || '', scheduled_for: post.scheduled_for ? toZonedDateTimeValue(post.scheduled_for, timezone) : '' })
  const [working, setWorking] = useState(false)
  function tags(value: string) { return value.split(/\s+/).map((v) => v.trim()).filter(Boolean).map((v) => v.startsWith('#') ? v : `#${v}`) }
  async function save(event: FormEvent) {
    event.preventDefault(); setWorking(true)
    const instagramHashtags = tags(form.instagram_hashtags).slice(0, 12), facebookHashtags = tags(form.facebook_hashtags).slice(0, 3)
    const platformContent = { ...(post.platform_content || {}), instagram: { ...(post.platform_content?.instagram || {}), caption: form.instagram_caption, hashtags: instagramHashtags }, facebook: { ...(post.platform_content?.facebook || {}), caption: form.facebook_caption, hashtags: facebookHashtags } }
    const oldVisual = post.generation_meta?.visual_design
    const generationMeta = oldVisual ? { ...post.generation_meta, visual_design: { ...oldVisual, headline: form.title || oldVisual.headline, subline: shorten(form.caption, oldVisual.format === 'story' ? 96 : 118), cta: form.cta || oldVisual.cta } } : post.generation_meta
    const { error } = await supabase.from('posts').update({ title: form.title || null, caption: form.caption || null, cta: form.cta || null, hashtags: instagramHashtags, platform_content: platformContent, visual_brief: form.visual_brief || null, scheduled_for: form.scheduled_for ? zonedInputToIso(form.scheduled_for, timezone) : null, generation_meta: generationMeta, status: 'draft' }).eq('id', post.id)
    if (error) setNotice(error.message); else { setNotice('Objava, termin, platformske verzije i vizuelni tekst su sinhronizovani.'); await onSaved() }
    setWorking(false)
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card modal-card-wide" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">UREDI OBJAVU</p><h2>{post.post_type.toUpperCase()}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="editor-base-grid"><label>Naslov<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>CTA<input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} /></label></div><label>Glavni tekst<textarea rows={4} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></label><div className="platform-editor-grid"><section className="platform-editor-card instagram-card"><div className="platform-editor-head"><Instagram size={17} /><strong>Instagram</strong><span>discovery + search</span></div><label>Caption<textarea rows={5} value={form.instagram_caption} onChange={(e) => setForm({ ...form, instagram_caption: e.target.value })} /></label><label>Hashtagovi<input value={form.instagram_hashtags} onChange={(e) => setForm({ ...form, instagram_hashtags: e.target.value })} /></label></section><section className="platform-editor-card facebook-card"><div className="platform-editor-head"><Facebook size={17} /><strong>Facebook</strong><span>čisto i lokalno</span></div><label>Tekst<textarea rows={5} value={form.facebook_caption} onChange={(e) => setForm({ ...form, facebook_caption: e.target.value })} /></label><label>Hashtagovi · max 3<input value={form.facebook_hashtags} onChange={(e) => setForm({ ...form, facebook_hashtags: e.target.value })} /></label></section></div><div className="grid-form compact-grid"><label>Datum i vreme objave <small>({timezone})</small><input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></label><label>Discovery score<input value={`${post.discovery_score || 0}/100`} disabled /></label></div><label>Brief za vizual<textarea rows={3} value={form.visual_brief} onChange={(e) => setForm({ ...form, visual_brief: e.target.value })} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Otkaži</button><button className="primary" disabled={working}><Save size={17} /> {working ? 'Čuvam…' : 'Sačuvaj sve verzije'}</button></div></form></div>
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
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return { year:get('year'), month:get('month'), day:get('day'), hour:get('hour'), minute:get('minute') }
}
function toZonedDateTimeValue(value: string, timeZone: string) { const p=zonedParts(value,timeZone); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` }
function zonedInputToIso(value: string, timeZone: string) {
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if(!match)return new Date(value).toISOString()
  const desired=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]))
  let offset=timeZoneOffsetMinutes(timeZone,new Date(desired)),utc=desired-offset*60000
  const corrected=timeZoneOffsetMinutes(timeZone,new Date(utc)); if(corrected!==offset)utc=desired-corrected*60000
  return new Date(utc).toISOString()
}
function formatTime(value: string, timeZone?: string) { return new Date(value).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', ...(timeZone?{timeZone}:{}) }) }
function formatWeekday(value: string, timeZone?: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'short', ...(timeZone?{timeZone}:{}) }) }
function formatDateShort(value: string, timeZone?: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric', ...(timeZone?{timeZone}:{}) }) }
function formatDateLong(value: string, timeZone?: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'short', ...(timeZone?{timeZone}:{}) }) }
function shorten(value: string, max: number) { const clean = value.replace(/\s+/g, ' ').trim(); return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…` }

function normalizeCopyKey(value:string){
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,90)
}

function formatWeekStart(value:string){
  try{return new Intl.DateTimeFormat('sr-RS',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value+'T12:00:00Z'))}catch{return value}
}
function relativeActivityTime(value:string){
  const diff=Math.max(0,Date.now()-new Date(value).getTime())
  const minutes=Math.floor(diff/60000)
  if(minutes<1)return 'upravo sada'
  if(minutes<60)return 'pre '+minutes+' min'
  const hours=Math.floor(minutes/60)
  if(hours<24)return 'pre '+hours+' h'
  const days=Math.floor(hours/24)
  return days===1?'pre 1 dan':'pre '+days+' dana'
}
function activityFallback(type:string){
  if(type==='weekly_plan_created')return 'Nedelja je kreirana.'
  if(type==='preflight_checked')return 'Preflight provera je završena.'
  if(type==='weekly_review_completed')return 'Quality review nedelje je završen.'
  if(type==='performance_imported')return 'Performance podaci su osveženi.'
  if(type==='menu_imported')return 'Meni je osvežen iz CSV-a.'
  if(type==='ai_images_generated')return 'AI fotografije su generisane.'
  return 'Autopilot aktivnost.'
}