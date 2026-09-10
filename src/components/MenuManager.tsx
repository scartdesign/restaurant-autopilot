import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Image as ImageIcon, Plus, Sparkles, Trash2, Upload, WandSparkles } from 'lucide-react'
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
  const [aiWorkingId, setAiWorkingId] = useState('')
  const photoCoverage = useMemo(() => items.length ? Math.round((items.filter((item) => item.image_url).length / items.length) * 100) : 0, [items])

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
      const { data, error } = await supabase.from('menu_items').insert({
        restaurant_id: restaurant.id,
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        price: form.price ? Number(form.price) : null,
        currency: form.currency,
        image_url: imageUrl,
      }).select('id,name,image_url').single()
      if (error) throw error
      setForm({ name: '', description: '', category: '', price: '', currency: 'RSD' })
      setImage(null)
      setNotice(data?.image_url ? 'Jelo je dodato u meni.' : `Jelo „${data?.name || 'novo jelo'}“ je dodato. Ako nemaš fotografiju, klikni AI slika pored jela.`)
      await onChanged()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Greška pri dodavanju jela.')
    }
    setWorking(false)
  }

  async function generateAiImage(item: MenuItem, style = 'photoreal') {
    setAiWorkingId(item.id)
    setNotice(`AI generiše realističnu fotografiju za „${item.name}“…`)
    const { data, error } = await supabase.functions.invoke('creative-image', {
      body: { action: 'generate', restaurantId: restaurant.id, menuItemId: item.id, style },
    })
    if (error) setNotice(error.message)
    else if (data?.error) setNotice(data.error)
    else {
      setNotice(`AI fotografija za „${item.name}“ je napravljena i sačuvana u meniju.`)
      await onChanged()
    }
    setAiWorkingId('')
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setNotice('CSV fajl može imati najviše 3 MB.')
      return
    }
    setWorking(true)
    setNotice('Čitam meni iz CSV fajla…')
    try {
      const text = await file.text()
      const parsed = parseMenuCsv(text)
      if (!parsed.length) throw new Error('Nisam našao nijedno validno jelo. Proveri kolone u CSV fajlu.')
      const payload = parsed.slice(0, 500).map((row) => ({
        restaurant_id: restaurant.id,
        name: row.name,
        description: row.description || null,
        category: row.category || null,
        price: row.price === '' ? null : Number(row.price),
        currency: row.currency || 'RSD',
        is_active: true,
      }))
      if (payload.some((row) => row.price !== null && Number.isNaN(row.price))) throw new Error('Jedna ili više cena nisu broj. Koristi npr. 890 ili 12.50.')
      const { error } = await supabase.from('menu_items').insert(payload)
      if (error) throw error
      setNotice(`Uvezeno je ${payload.length} stavki. Za jela bez fotografije sada možeš koristiti AI sliku direktno iz menija.`)
      await onChanged()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Greška pri uvozu menija.')
    }
    setWorking(false)
  }

  function downloadTemplate() {
    const csv = 'naziv;opis;kategorija;cena;valuta\nPizza Capricciosa;Pelat, mozzarella, šunka, pečurke;Pizza;890;RSD\nCarbonara;Guanciale, jaje, pecorino;Pasta;940;RSD\n'
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'restaurant-autopilot-menu-template.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    setNotice('CSV šablon je preuzet. Popuni ga i vrati kroz „Uvezi CSV“.')
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
      <header className="page-header menu-header-pro">
        <div><p className="eyebrow">MENI</p><h1>Jela i proizvodi</h1><p className="muted">Fotografije i podaci iz menija su gorivo za tekst, discovery i gotove vizuale. Nemaš fotografiju? Autopilot može da generiše realističnu AI food fotografiju.</p></div>
        <div className="menu-health"><span>Photo coverage</span><strong>{photoCoverage}%</strong><small>{items.filter((item) => item.image_url).length}/{items.length || 0} sa fotografijom</small></div>
      </header>

      <div className="menu-import-bar">
        <div className="menu-import-copy"><FileSpreadsheet size={20} /><div><strong>Imaš veći meni?</strong><span>Uvezi do 500 jela odjednom iz CSV-a. Prihvatamo kolone naziv/opis/kategorija/cena/valuta.</span></div></div>
        <div className="menu-import-actions"><button type="button" className="secondary" onClick={downloadTemplate}><Download size={16} /> CSV šablon</button><label className="primary csv-upload"><Upload size={16} /> Uvezi CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label></div>
      </div>

      <div className="menu-ai-tip"><Sparkles size={18}/><div><strong>AI Food Photo</strong><span>Za svako jelo bez slike možeš jednim klikom napraviti realističnu fotografiju hrane. Slika se automatski čuva i odmah postaje dostupna u Visual Studiju i kampanjama.</span></div></div>

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
          <label className="upload-box"><Upload size={18} /><span>{image ? image.name : 'Dodaj fotografiju jela (opciono)'}</span><input className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} /></label>
          {!image && <div className="form-ai-note"><WandSparkles size={15}/> Možeš dodati jelo bez fotografije i zatim kliknuti „AI slika“.</div>}
          <button className="primary full" disabled={working}>{working ? 'Radim…' : 'Dodaj u meni'}</button>
        </form>

        <section className="panel">
          <div className="panel-heading"><h2>Trenutni meni <span className="pill">{items.length}</span></h2><small>{items.filter((item) => item.is_active).length} aktivno</small></div>
          <div className="menu-list">
            {items.length === 0 ? <div className="empty-small">Još nema jela. Možeš ručno da dodaš prvo ili da uvezeš ceo CSV.</div> : items.map((item) => (
              <div className={`menu-row ${item.is_active ? '' : 'inactive'}`} key={item.id}>
                {item.image_url ? <img className="food-thumb" src={item.image_url} alt="" /> : <div className="food-icon"><ImageIcon size={18} /></div>}
                <div className="menu-copy"><strong>{item.name}</strong><small>{item.category || 'Bez kategorije'}{item.description ? ` · ${item.description}` : ''}</small>{!item.image_url && <span className="no-photo-label">Nema slike · AI može da je napravi</span>}</div>
                <div className="menu-right">
                  <div className="price">{item.price ? `${item.price} ${item.currency}` : '—'}</div>
                  <div className="row-actions">
                    <button className={`mini-button ai-photo-button ${item.image_url ? 'has-photo' : ''}`} disabled={aiWorkingId === item.id} onClick={() => generateAiImage(item)} type="button"><WandSparkles size={13}/>{aiWorkingId === item.id ? 'AI radi…' : item.image_url ? 'AI nova' : 'AI slika'}</button>
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

type CsvMenuRow = { name: string; description: string; category: string; price: string; currency: string }

function parseMenuCsv(text: string): CsvMenuRow[] {
  const rows = text.replace(/^\ufeff/, '').split(/\r?\n/).filter((line) => line.trim())
  if (rows.length < 2) return []
  const delimiter = detectDelimiter(rows[0])
  const rawHeaders = splitCsvLine(rows[0], delimiter).map((value) => normalizeHeader(value))
  const keys = rawHeaders.map((header) => {
    if (['name','naziv','jelo','proizvod'].includes(header)) return 'name'
    if (['description','opis','sastav'].includes(header)) return 'description'
    if (['category','kategorija','grupa'].includes(header)) return 'category'
    if (['price','cena','cijena'].includes(header)) return 'price'
    if (['currency','valuta'].includes(header)) return 'currency'
    return ''
  })
  const nameIndex = keys.indexOf('name')
  if (nameIndex < 0) throw new Error('CSV mora imati kolonu „naziv“ ili „name“.')

  return rows.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter)
    const result: CsvMenuRow = { name: '', description: '', category: '', price: '', currency: 'RSD' }
    keys.forEach((key, index) => {
      if (!key) return
      const value = (cells[index] || '').trim()
      if (key === 'name') result.name = value
      if (key === 'description') result.description = value
      if (key === 'category') result.category = value
      if (key === 'price') result.price = value.replace(',', '.')
      if (key === 'currency') result.currency = value.toUpperCase() || 'RSD'
    })
    return result
  }).filter((row) => row.name)
}

function detectDelimiter(line: string) {
  const semicolons = (line.match(/;/g) || []).length
  const commas = (line.match(/,/g) || []).length
  return semicolons >= commas ? ';' : ','
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1 }
      else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current)
      current = ''
    } else current += char
  }
  cells.push(current)
  return cells
}
