import { FormEvent, useState } from 'react'
import { Megaphone, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'

export function Promotions({ restaurant, onChanged, setNotice }: {
  restaurant: Restaurant
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [form, setForm] = useState({ title: '', discountText: '', description: '', startsAt: '', endsAt: '' })
  const [working, setWorking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setNotice('')
    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: {
        action: 'promotion',
        restaurantId: restaurant.id,
        title: form.title,
        discountText: form.discountText,
        description: form.description,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      },
    })
    if (error) setNotice(error.message)
    else if (data?.error) setNotice(data.error)
    else {
      setNotice('Promo feed i story su napravljeni i čekaju odobrenje.')
      setForm({ title: '', discountText: '', description: '', startsAt: '', endsAt: '' })
      await onChanged()
    }
    setWorking(false)
  }

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">BRZA PROMOCIJA</p><h1>Napravi akciju</h1><p className="muted">Jedan unos pravi feed + story predloge.</p></div>
      </header>
      <div className="promo-layout">
        <form className="panel promo-form" onSubmit={submit}>
          <h2><Megaphone size={20} /> Nova akcija</h2>
          <label>Naziv akcije<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Vikend pasta" /></label>
          <label>Glavna poruka<input value={form.discountText} onChange={(e) => setForm({ ...form, discountText: e.target.value })} placeholder="20% popusta na sve paste" /></label>
          <label>Detalji<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Petak i subota od 18h. Važi u restoranu." /></label>
          <div className="grid-form compact-grid">
            <label>Početak<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
            <label>Kraj<input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
          </div>
          <button className="primary full" disabled={working}><Sparkles size={18} /> {working ? 'Pravim kampanju…' : 'Napravi promo sadržaj'}</button>
        </form>
        <aside className="promo-explainer">
          <p className="eyebrow">AUTOPILOT</p>
          <h2>Od jedne rečenice do kampanje.</h2>
          <p>Za MVP pravimo dva spremna formata: feed promociju i story. Obe objave ulaze u isti pregled gde ih možeš izmeniti, regenerisati i odobriti.</p>
          <div className="format-cards"><div><strong>1080 × 1350</strong><span>Feed brief</span></div><div><strong>1080 × 1920</strong><span>Story brief</span></div></div>
        </aside>
      </div>
    </>
  )
}
