import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { AlignLeft, CheckCircle2, Copy, Download, Eye, EyeOff, Image as ImageIcon, LayoutTemplate, Move, Palette, RotateCcw, Save, Sparkles, WandSparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { LogoBadge, LogoPosition, LogoSize, MenuItem, Post, Restaurant } from '../types'

type Format = 'feed' | 'story'
type Template = 'editorial' | 'bold' | 'minimal' | 'split' | 'poster' | 'luxe'
type PhotoPosition = 'left' | 'center' | 'right'

type DesignState = {
  template: Template
  headline: string
  subline: string
  cta: string
  format: Format
  imageUrl: string | null
  photoPosition: PhotoPosition
  overlay: number
  primaryColor: string
  accentColor: string
  logoVisible: boolean
  logoPosition: LogoPosition
  logoSize: LogoSize
  logoBadge: LogoBadge
}

const templateNames: Record<Template, string> = {
  editorial: 'Editorial',
  bold: 'Bold',
  minimal: 'Minimal',
  split: 'Split',
  poster: 'Poster',
  luxe: 'Luxe',
}

export function VisualStudio({ restaurant, posts, menuItems, setNotice }: {
  restaurant: Restaurant
  posts: Post[]
  menuItems: MenuItem[]
  setNotice: (value: string) => void
}) {
  const usablePosts = useMemo(() => posts.filter((post) => post.status !== 'rejected'), [posts])
  const imageOptions = useMemo(() => menuItems.filter((item) => item.is_active && item.image_url), [menuItems])
  const [selectedId, setSelectedId] = useState(() => usablePosts.find((post) => post.status === 'approved')?.id || usablePosts[0]?.id || '')
  const selected = usablePosts.find((post) => post.id === selectedId) || usablePosts[0]
  const [design, setDesign] = useState<DesignState>(() => designFromPost(selected, menuItems, restaurant))
  const [working, setWorking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingDefaults, setSavingDefaults] = useState(false)

  useEffect(() => {
    if (!selected) return
    setDesign(designFromPost(selected, menuItems, restaurant))
  }, [selectedId, restaurant.id])

  const item = selected ? menuItems.find((entry) => entry.id === selected.menu_item_id) : undefined
  const price = item?.price ? `${item.price} ${item.currency || 'RSD'}` : ''
  const location = [restaurant.neighborhood, restaurant.city].filter(Boolean).join(' · ') || restaurant.cuisine_type || 'Restaurant'
  const designScore = calculateDesignScore({ design, restaurant, price })
  const lowContrast = contrastRatio(design.primaryColor, design.accentColor) < 2.2

  if (!selected) {
    return (
      <>
        <header className="page-header"><div><p className="eyebrow">VISUAL STUDIO</p><h1>Gotovi vizuali</h1><p className="muted">Prvo generiši nedelju sadržaja, pa ovde pravi finalne objave.</p></div></header>
        <div className="empty-state"><ImageIcon size={34} /><h3>Nema objava za dizajn</h3><p>Dodaj jela sa fotografijama i generiši sadržaj.</p></div>
      </>
    )
  }

  function patchDesign(patch: Partial<DesignState>) {
    setDesign((current) => ({ ...current, ...patch }))
  }

  function resetBrand() {
    patchDesign({
      primaryColor: restaurant.primary_color || '#142019',
      accentColor: restaurant.secondary_color || '#b9df72',
      logoVisible: restaurant.default_logo_visible ?? true,
      logoPosition: restaurant.default_logo_position || 'top-right',
      logoSize: restaurant.default_logo_size || 'm',
      logoBadge: restaurant.default_logo_badge || 'white',
      overlay: Number(restaurant.default_overlay_strength ?? .68),
    })
    setNotice('Vraćene su podrazumevane boje i logo pravila restorana.')
  }

  function autoDesign() {
    const nextTemplate: Template = selected.post_type === 'promotion'
      ? 'bold'
      : selected.post_type === 'story'
        ? 'poster'
        : restaurant.brand_style === 'premium'
          ? 'luxe'
          : design.imageUrl
            ? 'editorial'
            : 'minimal'
    patchDesign({
      template: nextTemplate,
      overlay: nextTemplate === 'minimal' ? .44 : nextTemplate === 'luxe' ? .58 : .7,
      photoPosition: 'center',
      logoPosition: nextTemplate === 'poster' ? 'top-right' : nextTemplate === 'split' ? 'bottom-left' : restaurant.default_logo_position || 'top-right',
      headline: selected.title || design.headline,
      subline: shorten(selected.caption || design.subline, selected.post_type === 'story' ? 96 : 118),
      cta: selected.cta || design.cta || 'Svrati danas',
    })
    setNotice(`Auto Design je izabrao ${templateNames[nextTemplate]} stil, kadar i poziciju loga.`)
  }

  async function saveDesign() {
    setSaving(true)
    const meta = {
      ...(selected.generation_meta || {}),
      image_url: design.imageUrl,
      visual_design: {
        template: design.template,
        format: design.format,
        headline: design.headline,
        subline: design.subline,
        cta: design.cta,
        image_url: design.imageUrl,
        photo_position: design.photoPosition,
        overlay: design.overlay,
        primary_color: design.primaryColor,
        accent_color: design.accentColor,
        logo_visible: design.logoVisible,
        logo_position: design.logoPosition,
        logo_size: design.logoSize,
        logo_badge: design.logoBadge,
        saved_at: new Date().toISOString(),
      },
    }
    const { error } = await supabase.from('posts').update({ generation_meta: meta }).eq('id', selected.id)
    if (error) setNotice(error.message)
    else setNotice('Dizajn je sačuvan: layout, boje, logo, pozicija i kadar vraćaju se identično.')
    setSaving(false)
  }

  async function saveAsBrandDefault() {
    setSavingDefaults(true)
    const { error } = await supabase.from('restaurants').update({
      primary_color: design.primaryColor,
      secondary_color: design.accentColor,
      default_logo_visible: design.logoVisible,
      default_logo_position: design.logoPosition,
      default_logo_size: design.logoSize,
      default_logo_badge: design.logoBadge,
      default_overlay_strength: design.overlay,
    }).eq('id', restaurant.id)
    if (error) setNotice(error.message)
    else setNotice('Ove boje i logo pravila su sačuvani kao novi brand default za restoran.')
    setSavingDefaults(false)
  }

  async function copyPost() {
    const caption = selected.platform_content?.instagram?.caption || selected.caption || ''
    const tags = selected.platform_content?.instagram?.hashtags || selected.hashtags || []
    try {
      await navigator.clipboard.writeText(`${caption}\n\n${tags.join(' ')}`.trim())
      setNotice('Instagram tekst i hashtagovi su kopirani.')
    } catch {
      setNotice('Browser nije dozvolio kopiranje.')
    }
  }

  async function downloadPng() {
    setWorking(true)
    setNotice('Renderujem finalni PNG u punoj rezoluciji…')
    try {
      const width = 1080
      const height = design.format === 'story' ? 1920 : 1350
      const backgroundData = design.imageUrl ? await urlToDataUrl(design.imageUrl) : null
      const logoData = design.logoVisible && restaurant.logo_url ? await urlToDataUrl(restaurant.logo_url).catch(() => null) : null
      const svg = buildSvg({
        width,
        height,
        template: design.template,
        headline: design.headline,
        subline: design.subline,
        cta: design.cta,
        restaurantName: restaurant.name,
        location,
        price,
        primary: design.primaryColor,
        accent: design.accentColor,
        backgroundData,
        logoData,
        photoPosition: design.photoPosition,
        overlay: design.overlay,
        logoVisible: design.logoVisible,
        logoPosition: design.logoPosition,
        logoSize: design.logoSize,
        logoBadge: design.logoBadge,
      })
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const objectUrl = URL.createObjectURL(blob)
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) {
          URL.revokeObjectURL(objectUrl)
          setNotice('Canvas nije dostupan u browseru.')
          setWorking(false)
          return
        }
        context.drawImage(image, 0, 0, width, height)
        URL.revokeObjectURL(objectUrl)
        canvas.toBlob((png) => {
          if (!png) {
            setNotice('Nisam uspeo da napravim PNG. Probaj ponovo.')
            setWorking(false)
            return
          }
          const link = document.createElement('a')
          link.href = URL.createObjectURL(png)
          link.download = `${slug(restaurant.name)}-${slug(design.headline || 'objava')}-${design.format}.png`
          link.click()
          setTimeout(() => URL.revokeObjectURL(link.href), 1500)
          setNotice(`Finalni PNG ${width}×${height} je spreman sa brend bojama i logom.`)
          setWorking(false)
        }, 'image/png', 1)
      }
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        setNotice('Greška pri renderovanju vizuala. Proveri fotografiju i probaj ponovo.')
        setWorking(false)
      }
      image.src = objectUrl
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Greška pri izvozu vizuala.')
      setWorking(false)
    }
  }

  return (
    <>
      <header className="page-header studio-header studio-header-pro">
        <div>
          <p className="eyebrow">VISUAL STUDIO</p>
          <h1>Objava mora da izgleda kao da ju je radio dizajner.</h1>
          <p className="muted">Realna fotografija, logo, brend boje, hijerarhija i CTA — sve menjaš uživo i izvoziš kao finalni PNG.</p>
        </div>
        <div className="studio-header-actions">
          <button className="secondary" onClick={saveDesign} disabled={saving}><Save size={17} /> {saving ? 'Čuvam…' : 'Sačuvaj objavu'}</button>
          <button className="primary" onClick={downloadPng} disabled={working}><Download size={18} /> {working ? 'Renderujem…' : `Preuzmi ${design.format === 'story' ? '1080×1920' : '1080×1350'}`}</button>
        </div>
      </header>

      <div className="studio-shell studio-shell-pro">
        <aside className="studio-controls panel studio-controls-pro">
          <div className="studio-score-row">
            <div className="studio-control-head"><LayoutTemplate size={19} /><div><strong>Finalni dizajn</strong><span>Sve izmene se vide odmah.</span></div></div>
            <div className={`design-score ${designScore >= 85 ? 'great' : designScore >= 70 ? 'good' : ''}`}><strong>{designScore}</strong><span>/100</span></div>
          </div>

          <label>Objava<select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{usablePosts.map((post) => <option key={post.id} value={post.id}>{post.title || 'Objava'} · {post.post_type}</option>)}</select></label>
          <button type="button" className="magic-design-button" onClick={autoDesign}><WandSparkles size={18} /><div><strong>Auto Design</strong><span>Layout + kadar + logo pozicija</span></div></button>

          <div className="studio-fieldset"><span>Format</span><div className="segmented"><button type="button" className={design.format === 'feed' ? 'active' : ''} onClick={() => patchDesign({ format: 'feed' })}>Feed 4:5</button><button type="button" className={design.format === 'story' ? 'active' : ''} onClick={() => patchDesign({ format: 'story' })}>Story 9:16</button></div></div>
          <div className="studio-fieldset"><span><Palette size={14} /> Stil</span><div className="template-picker template-picker-six">{(Object.keys(templateNames) as Template[]).map((value) => <button type="button" key={value} className={design.template === value ? 'active' : ''} onClick={() => patchDesign({ template: value })}><i className={`template-dot ${value}`} /><span>{templateNames[value]}</span></button>)}</div></div>

          <div className="brand-control-box">
            <div className="brand-control-title"><div><Palette size={15} /><strong>Brend na ovoj objavi</strong></div><button type="button" title="Vrati brand defaults" onClick={resetBrand}><RotateCcw size={14} /></button></div>
            <div className="studio-color-grid">
              <label>Primarna<div className="studio-color-input"><input type="color" value={design.primaryColor} onChange={(e) => patchDesign({ primaryColor: e.target.value })} /><span>{design.primaryColor}</span></div></label>
              <label>Akcent<div className="studio-color-input"><input type="color" value={design.accentColor} onChange={(e) => patchDesign({ accentColor: e.target.value })} /><span>{design.accentColor}</span></div></label>
            </div>
            {lowContrast && <div className="brand-warning">Boje su previše slične. CTA i badge mogu izgubiti kontrast.</div>}
            <div className="logo-control-row">
              <button type="button" className={design.logoVisible ? 'logo-visibility active' : 'logo-visibility'} onClick={() => patchDesign({ logoVisible: !design.logoVisible })}>{design.logoVisible ? <Eye size={14} /> : <EyeOff size={14} />}{design.logoVisible ? 'Logo uključen' : 'Logo isključen'}</button>
              {!restaurant.logo_url && <small>Dodaj logo u Podešavanjima.</small>}
            </div>
            <div className="studio-brand-grid">
              <label>Pozicija<select value={design.logoPosition} onChange={(e) => patchDesign({ logoPosition: e.target.value as LogoPosition })}><option value="top-left">Gore levo</option><option value="top-right">Gore desno</option><option value="top-center">Gore centar</option><option value="bottom-left">Dole levo</option><option value="bottom-right">Dole desno</option></select></label>
              <label>Veličina<select value={design.logoSize} onChange={(e) => patchDesign({ logoSize: e.target.value as LogoSize })}><option value="s">Mali</option><option value="m">Srednji</option><option value="l">Veliki</option></select></label>
              <label className="span-2">Podloga<select value={design.logoBadge} onChange={(e) => patchDesign({ logoBadge: e.target.value as LogoBadge })}><option value="none">Bez podloge</option><option value="white">Bela</option><option value="dark">Tamna</option><option value="blur">Glass / blur</option></select></label>
            </div>
            <button type="button" className="save-brand-default" onClick={saveAsBrandDefault} disabled={savingDefaults}><Save size={14} /> {savingDefaults ? 'Čuvam…' : 'Sačuvaj kao default brenda'}</button>
          </div>

          <div className="studio-fieldset"><span><ImageIcon size={14} /> Fotografija</span>{imageOptions.length ? <select value={design.imageUrl || ''} onChange={(event) => patchDesign({ imageUrl: event.target.value || null })}><option value="">Bez fotografije</option>{imageOptions.map((entry) => <option key={entry.id} value={entry.image_url || ''}>{entry.name}</option>)}</select> : <div className="studio-image-empty">Dodaj realne fotografije u Meni da bi objave izgledale vrhunski.</div>}</div>
          <div className="studio-fieldset"><span><Move size={14} /> Fokus fotografije</span><div className="segmented segmented-three"><button type="button" className={design.photoPosition === 'left' ? 'active' : ''} onClick={() => patchDesign({ photoPosition: 'left' })}>Levo</button><button type="button" className={design.photoPosition === 'center' ? 'active' : ''} onClick={() => patchDesign({ photoPosition: 'center' })}>Centar</button><button type="button" className={design.photoPosition === 'right' ? 'active' : ''} onClick={() => patchDesign({ photoPosition: 'right' })}>Desno</button></div></div>
          <div className="studio-fieldset overlay-control"><span>Jačina zatamnjenja <strong>{Math.round(design.overlay * 100)}%</strong></span><input type="range" min="20" max="90" value={Math.round(design.overlay * 100)} onChange={(event) => patchDesign({ overlay: Number(event.target.value) / 100 })} /></div>

          <div className="studio-copy-fields">
            <label><span><AlignLeft size={14} /> Glavni naslov</span><input value={design.headline} onChange={(event) => patchDesign({ headline: event.target.value })} maxLength={58} /></label>
            <label>Podnaslov<textarea rows={3} value={design.subline} onChange={(event) => patchDesign({ subline: event.target.value })} maxLength={170} /></label>
            <label>CTA<input value={design.cta} onChange={(event) => patchDesign({ cta: event.target.value })} maxLength={30} /></label>
          </div>

          <div className="design-checks">
            <DesignCheck ok={Boolean(design.imageUrl)} text="realna fotografija" />
            <DesignCheck ok={!design.logoVisible || Boolean(restaurant.logo_url)} text="logo spreman" soft />
            <DesignCheck ok={design.headline.length > 3 && design.headline.length <= 42} text="jak kratak naslov" />
            <DesignCheck ok={!lowContrast} text="dobar kontrast" />
          </div>
          <button type="button" className="secondary full" onClick={copyPost}><Copy size={16} /> Kopiraj Instagram tekst + hashtagove</button>
        </aside>

        <section className="studio-stage studio-stage-pro">
          <div className="stage-toolbar"><span><Sparkles size={14} /> FINAL PREVIEW</span><span>{design.format === 'story' ? '9:16 · 1080×1920' : '4:5 · 1080×1350'} · {templateNames[design.template]}</span></div>
          <div className={`studio-artboard ${design.format} template-${design.template}`} style={{ '--brand': design.primaryColor, '--accent': design.accentColor, '--overlay': String(design.overlay), '--photo-pos': design.photoPosition === 'left' ? 'left center' : design.photoPosition === 'right' ? 'right center' : 'center center', backgroundImage: design.imageUrl ? `url(${design.imageUrl})` : undefined } as CSSProperties}>
            <div className="artboard-photo-shade" />
            {design.logoVisible && <div className={`floating-brand-logo pos-${design.logoPosition} size-${design.logoSize} badge-${design.logoBadge}`}>{restaurant.logo_url ? <img src={restaurant.logo_url} alt={restaurant.name} /> : <span>{restaurant.name.slice(0,1).toUpperCase()}</span>}</div>}
            <div className="artboard-brandline"><strong>{restaurant.name}</strong><span>{location}</span></div>
            <div className="artboard-copy">
              {price && <span className="visual-price">{price}</span>}
              <h2>{design.headline || 'Naslov objave'}</h2>
              <p>{design.subline || 'Kratka poruka koja prodaje iskustvo, ne samo jelo.'}</p>
              <div className="visual-cta">{design.cta || 'Svrati danas'} <span>→</span></div>
            </div>
            <div className="artboard-footer"><span>{restaurant.instagram || restaurant.name}</span><span>{design.format === 'story' ? 'STORY' : 'FEED'}</span></div>
          </div>
          <div className="studio-below-preview"><div><CheckCircle2 size={17} /><span>PNG export koristi isti logo, poziciju, boje i layout kao preview.</span></div><div><ImageIcon size={17} /><span>{design.imageUrl ? 'Koristi se realna fotografija iz menija.' : 'Dodaj fotografiju za maksimalan kvalitet.'}</span></div></div>
        </section>
      </div>
    </>
  )
}

