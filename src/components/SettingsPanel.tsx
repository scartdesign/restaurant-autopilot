import { FormEvent, useState } from 'react'
import { Save, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'

export function SettingsPanel({ restaurant, onSaved, setNotice }: {
  restaurant: Restaurant
  onSaved: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [form, setForm] = useState({
    name: restaurant.name,
    city: restaurant.city || '',
    cuisine_type: restaurant.cuisine_type || '',
    phone: restaurant.phone || '',
    website: restaurant.website || '',
    instagram: restaurant.instagram || '',
    facebook: restaurant.facebook || '',
    reservation_url: restaurant.reservation_url || '',
    description: restaurant.description || '',
    brand_style: restaurant.brand_style,
    tone: restaurant.tone,
    posting_frequency: String(restaurant.posting_frequency || 5),
    primary_color: restaurant.primary_color || '#17211b',
    secondary_color: restaurant.secondary_color || '#b9df72',
  })
  const [working, setWorking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    const { error } = await supabase.from('restaurants').update({
      name: form.name,
      city: form.city || null,
      cuisine_type: form.cuisine_type || null,
      phone: form.phone || null,
      website: form.website || null,
      instagram: form.instagram || null,
      facebook: form.facebook || null,
      reservation_url: form.reservation_url || null,
      description: form.description || null,
      brand_style: form.brand_style,
      tone: form.tone,
      posting_frequency: Number(form.posting_frequency),
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
    }).eq('id', restaurant.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Podešavanja restorana su sačuvana.')
      await onSaved()
    }
    setWorking(false)
  }

  return (
    <>
      <header className="page-header"><div><p className="eyebrow">BREND</p><h1>Podešavanja</h1><p className="muted">Autopilot koristi ove podatke kada planira i piše sadržaj.</p></div></header>
      <form className="panel settings-form" onSubmit={submit}>
        <h2><Settings size={20} /> Restoran i komunikacija</h2>
        <div className="grid-form settings-grid">
          <label>Naziv<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Grad<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label>Tip kuhinje<input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} /></label>
          <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Sajt<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></label>
          <label>Rezervacije<input value={form.reservation_url} onChange={(e) => setForm({ ...form, reservation_url: e.target.value })} placeholder="Link za rezervaciju" /></label>
          <label>Instagram<input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></label>
          <label>Facebook<input value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} /></label>
          <label>Stil brenda<select value={form.brand_style} onChange={(e) => setForm({ ...form, brand_style: e.target.value as Restaurant['brand_style'] })}><option value="modern">Moderan</option><option value="premium">Premium</option><option value="traditional">Tradicionalan</option><option value="fast_food">Fast food</option><option value="casual">Casual</option></select></label>
          <label>Ton<select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value as Restaurant['tone'] })}><option value="friendly">Prijateljski</option><option value="premium">Premium</option><option value="playful">Razigran</option><option value="traditional">Tradicionalan</option><option value="direct">Direktan</option></select></label>
          <label>Objava nedeljno<select value={form.posting_frequency} onChange={(e) => setForm({ ...form, posting_frequency: e.target.value })}>{[3,4,5,6,7].map((n) => <option value={n} key={n}>{n}</option>)}</select></label>
          <div className="color-pair"><label>Primarna boja<input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></label><label>Sekundarna<input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} /></label></div>
          <label className="span-2">Opis restorana<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Šta vas izdvaja, za koga kuvate, šta želite da gosti zapamte…" /></label>
        </div>
        <button className="primary" disabled={working}><Save size={17} /> {working ? 'Čuvam…' : 'Sačuvaj podešavanja'}</button>
      </form>
    </>
  )
}
