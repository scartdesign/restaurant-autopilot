import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export function Onboarding({ userId, onCreated }: { userId: string; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({
    name: '', city: '', cuisine_type: '', brand_style: 'modern', tone: 'friendly',
    phone: '', instagram: '', posting_frequency: '5', primary_color: '#17211b',
  })
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setMessage('')
    const { error } = await supabase.from('restaurants').insert({
      owner_id: userId,
      name: form.name,
      city: form.city || null,
      cuisine_type: form.cuisine_type || null,
      brand_style: form.brand_style,
      tone: form.tone,
      phone: form.phone || null,
      instagram: form.instagram || null,
      posting_frequency: Number(form.posting_frequency),
      primary_color: form.primary_color,
      onboarding_completed: true,
    })
    if (error) setMessage(error.message)
    else await onCreated()
    setWorking(false)
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <p className="eyebrow">PODEŠAVANJE RESTORANA</p>
        <h1>Pokreni Autopilot</h1>
        <p className="muted">Ovo određuje ton, ritam i izgled sadržaja. Sve možeš kasnije da promeniš.</p>
        <form onSubmit={submit} className="grid-form">
          <label>Naziv restorana<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bella Napoli" /></label>
          <label>Grad<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Beograd" /></label>
          <label>Tip kuhinje<input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} placeholder="Italijanska" /></label>
          <label>Stil brenda<select value={form.brand_style} onChange={(e) => setForm({ ...form, brand_style: e.target.value })}><option value="modern">Moderan</option><option value="premium">Premium</option><option value="traditional">Tradicionalan</option><option value="fast_food">Fast food</option><option value="casual">Casual</option></select></label>
          <label>Ton komunikacije<select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}><option value="friendly">Prijateljski</option><option value="premium">Premium</option><option value="playful">Razigran</option><option value="traditional">Tradicionalan</option><option value="direct">Direktan</option></select></label>
          <label>Objava nedeljno<select value={form.posting_frequency} onChange={(e) => setForm({ ...form, posting_frequency: e.target.value })}>{[3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+381…" /></label>
          <label>Instagram<input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@bellanapoli" /></label>
          <label>Primarna boja<input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></label>
          <button className="primary span-2" disabled={working}>{working ? 'Kreiram…' : 'Pokreni moj Autopilot'}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  )
}
