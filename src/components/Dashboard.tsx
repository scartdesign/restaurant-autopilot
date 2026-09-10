import { FormEvent, useMemo, useState } from 'react'
import { ArrowUpRight, CalendarDays, CheckCircle2, ChefHat, Clock3, Copy, Facebook, Hash, Instagram, MapPin, Pencil, Save, Search, Sparkles, TrendingUp, UtensilsCrossed, WandSparkles, X, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Post, Restaurant } from '../types'

export function Dashboard({ restaurant, menuItems, posts, onChanged, setNotice }: {
  restaurant: Restaurant
  menuItems: MenuItem[]
  posts: Post[]
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [generating, setGenerating] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [editing, setEditing] = useState<Post | null>(null)
  const activeItems = useMemo(() => menuItems.filter((item) => item.is_active), [menuItems])
  const approvedCount = useMemo(() => posts.filter((post) => post.status === 'approved' || post.status === 'published').length, [posts])
  const averageDiscovery = useMemo(() => posts.length ? Math.round(posts.reduce((sum, post) => sum + (post.discovery_score || 0), 0) / posts.length) : 0, [posts])
  const photoCoverage = useMemo(() => activeItems.length ? Math.round((activeItems.filter((item) => item.image_url).length / activeItems.length) * 100) : 0, [activeItems])
  const orderedPosts = useMemo(() => [...posts].sort((a, b) => new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()), [posts])
  const nextScheduled = useMemo(() => orderedPosts.find((post) => post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now() && post.status !== 'published') || orderedPosts.find((post) => post.scheduled_for && post.status !== 'published'), [orderedPosts])
  const heroImage = useMemo(() => {
    const itemPhoto = activeItems.find((item) => item.image_url)?.image_url
    const postPhoto = posts.map((post) => resolvePostImage(post, menuItems)).find(Boolean)
    return itemPhoto || postPhoto || null
  }, [activeItems, posts, menuItems])

  async function generateWeek() {
    if (!activeItems.length) {
      setNotice('Prvo dodaj bar jedno aktivno jelo u meni.')
      return
    }
    setGenerating(true)
    setNotice('')
    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: { action: 'week', restaurantId: restaurant.id },
    })
    if (error) setNotice(error.message)
    else if (data?.error) setNotice(data.error)
    else {
      setNotice(`Autopilot je napravio ${data?.posts?.length || restaurant.posting_frequency} dizajniranih predloga sa datumom i vremenom.`)
      await onChanged()
    }
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
          <div className="hero-kicker"><span className="live-dot" /> AUTOPILOT ACTIVE</div>
          <span className="wow-brand-label">{restaurant.name.toUpperCase()}</span>
          <h1>{restaurant.description || 'Sadržaj koji izgleda kao tvoj restoran.'}</h1>
          <p>{restaurant.cuisine_type ? `${restaurant.cuisine_type} · ` : ''}{restaurant.neighborhood || restaurant.city || 'Tvoj grad'} · planirano, brendirano i spremno za objavu.</p>
          <div className="wow-hero-actions">
            <button className="wow-primary" onClick={generateWeek} disabled={generating}><Sparkles size={18} /> {generating ? 'Autopilot radi…' : 'Kreiraj novu nedelju'}</button>
            <div className="wow-hero-meta"><span><MapPin size={14} /> {restaurant.neighborhood || restaurant.city || 'lokalni discovery'}</span><span><Hash size={14} /> Smart Discovery</span></div>
          </div>
        </div>
        <div className="wow-score-card">
          <div><TrendingUp size={19} /><span>{nextScheduled ? 'Sledeća objava' : 'Discovery score'}</span></div>
          <strong>{nextScheduled?.scheduled_for ? formatTime(nextScheduled.scheduled_for) : (averageDiscovery || '—')}{!nextScheduled && averageDiscovery ? <small>/100</small> : null}</strong>
          <p>{nextScheduled?.scheduled_for ? `${formatWeekday(nextScheduled.scheduled_for)} · ${nextScheduled.title || 'Objava'}` : posts.length ? 'prosek aktivnog sadržaja' : 'generiši prvu nedelju'}</p>
        </div>
      </section>

      <section className="wow-kpi-grid">
        <Kpi icon={<UtensilsCrossed size={18} />} label="Aktivna jela" value={String(activeItems.length)} detail={`${photoCoverage}% sa fotografijom`} />
        <Kpi icon={<CalendarDays size={18} />} label="Sadržaj" value={String(posts.length)} detail="feed · story · promo" />
        <Kpi icon={<Clock3 size={18} />} label="Sledeći termin" value={nextScheduled?.scheduled_for ? formatTime(nextScheduled.scheduled_for) : '—'} detail={nextScheduled?.scheduled_for ? formatDateShort(nextScheduled.scheduled_for) : 'čeka generaciju'} />
        <Kpi icon={<CheckCircle2 size={18} />} label="Spremno" value={String(approvedCount)} detail={posts.length ? `${Math.round((approvedCount / posts.length) * 100)}% od plana` : 'čeka generaciju'} />
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
                  <strong>{post.scheduled_for ? formatDateShort(post.scheduled_for) : 'Bez datuma'}</strong>
                  {post.scheduled_for && <span className="demo-time-pill"><Clock3 size={11} /> {formatTime(post.scheduled_for)}</span>}
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
        {posts.length === 0 ? (
          <div className="empty-state wow-empty"><Sparkles size={30} /><h3>Još nema sadržaja</h3><p>Dodaj kvalitetne fotografije i jela u meni, zatim pokreni nedelju.</p><button className="wow-primary" onClick={generateWeek}><Sparkles size={17} /> Generiši sada</button></div>
        ) : (
          <div className="post-grid post-grid-pro wow-post-grid">
            {posts.map((post) => <PostCard key={post.id} post={post} restaurant={restaurant} menuItems={menuItems} working={workingId === post.id} onEdit={() => setEditing(post)} onAiCopy={() => aiCopy(post)} onOptimize={() => optimizeDiscovery(post)} onStatus={(status) => changeStatus(post, status)} setNotice={setNotice} />)}
          </div>
        )}
      </section>

      {editing && <PostEditor post={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged() }} setNotice={setNotice} />}
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

