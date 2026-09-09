import { ChangeEvent, FormEvent, useState } from 'react'
import { Image as ImageIcon, Plus, Trash2, Upload, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Restaurant } from '../types'

export function MenuManager({ restaurant, userId, items, onChanged, setNotice }: {
  restaurant: Restaurant
  userId: string
  items: MenuItem[]
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', currency: 'RSD' })
  const [image, setImage] = useState<File | null>(null)
  const [working, setWorking] = useState(false)
  const [workingId, setWorkingId] = useState('')

  async function uploadImage(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${restaurant.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: false, contentType: file.type || undefined })
    if (error) throw error
    return supabase.storage.from('restaurant-assets').getPublicUrl(path).data.publicUrl
  }

  async function addItem(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setNotice('')
    try {
      const imageUrl = image ? await uploadImage(image) : null
      const { error } = await supabase.from('menu_items').insert({
        restaurant_id: restaurant.id,
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        price: form.price ? Number(form.price) : null,
        currency: form.currency,
        image_url: imageUrl,
      })
      if (error) throw error
      setForm({ name: '', description: '', category: '', price: '', currency: 'RSD' })
      setImage(null)
      setNotice('Jelo je dodato u meni.')
      await onChanged()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Greška pri dodavanju jela.')
    }
    setWorking(false)
  }

  async function toggleItem(item: MenuItem) {
    setWorkingId(item.id)
    const { error } = await supabase.from('menu_items').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) setNotice(error.message)
    else await onChanged()
    setWorkingId('')
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Obriši „${item.name}“ iz menija?`)) return
    setWorkingId(item.id)
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Jelo je obrisano.')
      await onChanged()
    }
    setWorkingId('')
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setNotice('Fotografija može imati najviše 8 MB.')
      return
    }
    setImage(file)
  }

  return (
    <>
      <header className="page-header"><div><p className="eyebrow">MENI</p><h1>Jela i proizvodi</h1><p className="muted">Fotografije i podaci iz menija su gorivo za Autopilot.</p></div></header>
      <div className="menu-layout">
        <form className="panel add-menu-form" onSubmit={addItem}>
          <h2><Plus size={19} /> Dodaj jelo</h2>
          <label>Naziv<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pizza Capricciosa" /></label>
          <label>Kategorija<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Pizza" /></label>
          <div className="price-grid">
            <label>Cena<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="890" /></label>
            <label>Valuta<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>RSD</option><option>EUR</option><option>BAM</option><option>MKD</option></select></label>
          </div>
          <label>Opis<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Pelat, mozzarella, šunka, pečurke…" rows={4} /></label>
          <label className="upload-box"><Upload size={18} /><span>{image ? image.name : 'Dodaj fotografiju jela'}</span><input className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} /></label>
          <button className="primary full" disabled={working}>{working ? 'Dodajem…' : 'Dodaj u meni'}</button>
        </form>

        <section className="panel">
          <div className="panel-heading"><h2>Trenutni meni <span className="pill">{items.length}</span></h2><small>{items.filter((item) => item.is_active).length} aktivno</small></div>
          <div className="menu-list">
            {items.length === 0 ? <div className="empty-small">Još nema jela.</div> : items.map((item) => (
              <div className={`menu-row ${item.is_active ? '' : 'inactive'}`} key={item.id}>
                {item.image_url ? <img className="food-thumb" src={item.image_url} alt="" /> : <div className="food-icon"><ImageIcon size={18} /></div>}
                <div className="menu-copy"><strong>{item.name}</strong><small>{item.category || 'Bez kategorije'}{item.description ? ` · ${item.description}` : ''}</small></div>
                <div className="menu-right">
                  <div className="price">{item.price ? `${item.price} ${item.currency}` : '—'}</div>
                  <div className="row-actions">
                    <button className="mini-button" disabled={workingId === item.id} onClick={() => toggleItem(item)} type="button">{item.is_active ? 'Aktivno' : 'Pauzirano'}</button>
                    <button className="danger-icon" disabled={workingId === item.id} onClick={() => deleteItem(item)} type="button" title="Obriši"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
