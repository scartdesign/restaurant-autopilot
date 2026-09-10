import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ClipboardCopy, Download, ExternalLink, Instagram, Facebook, Send, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Post, Restaurant } from '../types'

export function PublishCenter({ restaurant, posts, onChanged, setNotice }: {
  restaurant: Restaurant
  posts: Post[]
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [workingId, setWorkingId] = useState('')
  const ordered = useMemo(() => [...posts].sort((a, b) => new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime()), [posts])
  const approved = posts.filter((post) => post.status === 'approved')
  const published = posts.filter((post) => post.status === 'published')
  const readyPercent = posts.length ? Math.round(((approved.length + published.length) / posts.length) * 100) : 0

  function exportCsv() {
    if (!posts.length) { setNotice('Nema sadržaja za export.'); return }
    const headers = ['datum','status','format','naslov','instagram_caption','instagram_hashtags','facebook_caption','facebook_hashtags','cta','search_keywords']
    const rows = ordered.map((post) => [
      post.scheduled_for || '', post.status, post.post_type, post.title || '',
      post.platform_content?.instagram?.caption || post.caption || '',
      (post.platform_content?.instagram?.hashtags || post.hashtags || []).join(' '),
      post.platform_content?.facebook?.caption || post.caption || '',
      (post.platform_content?.facebook?.hashtags || []).join(' '),
      post.cta || '', (post.seo_keywords || []).join(' | '),
    ])
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')
    downloadBlob(`autopilot-${slug(restaurant.name)}-content.csv`, new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
    setNotice('Nedeljni content plan je izvezen u CSV.')
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
    setNotice('Content kalendar je izvezen. Možeš ga otvoriti u Google/Apple/Outlook kalendaru.')
  }

  async function copyReadyBundle() {
    if (!approved.length) { setNotice('Prvo odobri bar jednu objavu.'); return }
    const text = approved.map((post, index) => {
      const igCaption = post.platform_content?.instagram?.caption || post.caption || ''
      const tags = (post.platform_content?.instagram?.hashtags || post.hashtags || []).join(' ')
      return `${index + 1}. ${post.title || 'OBJAVA'}\n${post.scheduled_for ? new Date(post.scheduled_for).toLocaleString('sr-RS') : 'Bez termina'}\n\n${igCaption}\n\n${tags}`
    }).join('\n\n────────────────────\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`Kopirano je ${approved.length} odobrenih objava.`)
    } catch { setNotice('Browser nije dozvolio kopiranje. Koristi CSV export.') }
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

  return (
    <>
      <header className="page-header publish-header">
        <div><p className="eyebrow">PUBLISH CENTER</p><h1>Spremno za objavu.</h1><p className="muted">Pregledaj redosled, izvezi kalendar ili kopiraj odobren sadržaj. Auto-publishing povezujemo kao sledeći sloj.</p></div>
        <div className="publish-actions"><button className="secondary" onClick={exportCalendar}><CalendarClock size={16} /> .ICS kalendar</button><button className="primary" onClick={exportCsv}><Download size={16} /> Export CSV</button></div>
      </header>

      <section className="publish-stats">
        <div><span>Spremnost nedelje</span><strong>{readyPercent}%</strong><div className="readiness-track"><i style={{ width: `${readyPercent}%` }} /></div></div>
        <div><span>Odobreno</span><strong>{approved.length}</strong><small>čeka objavu</small></div>
        <div><span>Objavljeno</span><strong>{published.length}</strong><small>označeno u sistemu</small></div>
        <button className="copy-bundle" onClick={copyReadyBundle}><ClipboardCopy size={18} /><div><strong>Kopiraj odobrene</strong><span>caption + hashtagovi</span></div></button>
      </section>

      <div className="publishing-note"><Sparkles size={17} /><div><strong>Bez lažne automatizacije</strong><span>Trenutno pripremamo i izvozimo sadržaj. Direktno zakazivanje na Meta naloge dodajemo tek kada povežemo zvanične dozvole i tok odobravanja.</span></div></div>

      <section className="publish-queue panel">
        <div className="panel-heading"><h2><Send size={18} /> Red za objavu</h2><small>{ordered.length} stavki</small></div>
        {ordered.length === 0 ? <div className="empty-small">Generiši nedelju sadržaja da bi se pojavio red za objavu.</div> : <div className="queue-list">
          {ordered.map((post) => <div className="queue-item" key={post.id}>
            <div className={`queue-date ${post.status}`}><strong>{post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short' }) : '—'}</strong><span>{post.scheduled_for ? new Date(post.scheduled_for).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' }) : 'bez termina'}</span></div>
            <div className="queue-copy"><div className="queue-title"><span className="queue-format">{post.post_type}</span><strong>{post.title || 'Objava'}</strong></div><p>{post.caption}</p><div className="queue-platforms"><span><Instagram size={13} /> {(post.platform_content?.instagram?.hashtags || post.hashtags || []).length} IG tags</span><span><Facebook size={13} /> {(post.platform_content?.facebook?.hashtags || []).length} FB tags</span><span>{post.discovery_score || 0}/100 discovery</span></div></div>
            <div className="queue-state"><span className={`status ${post.status}`}>{post.status}</span>{post.status === 'approved' && <button className="mini-publish" disabled={workingId === post.id} onClick={() => markPublished(post)}><CheckCircle2 size={14} /> Označi objavljeno</button>}{post.status === 'published' && <span className="published-ok"><CheckCircle2 size={15} /> završeno</span>}</div>
          </div>)}
        </div>}
      </section>

      <div className="meta-roadmap"><div><ExternalLink size={18} /><div><strong>Sledeće: direktno zakazivanje</strong><span>Meta/Instagram povezivanje, odobri → zakaži, bez ručnog copy/paste.</span></div></div><span className="roadmap-badge">ROADMAP</span></div>
    </>
  )
}

function csvCell(value: string) { return `"${String(value).replace(/"/g, '""')}"` }
function icsText(value: string) { return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;') }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'restaurant' }
function downloadBlob(name: string, blob: Blob) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1200) }