function DesignCheck({ ok, text, soft = false }: { ok: boolean; text: string; soft?: boolean }) {
  return <span className={ok ? 'ok' : soft ? 'soft' : ''}><CheckCircle2 size={13} /> {text}</span>
}

function designFromPost(post: Post | undefined, menuItems: MenuItem[], restaurant: Restaurant): DesignState {
  const brandDefaults = {
    primaryColor: restaurant.primary_color || '#142019',
    accentColor: restaurant.secondary_color || '#b9df72',
    logoVisible: restaurant.default_logo_visible ?? true,
    logoPosition: restaurant.default_logo_position || 'top-right' as LogoPosition,
    logoSize: restaurant.default_logo_size || 'm' as LogoSize,
    logoBadge: restaurant.default_logo_badge || 'white' as LogoBadge,
    overlay: Number(restaurant.default_overlay_strength ?? .68),
  }
  if (!post) return { template: 'editorial', headline: '', subline: '', cta: 'Svrati danas', format: 'feed', imageUrl: null, photoPosition: 'center', ...brandDefaults }
  const saved = post.generation_meta?.visual_design || {}
  const item = menuItems.find((entry) => entry.id === post.menu_item_id)
  const postImage = typeof post.generation_meta?.image_url === 'string' ? post.generation_meta.image_url : null
  const fallbackImage = item?.image_url || menuItems.find((entry) => entry.is_active && entry.image_url)?.image_url || null
  return {
    template: isTemplate(saved.template) ? saved.template : post.post_type === 'promotion' ? 'bold' : restaurant.brand_style === 'premium' ? 'luxe' : 'editorial',
    headline: typeof saved.headline === 'string' ? saved.headline : (post.title || ''),
    subline: typeof saved.subline === 'string' ? saved.subline : shorten(post.caption || '', 118),
    cta: typeof saved.cta === 'string' ? saved.cta : (post.cta || 'Svrati danas'),
    format: saved.format === 'story' || saved.format === 'feed' ? saved.format : (post.post_type === 'story' ? 'story' : 'feed'),
    imageUrl: typeof saved.image_url === 'string' ? saved.image_url : postImage || fallbackImage,
    photoPosition: saved.photo_position === 'left' || saved.photo_position === 'right' ? saved.photo_position : 'center',
    overlay: typeof saved.overlay === 'number' ? saved.overlay : brandDefaults.overlay,
    primaryColor: typeof saved.primary_color === 'string' ? saved.primary_color : brandDefaults.primaryColor,
    accentColor: typeof saved.accent_color === 'string' ? saved.accent_color : brandDefaults.accentColor,
    logoVisible: typeof saved.logo_visible === 'boolean' ? saved.logo_visible : brandDefaults.logoVisible,
    logoPosition: isLogoPosition(saved.logo_position) ? saved.logo_position : brandDefaults.logoPosition,
    logoSize: isLogoSize(saved.logo_size) ? saved.logo_size : brandDefaults.logoSize,
    logoBadge: isLogoBadge(saved.logo_badge) ? saved.logo_badge : brandDefaults.logoBadge,
  }
}

