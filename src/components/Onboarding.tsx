import { FormEvent, useState } from 'react'
import { Hash, MapPin, Sparkles, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function Onboarding({ userId, onCreated }: { userId: string; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({
    name: '', city: '', neighborhood: '', country: 'Serbia', cuisine_type: '', target_audience: '',
    social_goal: 'reservations', hashtag_mode: 'smart', brand_style: 'modern', tone: 'friendly',
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
      neighborhood: form.neighborhood || null,
      country: form.country || 'Serbia',
      cuisine_type: form.cuisine_type || null,
      target_audience: form.target_audience || null,
      social_goal: form.social_goal,
      hashtag_mode: form.hashtag_mode,
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
      <div className="onboarding-card onboarding-pro">
        <div className="onboarding-top"><div className="auth-logo"><Sparkles size={24} /></div><div><p className="eyebrow">PODEŠAVANJE RESTORANA</p><h1>Pokreni Autopilot</h1><p className="muted">Daj sistemu dovoljno konteksta da sadržaj izgleda kao da ga radi tvoj marketing tim.</p></div></div>
        <div className="onboarding-benefits"><span><MapPin size={15} /> Lokalni reach</span><span><Hash size={15} /> Smart hashtagovi</span><span><Target size={15} /> CTA prema cilju</span></div>
        <form onSubmit={submit} className="grid-form onboarding-grid">
          <label>Naziv restorana<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bella Napoli" /></label>
          <label>Tip kuhinje<input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} placeholder="Italijanska" /></label>
          <label>Grad<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Beograd" /></label>
          <label>Kraj / naselje<input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Vračar" /></label>
          <label>Država<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
          <label>Ciljna publika<input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="Parovi, porodice, turisti..." /></label>
          <label>Glavni cilj<select value={form.social_goal} onChange={(e) => setForm({ ...form, social_goal: e.target.value })}><option value="reservations">Više rezervacija</option><option value="walk_ins">Više dolazaka</option><option value="delivery">Više porudžbina</option><option value="awareness">Prepoznatljivost</option></select></label>
          <label>Hashtag strategija<select value={form.hashtag_mode} onChange={(e) => setForm({ ...form, hashtag_mode: e.target.value })}><option value="smart">Smart — automatski balans</option><option value="local">Local focus</option><option value="balanced">Balanced</option><option value="minimal">Minimal</option></select></label>
          <label>Stil brenda<select value={form.brand_style} onChange={(e) => setForm({ ...form, brand_style: e.target.value })}><option value="modern">Moderan</option><option value="premium">Premium</option><option value="traditional">Tradicionalan</option><option value="fast_food">Fast food</option><option value="casual">Casual</option></select></label>
          <label>Ton komunikacije<select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}><option value="friendly">Prijateljski</option><option value="premium">Premium</option><option value="playful">Razigran</option><option value="traditional">Tradicionalan</option><option value="direct">Direktan</option></select></label>
          <label>Objava nedeljno<select value={form.posting_frequency} onChange={(e) => setForm({ ...form, posting_frequency: e.target.value })}>{[3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Instagram<input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@bellanapoli" /></label>
          <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+381…" /></label>
          <label>Primarna boja<input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></label>
          <button className="primary span-2 onboarding-submit" disabled={working}><Sparkles size={17} /> {working ? 'Kreiram…' : 'Pokreni moj Autopilot'}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  )
}
