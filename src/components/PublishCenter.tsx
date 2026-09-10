import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ClipboardCopy, Clock3, Download, ExternalLink, Facebook, Instagram, Pencil, RotateCcw, Save, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Post, Restaurant } from '../types'

type ScheduleDraft = { date: string; time: string }

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

  const ordered = useMemo(() => [...posts].sort((a, b) => new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()), [posts])
  const approved = posts.filter((post) => post.status === 'approved')
  const published = posts.filter((post) => post.status === 'published')
  const readyPercent = posts.length ? Math.round(((approved.length + published.length) / posts.length) * 100) : 0
  const nextPost = ordered.find((post) => post.scheduled_for && new Date(post.scheduled_for).getTime() > Date.now() && post.status !== 'published') || ordered.find((post) => post.scheduled_for && post.status !== 'published')

  function exportCsv() {
    if (!posts.length) { setNotice('Nema sadržaja za export.'); return }
    const headers = ['datum','vreme','status','format','naslov','instagram_caption','instagram_hashtags','facebook_caption','facebook_hashtags','cta','search_keywords']
    const rows = ordered.map((post) => [
      post.scheduled_for ? formatDate(post.scheduled_for) : '',
      post.scheduled_for ? formatTime(post.scheduled_for) : '',
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
      return `${index + 1}. ${post.title || 'OBJAVA'}\n${post.scheduled_for ? `${formatDateLong(post.scheduled_for)} u ${formatTime(post.scheduled_for)}` : 'Bez termina'}\n\n${igCaption}\n\n${tags}`
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
    const initial = post.scheduled_for ? dateParts(post.scheduled_for) : defaultDraft(post)
    setScheduleDraft(initial)
    setEditingId(post.id)
  }

  function useAutopilotTime(post: Post) {
    const draft = scheduleDraft.date ? scheduleDraft : defaultDraft(post)
    setScheduleDraft({ ...draft, time: recommendedTime(post) })
  }

  async function saveSchedule(post: Post) {
    if (!scheduleDraft.date || !scheduleDraft.time) {
      setNotice('Izaberi datum i vreme objave.')
      return
    }
    const local = new Date(`${scheduleDraft.date}T${scheduleDraft.time}:00`)
    if (Number.isNaN(local.getTime())) {
      setNotice('Termin nije ispravan.')
      return
    }
    setWorkingId(post.id)
    const { error } = await supabase.from('posts').update({ scheduled_for: local.toISOString() }).eq('id', post.id)
    if (error) setNotice(error.message)
    else {
      setNotice(`Termin je sačuvan: ${local.toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long' })} u ${local.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}.`)
      setEditingId('')
      await onChanged()
    }
    setWorkingId('')
  }

  return (
    <>
      <header className="page-header publish-header">
        <div><p className="eyebrow">PUBLISH CENTER</p><h1>Tačan dan. Tačno vreme. Sve spremno.</h1><p className="muted">Svaka objava sada ima vidljiv termin koji možeš promeniti pre objavljivanja.</p></div>
        <div className="publish-actions"><button className="secondary" onClick={exportCalendar}><CalendarClock size={16} /> .ICS kalendar</button><button className="primary" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
      </header>

      {nextPost && <section className="next-publish-card">
        <div className="next-publish-icon"><Clock3 size={22} /></div>
        <div><span>SLEDEĆA OBJAVA</span><strong>{formatDateLong(nextPost.scheduled_for!)} · {formatTime(nextPost.scheduled_for!)}</strong><small>{nextPost.post_type.toUpperCase()} · {nextPost.title || 'Objava'}</small></div>
        <button className="secondary" onClick={() => openSchedule(nextPost)}><Pencil size={14} /> Promeni termin</button>
      </section>}

      <section className="publish-stats">
        <div><span>Spremnost nedelje</span><strong>{readyPercent}%</strong><div className="readiness-track"><i style={{ width: `${readyPercent}%` }} /></div></div>
        <div><span>Odobreno</span><strong>{approved.length}</strong><small>čeka objavu</small></div>
        <div><span>Objavljeno</span><strong>{published.length}</strong><small>završeno</small></div>
        <button className="copy-bundle" onClick={copyReadyBundle}><ClipboardCopy size={18} /><div><strong>Kopiraj odobrene</strong><span>termin + caption + hashtagovi</span></div></button>
      </section>

      <div className="publishing-note"><Sparkles size={17} /><div><strong>Autopilot raspoređuje, ti kontrolišeš</strong><span>Početni termini se generišu automatski prema tipu sadržaja. Svaki datum i vreme možeš ručno da promeniš pre objave.</span></div></div>

      <section className="publish-queue panel">
        <div className="panel-heading"><h2><Send size={18} /> Red za objavu</h2><small>{ordered.length} stavki · datum + vreme</small></div>
        {ordered.length === 0 ? <div className="empty-small">Generiši nedelju sadržaja da bi se pojavio red za objavu.</div> : <div className="queue-list">
          {ordered.map((post) => <div className={`queue-item ${editingId === post.id ? 'editing-schedule' : ''}`} key={post.id}>
            <div className={`queue-date ${post.status}`}><strong>{post.scheduled_for ? formatDate(post.scheduled_for) : '—'}</strong><span className="queue-time"><Clock3 size={11} /> {post.scheduled_for ? formatTime(post.scheduled_for) : 'bez termina'}</span></div>
            <div className="queue-copy">
              <div className="queue-title"><span className="queue-format">{post.post_type}</span><strong>{post.title || 'Objava'}</strong>{post.scheduled_for && <span className="schedule-chip">{formatWeekday(post.scheduled_for)} · {formatTime(post.scheduled_for)}</span>}</div>
              <p>{post.caption}</p>
              <div className="queue-platforms"><span><Instagram size={13} /> {(post.platform_content?.instagram?.hashtags || post.hashtags || []).length} IG tags</span><span><Facebook size={13} /> {(post.platform_content?.facebook?.hashtags || []).length} FB tags</span><span>{post.discovery_score || 0}/100 discovery</span>{qualityScores[post.id] !== undefined && <span className="quality-inline"><ShieldCheck size={13} /> {qualityScores[post.id]}/100 quality</span>}</div>

              {editingId === post.id && <div className="schedule-editor">
                <div className="schedule-fields"><label>Datum<input type="date" value={scheduleDraft.date} onChange={(e) => setScheduleDraft({ ...scheduleDraft, date: e.target.value })} /></label><label>Vreme<input type="time" step="300" value={scheduleDraft.time} onChange={(e) => setScheduleDraft({ ...scheduleDraft, time: e.target.value })} /></label></div>
                <div className="schedule-suggestion"><Sparkles size={14} /><span>Autopilot termin za ovaj format: <strong>{recommendedTime(post)}</strong></span><button type="button" onClick={() => useAutopilotTime(post)}>Primeni</button></div>
                <div className="schedule-editor-actions"><button type="button" className="secondary" onClick={() => setEditingId('')}><X size={14} /> Otkaži</button><button type="button" className="secondary" onClick={() => setScheduleDraft(defaultDraft(post))}><RotateCcw size={14} /> Reset</button><button type="button" className="primary" disabled={workingId === post.id} onClick={() => void saveSchedule(post)}><Save size={14} /> Sačuvaj termin</button></div>
              </div>}
            </div>
            <div className="queue-state"><span className={`status ${post.status}`}>{post.status}</span><button className="mini-schedule" onClick={() => openSchedule(post)}><CalendarClock size={14} /> Datum i vreme</button><button className="mini-quality" disabled={workingId === post.id} onClick={() => qualityCheck(post)}><ShieldCheck size={14} /> Quality check</button>{post.status === 'approved' && <button className="mini-publish" disabled={workingId === post.id} onClick={() => markPublished(post)}><CheckCircle2 size={14} /> Označi objavljeno</button>}{post.status === 'published' && <span className="published-ok"><CheckCircle2 size={15} /> završeno</span>}</div>
          </div>)}
        </div>}
      </section>

      <div className="meta-roadmap"><div><ExternalLink size={18} /><div><strong>Spremno za ručni publishing workflow</strong><span>Plan, termin, dizajn, caption, hashtagovi, quality check, CSV i kalendar rade. Direktan Meta autopost zahteva povezivanje poslovnog naloga i dozvole.</span></div></div><span className="roadmap-badge">MVP READY</span></div>
    </>
  )
}

function recommendedTime(post: Post) {
  if (post.post_type === 'promotion') return '17:30'
  if (post.post_type === 'story') return '11:30'
  const pillar = String(post.generation_meta?.pillar || '')
  if (pillar === 'local_discovery') return '18:30'
  if (pillar === 'hero_dish') return '18:30'
  if (pillar === 'social_prompt') return '19:30'
  return '18:30'
}
function defaultDraft(post: Post): ScheduleDraft {
  const base = post.scheduled_for ? new Date(post.scheduled_for) : new Date()
  if (!post.scheduled_for) base.setDate(base.getDate() + 1)
  return { date: localDateValue(base), time: recommendedTime(post) }
}
function dateParts(iso: string): ScheduleDraft {
  const date = new Date(iso)
  return { date: localDateValue(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
}
function localDateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatDate(value: string) { return new Date(value).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' }) }
function formatDateLong(value: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long' }) }
function formatWeekday(value: string) { return new Date(value).toLocaleDateString('sr-RS', { weekday: 'short' }) }
function formatTime(value: string) { return new Date(value).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) }
function qualityLabel(key: string) {
  const labels: Record<string, string> = { caption: 'dužina teksta', local_signal: 'lokalni signal', focused_hashtags: 'hashtag fokus', clear_cta: 'CTA', photo_ready: 'fotografija', platform_versions: 'IG/FB verzije', visual_design: 'vizuelni dizajn' }
  return labels[key] || key
}
function csvCell(value: string) { return `"${String(value).replace(/"/g, '""')}"` }
function icsText(value: string) { return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;') }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'restaurant' }
function downloadBlob(name: string, blob: Blob) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1200) }