function PostCard({ post, restaurant, menuItems, working, onEdit, onAiCopy, onOptimize, onStatus, setNotice }: {
  post: Post
  restaurant: Restaurant
  menuItems: MenuItem[]
  working: boolean
  onEdit: () => void
  onAiCopy: () => void
  onOptimize: () => void
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
        <div className="post-meta"><span>{post.scheduled_for ? formatDateLong(post.scheduled_for) : 'Bez termina'}{post.scheduled_for && <> · <b className="post-time-strong"><Clock3 size={11} /> {formatTime(post.scheduled_for)}</b></>}</span><span className={`status ${post.status}`}>{post.status}</span></div>
        <div className="post-title-line"><h3>{post.title}</h3><span className="visual-template-chip">{template}</span></div>
        <p className="caption-preview">{post.caption}</p>
        <div className="platform-discovery"><div className="platform-row"><div className="platform-label ig"><Instagram size={14} /> Instagram</div><div className="tag-cloud">{instagramTags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}</div></div><div className="platform-row"><div className="platform-label fb"><Facebook size={14} /> Facebook</div><div className="tag-cloud fb-tags">{facebookTags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div></div>{post.seo_keywords?.length > 0 && <div className="keyword-line"><Search size={13} /><span>{post.seo_keywords.slice(0, 4).join(' · ')}</span></div>}</div>
        <div className="post-actions post-actions-pro"><button className="icon-button" title="Kopiraj Instagram objavu" onClick={copyInstagram}><Copy size={15} /></button><button className="icon-button" title="Izmeni objavu i termin" onClick={onEdit}><Pencil size={15} /></button><button className="icon-button ai-copy-button" title="AI napiši novu verziju teksta" disabled={working} onClick={onAiCopy}><WandSparkles size={16} /></button><button className="icon-button discovery-button" title="Optimizuj discovery" disabled={working} onClick={onOptimize}><Hash size={15} /></button>{post.status !== 'approved' && post.status !== 'published'? <button className="secondary action-grow" disabled={working} onClick={() => onStatus('approved')}><CheckCircle2 size={16} /> Proveri + odobri</button>: <button className="approved-button action-grow" onClick={() => onStatus('draft')}><CheckCircle2 size={16} /> Spremno</button>}</div>
      </div>
    </article>
  )
}

function PostEditor({ post, onClose, onSaved, setNotice }: { post: Post; onClose: () => void; onSaved: () => Promise<void>; setNotice: (value: string) => void }) {
  const [form, setForm] = useState({ title: post.title || '', caption: post.caption || '', cta: post.cta || '', instagram_caption: post.platform_content?.instagram?.caption || post.caption || '', instagram_hashtags: (post.platform_content?.instagram?.hashtags || post.hashtags || []).join(' '), facebook_caption: post.platform_content?.facebook?.caption || post.caption || '', facebook_hashtags: (post.platform_content?.facebook?.hashtags || []).join(' '), visual_brief: post.visual_brief || '', scheduled_for: post.scheduled_for ? toLocalDateTimeValue(post.scheduled_for) : '' })
  const [working, setWorking] = useState(false)
  function tags(value: string) { return value.split(/\s+/).map((v) => v.trim()).filter(Boolean).map((v) => v.startsWith('#') ? v : `#${v}`) }
  async function save(event: FormEvent) {
    event.preventDefault(); setWorking(true)
    const instagramHashtags = tags(form.instagram_hashtags).slice(0, 12), facebookHashtags = tags(form.facebook_hashtags).slice(0, 3)
    const platformContent = { ...(post.platform_content || {}), instagram: { ...(post.platform_content?.instagram || {}), caption: form.instagram_caption, hashtags: instagramHashtags }, facebook: { ...(post.platform_content?.facebook || {}), caption: form.facebook_caption, hashtags: facebookHashtags } }
    const oldVisual = post.generation_meta?.visual_design
    const generationMeta = oldVisual ? { ...post.generation_meta, visual_design: { ...oldVisual, headline: form.title || oldVisual.headline, subline: shorten(form.caption, oldVisual.format === 'story' ? 96 : 118), cta: form.cta || oldVisual.cta } } : post.generation_meta
    const { error } = await supabase.from('posts').update({ title: form.title || null, caption: form.caption || null, cta: form.cta || null, hashtags: instagramHashtags, platform_content: platformContent, visual_brief: form.visual_brief || null, scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null, generation_meta: generationMeta, status: 'draft' }).eq('id', post.id)
    if (error) setNotice(error.message); else { setNotice('Objava, termin, platformske verzije i vizuelni tekst su sinhronizovani.'); await onSaved() }
    setWorking(false)
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal-card modal-card-wide" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">UREDI OBJAVU</p><h2>{post.post_type.toUpperCase()}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="editor-base-grid"><label>Naslov<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>CTA<input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} /></label></div><label>Glavni tekst<textarea rows={4} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></label><div className="platform-editor-grid"><section className="platform-editor-card instagram-card"><div className="platform-editor-head"><Instagram size={17} /><strong>Instagram</strong><span>discovery + search</span></div><label>Caption<textarea rows={5} value={form.instagram_caption} onChange={(e) => setForm({ ...form, instagram_caption: e.target.value })} /></label><label>Hashtagovi<input value={form.instagram_hashtags} onChange={(e) => setForm({ ...form, instagram_hashtags: e.target.value })} /></label></section><section className="platform-editor-card facebook-card"><div className="platform-editor-head"><Facebook size={17} /><strong>Facebook</strong><span>čisto i lokalno</span></div><label>Tekst<textarea rows={5} value={form.facebook_caption} onChange={(e) => setForm({ ...form, facebook_caption: e.target.value })} /></label><label>Hashtagovi · max 3<input value={form.facebook_hashtags} onChange={(e) => setForm({ ...form, facebook_hashtags: e.target.value })} /></label></section></div><div className="grid-form compact-grid"><label>Datum i vreme objave<input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></label><label>Discovery score<input value={`${post.discovery_score || 0}/100`} disabled /></label></div><label>Brief za vizual<textarea rows={3} value={form.visual_brief} onChange={(e) => setForm({ ...form, visual_brief: e.target.value })} /></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Otkaži</button><button className="primary" disabled={working}><Save size={17} /> {working ? 'Čuvam…' : 'Sačuvaj sve verzije'}</button></div></form></div>
}

function toLocalDateTimeValue(value: string) { const d = new Date(value); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
function formatTime(value: string) { return new Date(value).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) }
function formatWeekday(value: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'short' }) }
function formatDateShort(value: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'short', day: 'numeric' }) }
function formatDateLong(value: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'short' }) }
function shorten(value: string, max: number) { const clean = value.replace(/\s+/g, ' ').trim(); return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…` }
