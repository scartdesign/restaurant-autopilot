import { FormEvent, useMemo, useState } from 'react'
import { CheckCircle2, ChefHat, Copy, Facebook, Hash, Instagram, MapPin, Pencil, RefreshCw, Save, Search, Sparkles, X, Zap } from 'lucide-react'
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
  const approvedCount = useMemo(() => posts.filter((post) => post.status === 'approved').length, [posts])
  const averageDiscovery = useMemo(() => posts.length ? Math.round(posts.reduce((sum, post) => sum + (post.discovery_score || 0), 0) / posts.length) : 0, [posts])

  async function generateWeek() {
    if (!menuItems.some((item) => item.is_active)) {
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
      setNotice(`Smart Discovery je napravio ${data?.posts?.length || restaurant.posting_frequency} platformskih predloga za ovu nedelju.`)
      await onChanged()
    }
    setGenerating(false)
  }

  async function changeStatus(id: string, status: Post['status']) {
    setWorkingId(id)
    const { error } = await supabase.from('posts').update({ status }).eq('id', id)
    if (error) setNotice(error.message)
    else await onChanged()
    setWorkingId('')
  }

  async function runEngine(post: Post, action: 'regenerate' | 'optimize_discovery') {
    setWorkingId(post.id)
    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: { action, restaurantId: restaurant.id, postId: post.id },
    })
    if (error) setNotice(error.message)
    else if (data?.error) setNotice(data.error)
    else {
      setNotice(action === 'regenerate' ? 'Napravljen je novi tekst i novi discovery set.' : 'Hashtagovi i search keywords su ponovo optimizovani.')
      await onChanged()
    }
    setWorkingId('')
  }

  return (
    <>
      <header className="page-header dashboard-hero">
        <div>
          <div className="hero-kicker"><span className="live-dot" /> AUTOPILOT ACTIVE</div>
          <h1>{restaurant.name}</h1>
          <p className="muted">Plan, platform-specific tekst, lokalni discovery i odobravanje — na jednom mestu.</p>
          <div className="hero-meta">
            {restaurant.city && <span><MapPin size={14} /> {restaurant.neighborhood ? `${restaurant.neighborhood}, ` : ''}{restaurant.city}</span>}
            {restaurant.cuisine_type && <span><ChefHat size={14} /> {restaurant.cuisine_type}</span>}
            <span><Hash size={14} /> {restaurant.hashtag_mode === 'local' ? 'Local focus' : restaurant.hashtag_mode === 'minimal' ? 'Minimal tags' : 'Smart Discovery'}</span>
          </div>
        </div>
        <button className="primary hero-action" onClick={generateWeek} disabled={generating}><Sparkles size={18} /> {generating ? 'Autopilot radi…' : 'Generiši ovu nedelju'}</button>
      </header>

      <section className="stats-grid stats-grid-pro">
        <div className="stat-card stat-pro"><span>Aktivna jela</span><strong>{menuItems.filter((item) => item.is_active).length}</strong><small>gorivo za sadržaj</small></div>
        <div className="stat-card stat-pro"><span>Predlozi sadržaja</span><strong>{posts.length}</strong><small>feed · story · promo</small></div>
        <div className="stat-card stat-pro"><span>Odobreno</span><strong>{approvedCount}</strong><small>{posts.length ? `${Math.round((approvedCount / posts.length) * 100)}% spremno` : 'čeka generaciju'}</small></div>
        <div className="stat-card stat-pro discovery-stat"><span>Discovery score</span><strong>{averageDiscovery || '—'}{averageDiscovery ? <em>/100</em> : null}</strong><small>lokalno + niša + search</small></div>
      </section>

      <section className="discovery-ribbon">
        <div className="discovery-ribbon-icon"><Zap size={20} /></div>
        <div><strong>Smart Discovery v2</strong><span>Ne jurimo 30 generičkih hashtagova. Svaka objava dobija fokusiran Instagram set, 2–3 Facebook taga, lokalne signale i prirodne search keywords.</span></div>
        <div className="platform-mini"><span><Instagram size={15} /> IG optimized</span><span><Facebook size={15} /> FB clean</span><span><Search size={15} /> Search ready</span></div>
      </section>

      <section className="content-section">
        <div className="section-title">
          <div><p className="eyebrow">CONTENT PLAN</p><h2>Sadržaj ove nedelje</h2></div>
          <span className="engine-badge"><Sparkles size={14} /> Smart Discovery v2</span>
        </div>
        {posts.length === 0 ? (
          <div className="empty-state"><Sparkles size={30} /><h3>Još nema sadržaja</h3><p>Dodaj kvalitetne fotografije i jela u meni, zatim pokreni nedelju.</p></div>
        ) : (
          <div className="post-grid post-grid-pro">
            {posts.map((post) => <PostCard key={post.id} post={post} restaurant={restaurant} working={workingId === post.id} onEdit={() => setEditing(post)} onRegenerate={() => runEngine(post, 'regenerate')} onOptimize={() => runEngine(post, 'optimize_discovery')} onStatus={(status) => changeStatus(post.id, status)} setNotice={setNotice} />)}
          </div>
        )}
      </section>

      {editing && <PostEditor post={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged() }} setNotice={setNotice} />}
    </>
  )
}

