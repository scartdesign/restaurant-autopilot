import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { Hash, Image as ImageIcon, MapPin, Palette, Save, Settings, Share2, Target, Trash2, Upload } from 'lucide-react'
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
    neighborhood: restaurant.neighborhood || '',
    country: restaurant.country || 'Serbia',
    cuisine_type: restaurant.cuisine_type || '',
    phone: restaurant.phone || '',
    website: restaurant.website || '',
    instagram: restaurant.instagram || '',
    facebook: restaurant.facebook || '',
    reservation_url: restaurant.reservation_url || '',
    description: restaurant.description || '',
    target_audience: restaurant.target_audience || '',
    social_goal: restaurant.social_goal || 'reservations',
    hashtag_mode: restaurant.hashtag_mode || 'smart',
    brand_style: restaurant.brand_style,
    tone: restaurant.tone,
    posting_frequency: String(restaurant.posting_frequency || 5),
    primary_color: restaurant.primary_color || '#17211b',
    secondary_color: restaurant.secondary_color || '#b9df72',
  })
  const [working, setWorking] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState(restaurant.logo_url || '')

  const setupScore = useMemo(() => [form.city, form.cuisine_type, form.instagram, form.description, form.target_audience, logoPreview].filter(Boolean).length, [form, logoPreview])

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setNotice('Logo mora biti PNG, JPG, WEBP ili SVG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice('Logo može imati najviše 5 MB.')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function uploadLogo(file: File) {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) throw new Error('Nalog nije dostupan za upload logotipa.')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${authData.user.id}/${restaurant.id}/brand/logo-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: false, contentType: file.type || undefined })
    if (uploadError) throw uploadError
    return supabase.storage.from('restaurant-assets').getPublicUrl(path).data.publicUrl
  }

  async function removeLogo() {
    setWorking(true)
    const { error } = await supabase.from('restaurants').update({ logo_url: null }).eq('id', restaurant.id)
    if (error) setNotice(error.message)
    else {
      setLogoFile(null)
      setLogoPreview('')
      setNotice('Logo je uklonjen iz brenda.')
      await onSaved()
    }
    setWorking(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setNotice('')
    try {
      const uploadedLogo = logoFile ? await uploadLogo(logoFile) : undefined
      const payload: Record<string, unknown> = {
        name: form.name,
        city: form.city || null,
        neighborhood: form.neighborhood || null,
        country: form.country || 'Serbia',
        cuisine_type: form.cuisine_type || null,
        phone: form.phone || null,
        website: form.website || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        reservation_url: form.reservation_url || null,
        description: form.description || null,
        target_audience: form.target_audience || null,
        social_goal: form.social_goal,
        hashtag_mode: form.hashtag_mode,
        brand_style: form.brand_style,
        tone: form.tone,
        posting_frequency: Number(form.posting_frequency),
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      }
      if (uploadedLogo) payload.logo_url = uploadedLogo
      const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurant.id)
      if (error) throw error
      if (uploadedLogo) {
        setLogoPreview(uploadedLogo)
        setLogoFile(null)
      }
      setNotice('Podešavanja su sačuvana. Sadržaj i Visual Studio sada koriste novi brend profil.')
      await onSaved()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Greška pri čuvanju podešavanja.')
    }
    setWorking(false)
  }

  return (
    <>
      <header className="page-header settings-header">
        <div><p className="eyebrow">AUTOPILOT SETUP</p><h1>Podešavanja</h1><p className="muted">Što preciznije podesimo restoran, to su objave, lokalni reach i gotovi vizuali bolji.</p></div>
        <div className="setup-score"><span>Setup score</span><strong>{setupScore}/6</strong></div>
      </header>

      <form className="settings-pro" onSubmit={submit}>
        <section className="settings-section panel">
          <div className="settings-section-head"><div className="settings-icon"><Settings size={19} /></div><div><h2>Osnovni podaci</h2><p>Identitet, kontakt i ono po čemu vas gosti pamte.</p></div></div>
          <div className="grid-form settings-grid no-top">
            <label>Naziv restorana<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Tip kuhinje<input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} placeholder="Italijanska, domaća, burger..." /></label>
            <label className="span-2">Opis restorana<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ambijent, specijaliteti, tradicija, šta vas izdvaja..." /></label>
            <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+381..." /></label>
            <label>Sajt<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></label>
          </div>
        </section>

        <section className="settings-section panel">
          <div className="settings-section-head"><div className="settings-icon"><MapPin size={19} /></div><div><h2>Lokalni discovery</h2><p>Za restoran je lokalna namera vrednija od generičkog globalnog reach-a.</p></div></div>
          <div className="grid-form settings-grid no-top">
            <label>Grad<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Beograd" /></label>
            <label>Kraj / naselje<input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Vračar, Centar..." /></label>
            <label>Država<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></label>
            <label>Ciljna publika<input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="Parovi 25–45, porodice, turisti..." /></label>
          </div>
          <div className="smart-note"><Hash size={17} /><div><strong>Smart Discovery v2</strong><span>Autopilot kombinuje brend + grad/kraj + tip kuhinje + konkretno jelo. Instagram dobija fokusiran set relevantnih tagova, Facebook samo 2–3 najkorisnija.</span></div></div>
        </section>

        <section className="settings-section panel">
          <div className="settings-section-head"><div className="settings-icon"><Target size={19} /></div><div><h2>Cilj i automatizacija</h2><p>Tekst i CTA se menjaju prema tome šta želiš da gost uradi.</p></div></div>
          <div className="grid-form settings-grid no-top">
            <label>Glavni cilj<select value={form.social_goal} onChange={(e) => setForm({ ...form, social_goal: e.target.value as Restaurant['social_goal'] })}><option value="reservations">Više rezervacija</option><option value="walk_ins">Više dolazaka u restoran</option><option value="delivery">Više porudžbina / dostave</option><option value="awareness">Prepoznatljivost brenda</option></select></label>
            <label>Hashtag strategija<select value={form.hashtag_mode} onChange={(e) => setForm({ ...form, hashtag_mode: e.target.value as Restaurant['hashtag_mode'] })}><option value="smart">Smart — automatski balans</option><option value="local">Local — maksimalan lokalni fokus</option><option value="balanced">Balanced — lokalno + niša + širi reach</option><option value="minimal">Minimal — 5 najrelevantnijih</option></select></label>
            <label>Objava nedeljno<select value={form.posting_frequency} onChange={(e) => setForm({ ...form, posting_frequency: e.target.value })}>{[3,4,5,6,7].map((n) => <option value={n} key={n}>{n} objava</option>)}</select></label>
            <label>Ton<select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value as Restaurant['tone'] })}><option value="friendly">Prijateljski</option><option value="premium">Premium</option><option value="playful">Razigran</option><option value="traditional">Tradicionalan</option><option value="direct">Direktan</option></select></label>
          </div>
        </section>

        <section className="settings-section panel">
          <div className="settings-section-head"><div className="settings-icon"><Share2 size={19} /></div><div><h2>Kanali i konverzija</h2><p>Linkovi se koriste za CTA, rezervacije i platform-specific tekst.</p></div></div>
          <div className="grid-form settings-grid no-top">
            <label>Instagram<input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@restoran" /></label>
            <label>Facebook<input value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="facebook.com/restoran" /></label>
            <label className="span-2">Link za rezervacije<input value={form.reservation_url} onChange={(e) => setForm({ ...form, reservation_url: e.target.value })} placeholder="https://…" /></label>
          </div>
        </section>

        <section className="settings-section panel">
          <div className="settings-section-head"><div className="settings-icon"><Palette size={19} /></div><div><h2>Vizuelni identitet</h2><p>Logo i boje direktno ulaze u Visual Studio i svaki export.</p></div></div>
          <div className="brand-identity-grid">
            <div className="brand-logo-control">
              <div className="brand-logo-preview">{logoPreview ? <img src={logoPreview} alt="Logo preview" /> : <ImageIcon size={28} />}</div>
              <div className="brand-logo-copy"><strong>Logo restorana</strong><span>Najbolje PNG/SVG sa transparentnom pozadinom. Koristi se u gotovim feed i story vizualima.</span><div className="brand-logo-actions"><label className="mini-upload"><Upload size={15} /> {logoPreview ? 'Promeni logo' : 'Dodaj logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={chooseLogo} /></label>{restaurant.logo_url && <button type="button" className="mini-remove" onClick={removeLogo} disabled={working}><Trash2 size={14} /> Ukloni</button>}</div></div>
            </div>
            <div className="visual-fields">
              <label>Stil brenda<select value={form.brand_style} onChange={(e) => setForm({ ...form, brand_style: e.target.value as Restaurant['brand_style'] })}><option value="modern">Moderan</option><option value="premium">Premium</option><option value="traditional">Tradicionalan</option><option value="fast_food">Fast food</option><option value="casual">Casual</option></select></label>
              <div className="color-pair"><label>Primarna<input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></label><label>Akcent<input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} /></label></div>
            </div>
          </div>
        </section>

        <div className="settings-savebar"><div><strong>Autopilot profil restorana</strong><span>Sačuvaj i sledeća generacija odmah koristi nova pravila.</span></div><button className="primary" disabled={working}><Save size={17} /> {working ? 'Čuvam…' : 'Sačuvaj sva podešavanja'}</button></div>
      </form>
    </>
  )
}
