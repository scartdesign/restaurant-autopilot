import { type ChangeEvent, type CSSProperties, type DragEvent, useMemo, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Image as ImageIcon, Palette, RefreshCcw, Save, Sparkles, Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { LogoBadge, LogoPosition, LogoSize, MenuItem, Restaurant } from '../types'

type BrandState = {
  primary: string
  accent: string
  visible: boolean
  position: LogoPosition
  size: LogoSize
  badge: LogoBadge
  overlay: number
}

const palettes = [
  { name: 'Luxe', primary: '#171512', accent: '#d5bb76' },
  { name: 'Italiano', primary: '#173a2b', accent: '#e7c35f' },
  { name: 'Modern', primary: '#16211b', accent: '#b9df72' },
  { name: 'Urban', primary: '#16181d', accent: '#ffb454' },
  { name: 'Bistro', primary: '#3a1717', accent: '#f0c56d' },
] as const

const positionLabels: Record<LogoPosition, string> = {
  'top-left': 'Gore levo',
  'top-right': 'Gore desno',
  'top-center': 'Gore centar',
  'bottom-left': 'Dole levo',
  'bottom-right': 'Dole desno',
}

export function BrandKit({ restaurant, menuItems = [], onSaved, setNotice, demo = false }: {
  restaurant: Restaurant
  menuItems?: MenuItem[]
  onSaved: () => Promise<void>
  setNotice: (value: string) => void
  demo?: boolean
}) {
  const [state, setState] = useState<BrandState>({
    primary: restaurant.primary_color || '#17211b',
    accent: restaurant.secondary_color || '#b9df72',
    visible: restaurant.default_logo_visible ?? true,
    position: restaurant.default_logo_position || 'top-right',
    size: restaurant.default_logo_size || 'm',
    badge: restaurant.default_logo_badge || 'white',
    overlay: Number(restaurant.default_overlay_strength ?? .68),
  })
  const [logoPreview, setLogoPreview] = useState(restaurant.logo_url || '')
  const [working, setWorking] = useState(false)
  const [dragging, setDragging] = useState(false)

  const previewPhoto = useMemo(() => menuItems.find((item) => item.is_active && item.image_url)?.image_url || '', [menuItems])
  const contrast = contrastRatio(state.primary, state.accent)
  const readyScore = Math.min(100, 55 + (logoPreview ? 20 : 0) + (contrast >= 2.2 ? 10 : 0) + (state.visible ? 5 : 0) + 10)

  async function handleFile(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setNotice('Logo mora biti PNG, JPG, WEBP ili SVG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice('Logo može imati najviše 5 MB.')
      return
    }

    const localUrl = URL.createObjectURL(file)
    setLogoPreview(localUrl)
    setState((current) => ({ ...current, visible: true }))

    if (demo) {
      setNotice('Demo logo je ubačen lokalno. Na pravom nalogu se odmah čuva u Brand Kitu.')
      return
    }

    setWorking(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('Nalog nije dostupan za upload logotipa.')
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${authData.user.id}/${restaurant.id}/brand/logo-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (uploadError) throw uploadError
      const publicUrl = supabase.storage.from('restaurant-assets').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('restaurants').update({ logo_url: publicUrl, default_logo_visible: true }).eq('id', restaurant.id)
      if (error) throw error
      setLogoPreview(publicUrl)
      setNotice('Logo je ubačen i odmah je dostupan u svim budućim vizualima.')
      await onSaved()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Nisam uspeo da sačuvam logo.')
    }
    setWorking(false)
  }

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void handleFile(file)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  async function removeLogo() {
    setLogoPreview('')
    if (demo) {
      setNotice('Demo logo je uklonjen.')
      return
    }
    setWorking(true)
    const { error } = await supabase.from('restaurants').update({ logo_url: null }).eq('id', restaurant.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Logo je uklonjen iz Brand Kita.')
      await onSaved()
    }
    setWorking(false)
  }

  async function saveBrand() {
    if (demo) {
      setNotice('Demo Brand Kit je sačuvan lokalno. Na pravom nalogu ovo postaje default za sve nove objave.')
      return
    }
    setWorking(true)
    const { error } = await supabase.from('restaurants').update({
      primary_color: state.primary,
      secondary_color: state.accent,
      default_logo_visible: state.visible,
      default_logo_position: state.position,
      default_logo_size: state.size,
      default_logo_badge: state.badge,
      default_overlay_strength: state.overlay,
    }).eq('id', restaurant.id)
    if (error) setNotice(error.message)
    else {
      setNotice('Brand Kit je sačuvan. Visual Studio i novi vizuali koriste ova pravila.')
      await onSaved()
    }
    setWorking(false)
  }

  function resetBrand() {
    setState({
      primary: restaurant.primary_color || '#17211b',
      accent: restaurant.secondary_color || '#b9df72',
      visible: restaurant.default_logo_visible ?? true,
      position: restaurant.default_logo_position || 'top-right',
      size: restaurant.default_logo_size || 'm',
      badge: restaurant.default_logo_badge || 'white',
      overlay: Number(restaurant.default_overlay_strength ?? .68),
    })
    setLogoPreview(restaurant.logo_url || '')
    setNotice('Vraćene su poslednje sačuvane vrednosti Brand Kita.')
  }

  return (
    <>
      <header className="page-header brand-kit-header">
        <div><p className="eyebrow">BRAND KIT</p><h1>Logo i boje restorana.</h1><p className="muted">Ovde ubacuješ logo. Jednom podesiš identitet, a Autopilot ga koristi kroz feed, story i promo vizuale.</p></div>
        <div className={`brand-ready ${readyScore >= 90 ? 'great' : ''}`}><Sparkles size={18} /><div><span>Brand readiness</span><strong>{readyScore}%</strong></div></div>
      </header>

      <div className="brand-kit-layout">
        <section className="brand-kit-controls">
          <div className="brand-kit-panel brand-upload-panel">
            <div className="brand-panel-heading"><div className="brand-step">1</div><div><h2>Ubaci logo</h2><p>PNG ili SVG sa transparentnom pozadinom daje najbolji rezultat.</p></div></div>
            <div
              className={`brand-dropzone ${dragging ? 'dragging' : ''} ${logoPreview ? 'has-logo' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="brand-drop-preview">{logoPreview ? <img src={logoPreview} alt="Logo restorana" /> : <ImageIcon size={38} />}</div>
              <div className="brand-drop-copy"><strong>{logoPreview ? 'Logo je spreman' : 'Prevuci logo ovde'}</strong><span>ili klikni na dugme ispod</span></div>
              <div className="brand-drop-actions">
                <label className="primary brand-upload-button"><Upload size={16} /> {logoPreview ? 'Promeni logo' : 'Izaberi logo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={chooseLogo} /></label>
                {logoPreview && <button type="button" className="brand-delete-button" onClick={() => void removeLogo()} disabled={working}><Trash2 size={15} /> Ukloni</button>}
              </div>
            </div>
          </div>

          <div className="brand-kit-panel">
            <div className="brand-panel-heading"><div className="brand-step">2</div><div><h2>Boje brenda</h2><p>Biraj ručno ili kreni od gotove palete.</p></div></div>
            <div className="brand-palette-presets">{palettes.map((palette) => <button type="button" key={palette.name} onClick={() => setState({ ...state, primary: palette.primary, accent: palette.accent })}><i><span style={{ background: palette.primary }} /><span style={{ background: palette.accent }} /></i><b>{palette.name}</b></button>)}</div>
            <div className="brand-color-controls">
              <label>Primarna boja<div className="brand-color-field"><input type="color" value={state.primary} onChange={(event) => setState({ ...state, primary: event.target.value })} /><input value={state.primary} onChange={(event) => setState({ ...state, primary: normalizeHex(event.target.value, state.primary) })} /></div></label>
              <label>Akcent boja<div className="brand-color-field"><input type="color" value={state.accent} onChange={(event) => setState({ ...state, accent: event.target.value })} /><input value={state.accent} onChange={(event) => setState({ ...state, accent: normalizeHex(event.target.value, state.accent) })} /></div></label>
            </div>
            {contrast < 2.2 ? <div className="brand-kit-warning">Boje su previše slične. Izaberi jači kontrast da CTA i cena ostanu čitljivi.</div> : <div className="brand-kit-ok"><CheckCircle2 size={15} /> Kontrast je dobar za social vizuale.</div>}
          </div>

          <div className="brand-kit-panel">
            <div className="brand-panel-heading"><div className="brand-step">3</div><div><h2>Logo na objavi</h2><p>Odredi podrazumevanu poziciju. U Visual Studiju možeš svaku objavu posebno da promeniš.</p></div></div>
            <button type="button" className={`brand-logo-toggle ${state.visible ? 'active' : ''}`} onClick={() => setState({ ...state, visible: !state.visible })}>{state.visible ? <Eye size={17} /> : <EyeOff size={17} />}<span><strong>{state.visible ? 'Logo je uključen' : 'Logo je isključen'}</strong><small>{state.visible ? 'Prikazivaće se na novim objavama.' : 'Vizuali će izlaziti bez logotipa.'}</small></span></button>
            <div className="brand-position-grid">{(Object.keys(positionLabels) as LogoPosition[]).map((position) => <button type="button" key={position} className={state.position === position ? 'active' : ''} onClick={() => setState({ ...state, position })}><i className={`brand-position-dot ${position}`} /><span>{positionLabels[position]}</span></button>)}</div>
            <div className="brand-select-grid">
              <label>Veličina<select value={state.size} onChange={(event) => setState({ ...state, size: event.target.value as LogoSize })}><option value="s">Mali</option><option value="m">Srednji</option><option value="l">Veliki</option></select></label>
              <label>Podloga<select value={state.badge} onChange={(event) => setState({ ...state, badge: event.target.value as LogoBadge })}><option value="none">Bez podloge</option><option value="white">Bela</option><option value="dark">Tamna</option><option value="blur">Glass / blur</option></select></label>
            </div>
            <label className="brand-overlay-slider"><span>Zatamnjenje fotografije <strong>{Math.round(state.overlay * 100)}%</strong></span><input type="range" min="20" max="90" value={Math.round(state.overlay * 100)} onChange={(event) => setState({ ...state, overlay: Number(event.target.value) / 100 })} /></label>
          </div>

          <div className="brand-kit-savebar"><button type="button" className="secondary" onClick={resetBrand}><RefreshCcw size={16} /> Vrati sačuvano</button><button type="button" className="primary" onClick={() => void saveBrand()} disabled={working}><Save size={17} /> {working ? 'Čuvam…' : 'Sačuvaj Brand Kit'}</button></div>
        </section>

        <aside className="brand-kit-preview-column">
          <div className="brand-preview-sticky">
            <div className="brand-preview-top"><div><span>LIVE PREVIEW</span><strong>Feed 4:5</strong></div><div className="brand-colors-mini"><i style={{ background: state.primary }} /><i style={{ background: state.accent }} /></div></div>
            <div className="brand-social-preview" style={{ '--brand-primary': state.primary, '--brand-accent': state.accent, '--brand-overlay': String(state.overlay), backgroundImage: previewPhoto ? `url(${previewPhoto})` : undefined } as CSSProperties}>
              <div className="brand-social-shade" />
              {state.visible && <div className={`brand-social-logo pos-${state.position} size-${state.size} badge-${state.badge}`}>{logoPreview ? <img src={logoPreview} alt="" /> : <span>{restaurant.name.slice(0, 1).toUpperCase()}</span>}</div>}
              <div className="brand-social-copy"><span>CHEF'S PICK</span><h2>Ukus koji se pamti.</h2><p>{restaurant.name} · {restaurant.neighborhood || restaurant.city || 'Tvoj grad'}</p><b>Rezerviši sto →</b></div>
            </div>
            <div className="brand-preview-hints"><span><CheckCircle2 size={14} /> Logo ostaje u safe zoni</span><span><CheckCircle2 size={14} /> Boje idu u CTA, cenu i detalje</span><span><CheckCircle2 size={14} /> Visual Studio može da pregazi default po objavi</span></div>
          </div>
        </aside>
      </div>
    </>
  )
}

function normalizeHex(value: string, fallback: string) {
  const next = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(next) ? next : fallback
}

function hexRgb(value: string) {
  const hex = value.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

function luminance(hex: string) {
  return hexRgb(hex).map((value) => value / 255).map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}

function contrastRatio(a: string, b: string) {
  const first = luminance(a), second = luminance(b)
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05)
}
