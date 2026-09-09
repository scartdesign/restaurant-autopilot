import { FormEvent, useMemo, useState } from 'react'
import { CheckCircle2, ChefHat, Pencil, RefreshCw, Save, Sparkles, X } from 'lucide-react'
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
      setNotice(`Autopilot je napravio ${data?.posts?.length || restaurant.posting_frequency} predloga za ovu nedelju.`)
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

  async function regenerate(post: Post) {
    setWorkingId(post.id)
    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: { action: 'regenerate', restaurantId: restaurant.id, postId: post.id },
    })
    if (error) setNotice(error.message)
    else if (data?.error) setNotice(data.error)
    else {
      setNotice('Napravljen je novi tekst za objavu.')
      await onChanged()
    }
    setWorkingId('')
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">DOBRO DOŠLI</p>
          <h1>{restaurant.name}</h1>
          <p className="muted">Jedna tabla za celu marketinšku nedelju.</p>
        </div>
        <button className="primary" onClick={generateWeek} disabled={generating}><Sparkles size={18} /> {generating ? 'Autopilot radi…' : 'Generiši ovu nedelju'}</button>
      </header>

      <section className="stats-grid">
        <div className="stat-card"><span>Aktivna jela</span><strong>{menuItems.filter((item) => item.is_active).length}</strong></div>
        <div className="stat-card"><span>Predlozi sadržaja</span><strong>{posts.length}</strong></div>
        <div className="stat-card"><span>Odobreno</span><strong>{approvedCount}</strong></div>
      </section>

      <section className="content-section">
        <div className="section-title">
          <div><p className="eyebrow">CONTENT PLAN</p><h2>Sadržaj ove nedelje</h2></div>
          <span className="engine-badge"><Sparkles size={14} /> Smart engine v1</span>
        </div>
        {posts.length === 0 ? (
          <div className="empty-state"><Sparkles size={30} /><h3>Još nema sadržaja</h3><p>Dodaj jela u meni, zatim klikni „Generiši ovu nedelju“.</p></div>
        ) : (
          <div className="post-grid">
            {posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="post-preview" style={restaurant.primary_color ? { background: `linear-gradient(145deg, ${restaurant.primary_color}, #27352b)` } : undefined}>
                  <span>{post.post_type === 'story' ? 'STORY' : post.post_type === 'promotion' ? 'PROMO' : 'FEED'}</span>
                  <ChefHat size={34} />
                </div>
                <div className="post-body">
                  <div className="post-meta">
                    {post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Bez termina'}
                    <span className={`status ${post.status}`}>{post.status}</span>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.caption}</p>
                  <div className="hashtags">{post.hashtags?.join(' ')}</div>
                  <div className="post-actions">
                    <button className="icon-button" title="Izmeni" onClick={() => setEditing(post)}><Pencil size={16} /></button>
                    <button className="icon-button" title="Novi predlog" disabled={workingId === post.id} onClick={() => regenerate(post)}><RefreshCw size={16} /></button>
                    {post.status !== 'approved'
                      ? <button className="secondary action-grow" disabled={workingId === post.id} onClick={() => changeStatus(post.id, 'approved')}><CheckCircle2 size={16} /> Odobri</button>
                      : <button className="approved-button action-grow" onClick={() => changeStatus(post.id, 'draft')}><CheckCircle2 size={16} /> Odobreno</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editing && <PostEditor post={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await onChanged() }} setNotice={setNotice} />}
    </>
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
    hashtags: post.hashtags?.join(' ') || '',
    visual_brief: post.visual_brief || '',
    scheduled_for: post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : '',
  })
  const [working, setWorking] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    const hashtags = form.hashtags.split(/\s+/).map((value) => value.trim()).filter(Boolean).map((value) => value.startsWith('#') ? value : `#${value}`)
    const { error } = await supabase.from('posts').update({
      title: form.title || null,
      caption: form.caption || null,
      cta: form.cta || null,
      hashtags,
      visual_brief: form.visual_brief || null,
      scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
      status: 'draft',
    }).eq('id', post.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Objava je sačuvana.')
      await onSaved()
    }
    setWorking(false)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal-card" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><p className="eyebrow">UREDI OBJAVU</p><h2>{post.post_type.toUpperCase()}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div>
        <label>Naslov<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Tekst<textarea rows={7} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} /></label>
        <div className="grid-form compact-grid">
          <label>CTA<input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} /></label>
          <label>Termin<input type="datetime-local" value={form.scheduled_for} onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })} /></label>
        </div>
        <label>Hashtagovi<input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} /></label>
        <label>Brief za vizual<textarea rows={3} value={form.visual_brief} onChange={(e) => setForm({ ...form, visual_brief: e.target.value })} /></label>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Otkaži</button><button className="primary" disabled={working}><Save size={17} /> {working ? 'Čuvam…' : 'Sačuvaj'}</button></div>
      </form>
    </div>
  )
}
