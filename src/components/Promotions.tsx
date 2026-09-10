import { FormEvent, useMemo, useState } from 'react'
import { Bike, Clock3, Facebook, Hash, Heart, Image as ImageIcon, Instagram, Megaphone, Search, Sparkles, Utensils, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Restaurant } from '../types'

const presets = [
  { key: 'lunch', label: 'Lunch meni', icon: Utensils, title: 'Lunch meni', discountText: 'Specijalna ponuda za ručak', description: 'Radnim danima od 12h do 16h. Istakni 2–3 najjača jela i brz servis.' },
  { key: 'happy', label: 'Happy hour', icon: Clock3, title: 'Happy hour', discountText: 'Posebna cena u odabranom terminu', description: 'Kratka vremenska ponuda koja pravi razlog da gosti dođu ranije.' },
  { key: 'weekend', label: 'Vikend akcija', icon: Sparkles, title: 'Vikend specijal', discountText: 'Vikend ponuda ograničenog trajanja', description: 'Petak i subota. Istakni jelo ili paket koji ima najveći vizuelni efekat.' },
  { key: 'delivery', label: 'Dostava', icon: Bike, title: 'Dostava bez čekanja', discountText: 'Poruči omiljena jela', description: 'Fokus na jednostavno poručivanje, brzinu i jasan poziv na akciju.' },
  { key: 'date', label: 'Večera za dvoje', icon: Heart, title: 'Veče za dvoje', discountText: 'Posebna ponuda za dvoje', description: 'Večernji termin, premium atmosfera i jasan poziv na rezervaciju.' },
] as const

export function Promotions({ restaurant, menuItems, onChanged, setNotice }: {
  restaurant: Restaurant
  menuItems: MenuItem[]
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const visualItems = useMemo(() => menuItems.filter((item) => item.is_active && item.image_url), [menuItems])
  const [form, setForm] = useState({ title: '', discountText: '', description: '', startsAt: '', endsAt: '', menuItemId: visualItems[0]?.id || '' })
  const [working, setWorking] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('')
  const selectedItem = visualItems.find((item) => item.id === form.menuItemId) || visualItems[0]

  function applyPreset(preset: typeof presets[number]) {
    setSelectedPreset(preset.key)
    setForm((current) => ({ ...current, title: preset.title, discountText: preset.discountText, description: preset.description }))
    setNotice(`Predlog „${preset.label}“ je ubačen. Prilagodi detalje svojoj stvarnoj ponudi.`)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setNotice('')
    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: {
        action: 'promotion',
        restaurantId: restaurant.id,
        menuItemId: form.menuItemId || undefined,
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
      setNotice('Kampanja je napravljena: dizajnirani feed + story, IG/FB tekst i discovery čekaju pregled.')
      setForm({ title: '', discountText: '', description: '', startsAt: '', endsAt: '', menuItemId: visualItems[0]?.id || '' })
      setSelectedPreset('')
      await onChanged()
    }
    setWorking(false)
  }

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">CAMPAIGN AUTOPILOT</p><h1>Napravi akciju</h1><p className="muted">Jedan unos pretvaramo u dizajnirani feed, story, CTA i platform-specific discovery.</p></div>
        <span className="engine-badge"><Zap size={14} /> Smart campaign</span>
      </header>

      <section className="campaign-presets">
        <div className="preset-intro"><strong>Brzi start</strong><span>Izaberi tip kampanje ili kreni od praznog formulara.</span></div>
        <div className="preset-grid">{presets.map((preset) => { const Icon = preset.icon; return <button type="button" key={preset.key} className={selectedPreset === preset.key ? 'active' : ''} onClick={() => applyPreset(preset)}><Icon size={16} /><span>{preset.label}</span></button> })}</div>
      </section>

      <div className="promo-layout promo-layout-pro">
        <form className="panel promo-form promo-form-pro" onSubmit={submit}>
          <div className="promo-form-title"><div className="settings-icon"><Megaphone size={19} /></div><div><h2>Nova kampanja</h2><p>Upiši stvarnu ponudu i izaberi fotografiju koja je prodaje.</p></div></div>
          <label>Naziv akcije<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Vikend pasta" /></label>
          <label>Glavna poruka<input value={form.discountText} onChange={(e) => setForm({ ...form, discountText: e.target.value })} placeholder="20% popusta na sve paste" /></label>
          <label>Detalji<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Petak i subota od 18h. Važi u restoranu." /></label>

          <div className="campaign-photo-picker">
            <div className="campaign-photo-preview">{selectedItem?.image_url ? <img src={selectedItem.image_url} alt="" /> : <ImageIcon size={27} />}</div>
            <label>Fotografija kampanje
              <select value={form.menuItemId} onChange={(e) => setForm({ ...form, menuItemId: e.target.value })}>
                {visualItems.length ? visualItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">Nema jela sa fotografijom</option>}
              </select>
              <small>{visualItems.length ? 'Ova realna fotografija ide u oba dizajna.' : 'Dodaj fotografiju u Meni za ozbiljan promo vizual.'}</small>
            </label>
          </div>

          <div className="grid-form compact-grid">
            <label>Početak<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
            <label>Kraj<input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
          </div>
          <div className="campaign-output-list"><span><Instagram size={14} /> Instagram feed + discovery</span><span><Facebook size={14} /> Facebook clean copy</span><span><Search size={14} /> Search keywords</span><span><Hash size={14} /> Lokalni + niche tagovi</span></div>
          <button className="primary full campaign-button" disabled={working}><Sparkles size={18} /> {working ? 'Pravim kampanju…' : 'Napravi celu kampanju'}</button>
        </form>
        <aside className="promo-explainer promo-explainer-pro">
          <p className="eyebrow">AUTOPILOT OUTPUT</p>
          <h2>Od jedne akcije do sadržaja koji možeš stvarno da objaviš.</h2>
          <p>Feed dobija prodajni 4:5 layout, Story jači vertikalni poster, a fotografija ostaje ista realna fotografija iz restorana. Tekst i discovery su odvojeni po mrežama.</p>
          <div className="campaign-stack">
            <div><span>01</span><strong>Feed 4:5 · Bold</strong><small>1080 × 1350 · fotografija · headline · CTA</small></div>
            <div><span>02</span><strong>Story 9:16 · Poster</strong><small>1080 × 1920 · kratka poruka · jak CTA</small></div>
            <div><span>03</span><strong>Discovery</strong><small>IG fokusiran set · FB 2–3 taga · search keywords</small></div>
          </div>
        </aside>
      </div>
    </>
  )
}