function isTemplate(value: unknown): value is Template { return typeof value === 'string' && ['editorial', 'bold', 'minimal', 'split', 'poster', 'luxe'].includes(value) }
function isLogoPosition(value: unknown): value is LogoPosition { return typeof value === 'string' && ['top-left','top-right','top-center','bottom-left','bottom-right'].includes(value) }
function isLogoSize(value: unknown): value is LogoSize { return value === 's' || value === 'm' || value === 'l' }
function isLogoBadge(value: unknown): value is LogoBadge { return typeof value === 'string' && ['none','white','dark','blur'].includes(value) }

function calculateDesignScore({ design, restaurant, price }: { design: DesignState; restaurant: Restaurant; price: string }) {
  let score = 36
  if (design.imageUrl) score += 24
  if (!design.logoVisible || restaurant.logo_url) score += 8
  if (design.headline.length >= 4 && design.headline.length <= 42) score += 10
  if (design.subline.length >= 20 && design.subline.length <= 125) score += 6
  if (design.cta) score += 6
  if (price) score += 4
  if (contrastRatio(design.primaryColor, design.accentColor) >= 2.2) score += 6
  return Math.min(100, score)
}

function contrastRatio(a: string, b: string) {
  const lum = (hex: string) => {
    const clean = hex.replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return .5
    const rgb = [0,2,4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4))
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]
  }
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)
}