function PostCard({ post, restaurant, working, onEdit, onRegenerate, onOptimize, onStatus, setNotice }: {
  post: Post
  restaurant: Restaurant
  working: boolean
  onEdit: () => void
  onRegenerate: () => void
  onOptimize: () => void
  onStatus: (status: Post['status']) => void
  setNotice: (value: string) => void
}) {
  const instagramTags = post.platform_content?.instagram?.hashtags || post.hashtags || []
  const facebookTags = post.platform_content?.facebook?.hashtags || []
  const imageUrl = typeof post.generation_meta?.image_url === 'string' ? post.generation_meta.image_url : null

  async function copyInstagram() {
    const caption = post.platform_content?.instagram?.caption || post.caption || ''
    const text = `${caption}\n\n${instagramTags.join(' ')}`.trim()
    try {
      await navigator.clipboard.writeText(text)
      setNotice('Instagram tekst i hashtagovi su kopirani.')
    } catch {
      setNotice('Browser nije dozvolio kopiranje. Otvori „Izmeni“ i kopiraj ručno.')
    }
  }

  return (
    <article className="post-card post-card-pro">
      <div className={`post-preview post-preview-pro ${imageUrl ? 'has-photo' : ''}`} style={imageUrl ? { backgroundImage: `linear-gradient(180deg, rgba(10,16,12,.06), rgba(10,16,12,.72)), url(${imageUrl})` } : restaurant.primary_color ? { background: `linear-gradient(145deg, ${restaurant.primary_color}, #27352b)` } : undefined}>
        <div className="preview-top"><span className="format-badge">{post.post_type === 'story' ? 'STORY 9:16' : post.post_type === 'promotion' ? 'PROMO 4:5' : 'FEED 4:5'}</span><span className="score-pill">{post.discovery_score || 0}<small>/100</small></span></div>
        <div className="preview-brand"><div className="preview-logo"><ChefHat size={20} /></div><div><strong>{restaurant.name}</strong><small>{post.title || 'Autopilot content'}</small></div></div>
      </div>
      <div className="post-body post-body-pro">
        <div className="post-meta">
          {post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Bez termina'}
          <span className={`status ${post.status}`}>{post.status}</span>
        </div>
        <h3>{post.title}</h3>
        <p className="caption-preview">{post.caption}</p>

        <div className="platform-discovery">
          <div className="platform-row"><div className="platform-label ig"><Instagram size={14} /> Instagram</div><div className="tag-cloud">{instagramTags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          <div className="platform-row"><div className="platform-label fb"><Facebook size={14} /> Facebook</div><div className="tag-cloud fb-tags">{facebookTags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          {post.seo_keywords?.length > 0 && <div className="keyword-line"><Search size={13} /><span>{post.seo_keywords.slice(0, 4).join(' · ')}</span></div>}
        </div>

        <div className="post-actions post-actions-pro">
          <button className="icon-button" title="Kopiraj Instagram objavu" onClick={copyInstagram}><Copy size={15} /></button>
          <button className="icon-button" title="Izmeni" onClick={onEdit}><Pencil size={15} /></button>
          <button className="icon-button" title="Novi tekst" disabled={working} onClick={onRegenerate}><RefreshCw size={15} /></button>
          <button className="icon-button discovery-button" title="Optimizuj discovery" disabled={working} onClick={onOptimize}><Hash size={15} /></button>
          {post.status !== 'approved'
            ? <button className="secondary action-grow" disabled={working} onClick={() => onStatus('approved')}><CheckCircle2 size={16} /> Odobri</button>
            : <button className="approved-button action-grow" onClick={() => onStatus('draft')}><CheckCircle2 size={16} /> Spremno</button>}
        </div>
      </div>
    </article>
  )
}

function PostEditor({ post, onClose, onSaved, setNotice }: {
  post: Post
  onClose: () => void
  onSaved: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [form, setForm] = useState({
    title: post.title || '',
    caption: post.caption || '',
    cta: post.cta || '',
    instagram_caption: post.platform_content?.instagram?.caption || post.caption || '',
    instagram_hashtags: (post.platform_content?.instagram?.hashtags || post.hashtags || []).join(' '),
    facebook_caption: post.platform_content?.facebook?.caption || post.caption || '',
    facebook_hashtags: (post.platform_content?.facebook?.hashtags || []).join(' '),
    visual_brief: post.visual_brief || '',
    scheduled_for: post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : '',
  })
  const [working, setWorking] = useState(false)

  function tags(value: string) {
    return value.split(/\s+/).map((v) => v.trim()).filter(Boolean).map((v) => v.startsWith('#') ? v : `#${v}`)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    const instagramHashtags = tags(form.instagram_hashtags).slice(0, 12)
    const facebookHashtags = tags(form.facebook_hashtags).slice(0, 3)
    const platformContent = {
      ...(post.platform_content || {}),
      instagram: { ...(post.platform_content?.instagram || {}), caption: form.instagram_caption, hashtags: instagramHashtags },
      facebook: { ...(post.platform_content?.facebook || {}), caption: form.facebook_caption, hashtags: facebookHashtags },
    }
    const { error } = await supabase.from('posts').update({
      title: form.title || null,
      caption: form.caption || null,
      cta: form.cta || null,
      hashtags: instagramHashtags,
      platform_content: platformContent,
      visual_brief: form.visual_brief || null,
      scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
      status: 'draft',
    }).eq('id', post.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Objava i platformske verzije su sačuvane.')
      await onSaved()
    }
    setWorking(false)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal-card modal-card-wide" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p className="eyebrow">UREDI OBJAVU</p><h2>{post.post_type.toUpperCase()}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div>
        <div className="editor-base-grid"><label>Naslov<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>CTA<input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} /></label></div>
        <label>Glavni tekst<textarea rows={4} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></label>

        <div className="platform-editor-grid">
          <section className="platform-editor-card instagram-card"><div className="platform-editor-head"><Instagram size={17} /><strong>Instagram</strong><span>discovery + search</span></div><label>Caption<textarea rows={5} value={form.instagram_caption} onChange={(e) => setForm({ ...form, instagram_caption: e.target.value })} /></label><label>Hashtagovi<input value={form.instagram_hashtags} onChange={(e) => setForm({ ...form, instagram_hashtags: e.target.value })} /></label></section>
          <section className="platform-editor-card facebook-card"><div className="platform-editor-head"><Facebook size={17} /><strong>Facebook</strong><span>čisto i lokalno</span></div><label>Tekst<textarea rows={5} value={form.facebook_caption} onChange={(e) => setForm({ ...form, facebook_caption: e.target.value })} /></label><label>Hashtagovi · max 3<input value={form.facebook_hashtags} onChange={(e) => setForm({ ...form, facebook_hashtags: e.target.value })} /></label></section>
        </div>

        <div className="grid-form compact-grid"><label>Termin<input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></label><label>Discovery score<input value={`${post.discovery_score || 0}/100`} disabled /></label></div>
        <label>Brief za vizual<textarea rows={3} value={form.visual_brief} onChange={(e) => setForm({ ...form, visual_brief: e.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Otkaži</button><button className="primary" disabled={working}><Save size={17} /> {working ? 'Čuvam…' : 'Sačuvaj sve verzije'}</button></div>
      </form>
    </div>
  )
}