function shorten(value: string, max: number) { const clean = value.replace(/\s+/g, ' ').trim(); return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…` }
function slug(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'restaurant-autopilot' }
function escapeXml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;') }
function wrap(value: string, maxChars: number, maxLines: number) { const words = value.trim().split(/\s+/).filter(Boolean); const lines:string[]=[]; let current=''; for(const word of words){const candidate=current?`${current} ${word}`:word;if(candidate.length>maxChars&&current){lines.push(current);current=word;if(lines.length>=maxLines-1)break}else current=candidate}if(current&&lines.length<maxLines)lines.push(current);return lines }

async function urlToDataUrl(url: string) {
  if (url.startsWith('data:')) return url
  const response = await fetch(url)
  if (!response.ok) throw new Error('Fotografija nije dostupna za eksport.')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Ne mogu da učitam fotografiju.')); reader.readAsDataURL(blob) })
}

function logoGeometry(width: number, height: number, position: LogoPosition, size: LogoSize, story: boolean) {
  const px = size === 's' ? (story ? 92 : 72) : size === 'l' ? (story ? 148 : 116) : (story ? 118 : 92)
  const margin = story ? 72 : 56
  let x = margin, y = margin
  if (position.includes('right')) x = width - margin - px
  if (position === 'top-center') x = (width - px) / 2
  if (position.includes('bottom')) y = height - margin - px
  return { x, y, size: px }
}

function buildSvg(input: {
  width:number; height:number; template:Template; headline:string; subline:string; cta:string; restaurantName:string; location:string; price:string; primary:string; accent:string; backgroundData:string|null; logoData:string|null; photoPosition:PhotoPosition; overlay:number; logoVisible:boolean; logoPosition:LogoPosition; logoSize:LogoSize; logoBadge:LogoBadge
}) {
  const { width, height, template, primary, accent } = input
  const story = height > 1500
  const margin = story ? 78 : 64
  const serif = template === 'luxe' || template === 'editorial'
  const headBase = story ? 108 : 78
  const headSize = input.headline.length > 38 ? Math.round(headBase*.8) : input.headline.length > 26 ? Math.round(headBase*.9) : headBase
  const bodySize = story ? 35 : 27
  const maxChars = template === 'split' ? (story ? 15 : 16) : (story ? 18 : 22)
  const lines = wrap(input.headline || 'Naslov objave', maxChars, story ? 4 : 3)
  const bodyLines = wrap(input.subline || '', template === 'split' ? 30 : story ? 39 : 48, story ? 4 : 3)
  const preserve = input.photoPosition === 'left' ? 'xMinYMid slice' : input.photoPosition === 'right' ? 'xMaxYMid slice' : 'xMidYMid slice'
  const overlay = Math.max(.2, Math.min(.9, input.overlay))
  const fullPhoto = input.backgroundData ? `<image href="${input.backgroundData}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="${preserve}"/>` : `<rect width="${width}" height="${height}" fill="${primary}"/><circle cx="${width*.82}" cy="${height*.18}" r="${width*.46}" fill="${accent}" opacity=".13"/>`
  const splitPhoto = input.backgroundData ? `<rect width="${width}" height="${height}" fill="${primary}"/><image href="${input.backgroundData}" x="${Math.round(width*.43)}" y="0" width="${Math.round(width*.57)}" height="${height}" preserveAspectRatio="${preserve}"/><rect x="${Math.round(width*.36)}" width="${Math.round(width*.2)}" height="${height}" fill="url(#splitFade)"/>` : fullPhoto
  const background = template === 'split' ? splitPhoto : fullPhoto
  const shade = template === 'minimal' ? `<rect width="${width}" height="${height}" fill="url(#softShade)"/>` : template === 'split' ? '' : `<rect width="${width}" height="${height}" fill="url(#shade)"/>`
  const copyY = template === 'poster' ? Math.round(height*.47) : template === 'split' ? Math.round(height*.38) : template === 'minimal' ? Math.round(height*.60) : template === 'luxe' ? Math.round(height*.53) : Math.round(height*.56)
  const textX = margin
  const lineHeight = headSize*1.01
  const fontFamily = serif ? 'Georgia,serif' : 'Arial,sans-serif'
  const headline = lines.map((line,i)=>`<text x="${textX}" y="${copyY+i*lineHeight}" font-family="${fontFamily}" font-size="${headSize}" font-weight="${serif?700:900}" letter-spacing="-2" fill="${template==='minimal'?primary:'#ffffff'}">${escapeXml(line)}</text>`).join('')
  const bodyStart = copyY + lines.length*lineHeight + (story?42:30)
  const body = bodyLines.map((line,i)=>`<text x="${textX}" y="${bodyStart+i*bodySize*1.38}" font-family="Arial,sans-serif" font-size="${bodySize}" font-weight="500" fill="${template==='minimal'?'#4f5b52':'#ffffff'}" opacity=".9">${escapeXml(line)}</text>`).join('')
  const ctaY = bodyStart + Math.max(1,bodyLines.length)*bodySize*1.38 + (story?56:38)
  const ctaW = story ? 400 : 330, ctaH = story ? 82 : 64
  const price = input.price ? `<rect x="${margin}" y="${copyY-(story?96:72)}" rx="999" width="${story?270:220}" height="${story?62:50}" fill="${accent}"/><text x="${margin+(story?135:110)}" y="${copyY-(story?54:38)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story?29:23}" font-weight="900" fill="${primary}">${escapeXml(input.price)}</text>` : ''
  const cta = `<rect x="${margin}" y="${ctaY}" rx="999" width="${ctaW}" height="${ctaH}" fill="${template==='minimal'?primary:accent}"/><text x="${margin+ctaW/2}" y="${ctaY+(story?53:42)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story?30:24}" font-weight="900" fill="${template==='minimal'?'#ffffff':primary}">${escapeXml(input.cta || 'Svrati danas')} →</text>`
  const minimalCard = template === 'minimal' ? `<rect x="${margin*.7}" y="${Math.round(height*.55)}" width="${width-margin*1.4}" height="${height-Math.round(height*.55)-margin*.7}" rx="${story?42:32}" fill="#fbfcfa" opacity=".96"/>` : ''
  const luxeFrame = template === 'luxe' ? `<rect x="${margin*.55}" y="${margin*.55}" width="${width-margin*1.1}" height="${height-margin*1.1}" rx="${story?34:28}" fill="none" stroke="${accent}" stroke-width="2" opacity=".72"/>` : ''
  const boldBand = template === 'bold' ? `<rect x="0" y="${Math.round(height*.47)}" width="${width}" height="${Math.round(height*.53)}" fill="${primary}" opacity=".84"/>` : ''
  const posterAccent = template === 'poster' ? `<rect x="${margin}" y="${Math.round(height*.24)}" width="${story?150:115}" height="12" rx="6" fill="${accent}"/><text x="${margin}" y="${Math.round(height*.31)}" font-family="Arial,sans-serif" font-size="${story?24:18}" font-weight="900" letter-spacing="5" fill="#ffffff">TODAY'S PICK</text>` : ''
  const brandline = `<text x="${margin}" y="${story?146:112}" font-family="Arial,sans-serif" font-size="${story?30:23}" font-weight="900" fill="#ffffff">${escapeXml(input.restaurantName)}</text><text x="${margin}" y="${story?180:142}" font-family="Arial,sans-serif" font-size="${story?20:16}" fill="#ffffff" opacity=".72">${escapeXml(input.location)}</text>`

  let logo = ''
  if (input.logoVisible) {
    const g = logoGeometry(width,height,input.logoPosition,input.logoSize,story)
    const pad = Math.round(g.size*.12)
    const bg = input.logoBadge === 'white' ? '#ffffff' : input.logoBadge === 'dark' ? primary : input.logoBadge === 'blur' ? '#ffffff' : 'none'
    const opacity = input.logoBadge === 'blur' ? '.24' : input.logoBadge === 'none' ? '0' : '.96'
    const badge = input.logoBadge === 'none' ? '' : `<rect x="${g.x}" y="${g.y}" width="${g.size}" height="${g.size}" rx="${Math.round(g.size*.18)}" fill="${bg}" opacity="${opacity}"/>`
    if (input.logoData) logo = `${badge}<image href="${input.logoData}" x="${g.x+pad}" y="${g.y+pad}" width="${g.size-pad*2}" height="${g.size-pad*2}" preserveAspectRatio="xMidYMid meet"/>`
    else logo = `${badge}<text x="${g.x+g.size/2}" y="${g.y+g.size*.67}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${Math.round(g.size*.48)}" font-weight="900" fill="${input.logoBadge==='dark'?'#ffffff':primary}">${escapeXml(input.restaurantName.slice(0,1).toUpperCase())}</text>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07100a" stop-opacity=".04"/><stop offset=".42" stop-color="#07100a" stop-opacity="${Math.max(.1,overlay-.48)}"/><stop offset="1" stop-color="#07100a" stop-opacity="${overlay}"/></linearGradient><linearGradient id="softShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07100a" stop-opacity=".03"/><stop offset="1" stop-color="#07100a" stop-opacity=".34"/></linearGradient><linearGradient id="splitFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${primary}" stop-opacity="1"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></linearGradient></defs>${background}${shade}${boldBand}${minimalCard}${luxeFrame}${posterAccent}${brandline}${price}${headline}${body}${cta}${logo}<text x="${margin}" y="${height-margin*.62}" font-family="Arial,sans-serif" font-size="${story?18:14}" font-weight="900" letter-spacing="4" fill="${template==='minimal'?primary:'#ffffff'}" opacity=".55">RESTAURANT AUTOPILOT</text></svg>`
}
