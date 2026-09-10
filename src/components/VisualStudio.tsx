import { useEffect, useMemo, useState } from 'react'
import { AlignLeft, CheckCircle2, Copy, Download, Image as ImageIcon, LayoutTemplate, Move, Palette, Save, Sparkles, WandSparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { MenuItem, Post, Restaurant } from '../types'

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

  useEffect(() => {
    if (!selected) return
    setDesign(designFromPost(selected, menuItems, restaurant))
  }, [selectedId])

  const item = selected ? menuItems.find((entry) => entry.id === selected.menu_item_id) : undefined
  const price = item?.price ? `${item.price} ${item.currency || 'RSD'}` : ''
  const location = [restaurant.neighborhood, restaurant.city].filter(Boolean).join(' · ') || restaurant.cuisine_type || 'Restaurant'
  const designScore = calculateDesignScore({ design, restaurant, price })

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
      headline: selected.title || design.headline,
      subline: shorten(selected.caption || design.subline, selected.post_type === 'story' ? 96 : 118),
      cta: selected.cta || design.cta || 'Svrati danas',
    })
    setNotice(`Auto Design je izabrao ${templateNames[nextTemplate]} stil za ovu objavu.`)
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
        saved_at: new Date().toISOString(),
      },
    }
    const { error } = await supabase.from('posts').update({ generation_meta: meta }).eq('id', selected.id)
    if (error) setNotice(error.message)
    else setNotice('Dizajn je sačuvan uz objavu. Vratiće se isti kada ponovo otvoriš Visual Studio.')
    setSaving(false)
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
      const logoData = restaurant.logo_url ? await urlToDataUrl(restaurant.logo_url).catch(() => null) : null
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
        primary: restaurant.primary_color || '#142019',
        accent: restaurant.secondary_color || '#b9df72',
        backgroundData,
        logoData,
        photoPosition: design.photoPosition,
        overlay: design.overlay,
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
          setNotice(`Finalni PNG ${width}×${height} je spreman.`)
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
          <p className="muted">Realna fotografija, brend, hijerarhija, CTA i format — sve u jednom finalnom vizualu.</p>
        </div>
        <div className="studio-header-actions">
          <button className="secondary" onClick={saveDesign} disabled={saving}><Save size={17} /> {saving ? 'Čuvam…' : 'Sačuvaj dizajn'}</button>
          <button className="primary" onClick={downloadPng} disabled={working}><Download size={18} /> {working ? 'Renderujem…' : `Preuzmi ${design.format === 'story' ? '1080×1920' : '1080×1350'}`}</button>
        </div>
      </header>

      <div className="studio-shell studio-shell-pro">
        <aside className="studio-controls panel studio-controls-pro">
          <div className="studio-score-row">
            <div className="studio-control-head"><LayoutTemplate size={19} /><div><strong>Finalni dizajn</strong><span>Sve izmene se vide odmah.</span></div></div>
            <div className={`design-score ${designScore >= 85 ? 'great' : designScore >= 70 ? 'good' : ''}`}><strong>{designScore}</strong><span>/100</span></div>
          </div>

          <label>Objava
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {usablePosts.map((post) => <option key={post.id} value={post.id}>{post.title || 'Objava'} · {post.post_type}</option>)}
            </select>
          </label>

          <button type="button" className="magic-design-button" onClick={autoDesign}><WandSparkles size={18} /><div><strong>Auto Design</strong><span>Izaberi najbolji layout za ovu objavu</span></div></button>

          <div className="studio-fieldset"><span>Format</span><div className="segmented"><button type="button" className={design.format === 'feed' ? 'active' : ''} onClick={() => patchDesign({ format: 'feed' })}>Feed 4:5</button><button type="button" className={design.format === 'story' ? 'active' : ''} onClick={() => patchDesign({ format: 'story' })}>Story 9:16</button></div></div>

          <div className="studio-fieldset"><span><Palette size={14} /> Stil</span><div className="template-picker template-picker-six">
            {(Object.keys(templateNames) as Template[]).map((value) => <button type="button" key={value} className={design.template === value ? 'active' : ''} onClick={() => patchDesign({ template: value })}><i className={`template-dot ${value}`} /><span>{templateNames[value]}</span></button>)}
          </div></div>

          <div className="studio-fieldset"><span><ImageIcon size={14} /> Fotografija</span>
            {imageOptions.length ? <select value={design.imageUrl || ''} onChange={(event) => patchDesign({ imageUrl: event.target.value || null })}><option value="">Bez fotografije</option>{imageOptions.map((entry) => <option key={entry.id} value={entry.image_url || ''}>{entry.name}</option>)}</select> : <div className="studio-image-empty">Dodaj realne fotografije u Meni da bi objave izgledale vrhunski.</div>}
          </div>

          <div className="studio-fieldset"><span><Move size={14} /> Fokus fotografije</span><div className="segmented segmented-three"><button type="button" className={design.photoPosition === 'left' ? 'active' : ''} onClick={() => patchDesign({ photoPosition: 'left' })}>Levo</button><button type="button" className={design.photoPosition === 'center' ? 'active' : ''} onClick={() => patchDesign({ photoPosition: 'center' })}>Centar</button><button type="button" className={design.photoPosition === 'right' ? 'active' : ''} onClick={() => patchDesign({ photoPosition: 'right' })}>Desno</button></div></div>

          <div className="studio-fieldset overlay-control"><span>Jačina zatamnjenja <strong>{Math.round(design.overlay * 100)}%</strong></span><input type="range" min="25" max="88" value={Math.round(design.overlay * 100)} onChange={(event) => patchDesign({ overlay: Number(event.target.value) / 100 })} /></div>

          <div className="studio-copy-fields">
            <label><span><AlignLeft size={14} /> Glavni naslov</span><input value={design.headline} onChange={(event) => patchDesign({ headline: event.target.value })} maxLength={58} /></label>
            <label>Podnaslov<textarea rows={3} value={design.subline} onChange={(event) => patchDesign({ subline: event.target.value })} maxLength={170} /></label>
            <label>CTA<input value={design.cta} onChange={(event) => patchDesign({ cta: event.target.value })} maxLength={30} /></label>
          </div>

          <div className="design-checks">
            <DesignCheck ok={Boolean(design.imageUrl)} text="realna fotografija" />
            <DesignCheck ok={Boolean(restaurant.logo_url)} text="logo restorana" soft />
            <DesignCheck ok={design.headline.length > 3 && design.headline.length <= 42} text="jak kratak naslov" />
            <DesignCheck ok={Boolean(design.cta)} text="jasan CTA" />
          </div>

          <button type="button" className="secondary full" onClick={copyPost}><Copy size={16} /> Kopiraj Instagram tekst + hashtagove</button>
        </aside>

        <section className="studio-stage studio-stage-pro">
          <div className="stage-toolbar"><span><Sparkles size={14} /> FINAL PREVIEW</span><span>{design.format === 'story' ? '9:16 · 1080×1920' : '4:5 · 1080×1350'} · {templateNames[design.template]}</span></div>
          <div
            className={`studio-artboard ${design.format} template-${design.template}`}
            style={{
              '--brand': restaurant.primary_color || '#142019',
              '--accent': restaurant.secondary_color || '#b9df72',
              '--overlay': String(design.overlay),
              '--photo-pos': design.photoPosition === 'left' ? 'left center' : design.photoPosition === 'right' ? 'right center' : 'center center',
              backgroundImage: design.imageUrl ? `url(${design.imageUrl})` : undefined,
            } as React.CSSProperties}
          >
            <div className="artboard-photo-shade" />
            <div className="artboard-top">
              {restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <div className="studio-brand-fallback">{restaurant.name.slice(0, 1).toUpperCase()}</div>}
              <div><strong>{restaurant.name}</strong><span>{location}</span></div>
            </div>
            <div className="artboard-copy">
              {price && <span className="visual-price">{price}</span>}
              <h2>{design.headline || 'Naslov objave'}</h2>
              <p>{design.subline || 'Kratka poruka koja prodaje iskustvo, ne samo jelo.'}</p>
              <div className="visual-cta">{design.cta || 'Svrati danas'} <span>→</span></div>
            </div>
            <div className="artboard-footer"><span>{restaurant.instagram || restaurant.name}</span><span>{design.format === 'story' ? 'STORY' : 'FEED'}</span></div>
          </div>

          <div className="studio-below-preview">
            <div><CheckCircle2 size={17} /><span>Izvoz je pravi PNG u punoj rezoluciji, ne screenshot preview-a.</span></div>
            <div><ImageIcon size={17} /><span>{design.imageUrl ? 'Koristi se realna fotografija iz menija.' : 'Dodaj fotografiju za maksimalan kvalitet.'}</span></div>
          </div>
        </section>
      </div>
    </>
  )
}

function DesignCheck({ ok, text, soft = false }: { ok: boolean; text: string; soft?: boolean }) {
  return <span className={ok ? 'ok' : soft ? 'soft' : ''}><CheckCircle2 size={13} /> {text}</span>
}

function designFromPost(post: Post | undefined, menuItems: MenuItem[], restaurant: Restaurant): DesignState {
  if (!post) return { template: 'editorial', headline: '', subline: '', cta: 'Svrati danas', format: 'feed', imageUrl: null, photoPosition: 'center', overlay: .68 }
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
    overlay: typeof saved.overlay === 'number' ? saved.overlay : .68,
  }
}

function isTemplate(value: unknown): value is Template {
  return typeof value === 'string' && ['editorial', 'bold', 'minimal', 'split', 'poster', 'luxe'].includes(value)
}

function calculateDesignScore({ design, restaurant, price }: { design: DesignState; restaurant: Restaurant; price: string }) {
  let score = 42
  if (design.imageUrl) score += 24
  if (restaurant.logo_url) score += 8
  if (design.headline.length >= 4 && design.headline.length <= 42) score += 10
  if (design.subline.length >= 20 && design.subline.length <= 125) score += 6
  if (design.cta) score += 6
  if (price) score += 4
  return Math.min(100, score)
}

function shorten(value: string, max: number) {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'restaurant-autopilot'
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function wrap(value: string, maxChars: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxChars && current) {
      lines.push(current)
      current = word
      if (lines.length >= maxLines - 1) break
    } else current = candidate
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines
}

async function urlToDataUrl(url: string) {
  if (url.startsWith('data:')) return url
  const response = await fetch(url)
  if (!response.ok) throw new Error('Fotografija nije dostupna za eksport.')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Ne mogu da učitam fotografiju.'))
    reader.readAsDataURL(blob)
  })
}

function buildSvg(input: {
  width: number
  height: number
  template: Template
  headline: string
  subline: string
  cta: string
  restaurantName: string
  location: string
  price: string
  primary: string
  accent: string
  backgroundData: string | null
  logoData: string | null
  photoPosition: PhotoPosition
  overlay: number
}) {
  const { width, height, template, primary, accent } = input
  const story = height > 1500
  const margin = story ? 78 : 64
  const serif = template === 'luxe' || template === 'editorial'
  const headSizeBase = story ? 108 : 78
  const headSize = input.headline.length > 38 ? Math.round(headSizeBase * .8) : input.headline.length > 26 ? Math.round(headSizeBase * .9) : headSizeBase
  const bodySize = story ? 35 : 27
  const maxChars = template === 'split' ? (story ? 15 : 16) : (story ? 18 : 22)
  const lines = wrap(input.headline || 'Naslov objave', maxChars, story ? 4 : 3)
  const bodyLines = wrap(input.subline || '', template === 'split' ? 30 : story ? 39 : 48, story ? 4 : 3)
  const preserve = input.photoPosition === 'left' ? 'xMinYMid slice' : input.photoPosition === 'right' ? 'xMaxYMid slice' : 'xMidYMid slice'
  const overlay = Math.max(.2, Math.min(.9, input.overlay))

  const fullPhoto = input.backgroundData
    ? `<image href="${input.backgroundData}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="${preserve}"/>`
    : `<rect width="${width}" height="${height}" fill="${primary}"/><circle cx="${width*.82}" cy="${height*.18}" r="${width*.46}" fill="${accent}" opacity=".13"/><circle cx="${width*.14}" cy="${height*.75}" r="${width*.42}" fill="#ffffff" opacity=".05"/>`

  const splitPhoto = input.backgroundData
    ? `<rect width="${width}" height="${height}" fill="${primary}"/><image href="${input.backgroundData}" x="${Math.round(width*.43)}" y="0" width="${Math.round(width*.57)}" height="${height}" preserveAspectRatio="${preserve}"/><rect x="${Math.round(width*.36)}" width="${Math.round(width*.18)}" height="${height}" fill="url(#splitFade)"/>`
    : fullPhoto

  const background = template === 'split' ? splitPhoto : fullPhoto
  const shade = template === 'minimal'
    ? `<rect width="${width}" height="${height}" fill="url(#softShade)"/>`
    : template === 'split'
      ? ''
      : `<rect width="${width}" height="${height}" fill="url(#shade)"/>`

  const logoSize = story ? 112 : 88
  const logo = input.logoData
    ? `<image href="${input.logoData}" x="${margin}" y="${margin}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${margin}" y="${margin}" rx="${story ? 26 : 22}" width="${logoSize}" height="${logoSize}" fill="${accent}"/><text x="${margin + logoSize/2}" y="${margin + logoSize*.67}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story ? 54 : 42}" font-weight="900" fill="${primary}">${escapeXml(input.restaurantName.slice(0,1).toUpperCase())}</text>`

  const nameX = margin + logoSize + (story ? 28 : 22)
  const brand = `${logo}<text x="${nameX}" y="${margin + (story ? 42 : 34)}" font-family="Arial,sans-serif" font-size="${story ? 31 : 24}" font-weight="900" fill="#ffffff">${escapeXml(input.restaurantName)}</text><text x="${nameX}" y="${margin + (story ? 78 : 64)}" font-family="Arial,sans-serif" font-size="${story ? 21 : 17}" fill="#ffffff" opacity=".74">${escapeXml(input.location)}</text>`

  const textX = margin
  const copyY = template === 'poster' ? Math.round(height*.47) : template === 'split' ? Math.round(height*.36) : template === 'minimal' ? Math.round(height*.59) : template === 'luxe' ? Math.round(height*.52) : Math.round(height*.55)
  const lineHeight = headSize * 1.01
  const fontFamily = serif ? 'Georgia,serif' : 'Arial,sans-serif'
  const letterSpacing = serif ? '-2' : '-3'
  const headlineSvg = lines.map((line, index) => `<text x="${textX}" y="${copyY + index*lineHeight}" font-family="${fontFamily}" font-size="${headSize}" font-weight="${serif ? 700 : 900}" letter-spacing="${letterSpacing}" fill="#ffffff">${escapeXml(line)}</text>`).join('')
  const bodyStart = copyY + lines.length*lineHeight + (story ? 42 : 30)
  const bodySvg = bodyLines.map((line, index) => `<text x="${textX}" y="${bodyStart + index*bodySize*1.38}" font-family="Arial,sans-serif" font-size="${bodySize}" font-weight="500" fill="#ffffff" opacity=".9">${escapeXml(line)}</text>`).join('')
  const ctaY = bodyStart + Math.max(1, bodyLines.length)*bodySize*1.38 + (story ? 56 : 38)

  const price = input.price ? `<rect x="${margin}" y="${copyY - (story ? 96 : 72)}" rx="999" width="${story ? 270 : 220}" height="${story ? 62 : 50}" fill="${accent}"/><text x="${margin + (story ? 135 : 110)}" y="${copyY - (story ? 54 : 38)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story ? 29 : 23}" font-weight="900" fill="${primary}">${escapeXml(input.price)}</text>` : ''
  const ctaWidth = story ? 400 : 330
  const ctaHeight = story ? 82 : 64
  const cta = `<rect x="${margin}" y="${ctaY}" rx="999" width="${ctaWidth}" height="${ctaHeight}" fill="${template === 'minimal' ? primary : accent}"/><text x="${margin + ctaWidth/2}" y="${ctaY + (story ? 53 : 42)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story ? 30 : 24}" font-weight="900" fill="${template === 'minimal' ? '#ffffff' : primary}">${escapeXml(input.cta || 'Svrati danas')}  →</text>`

  const minimalCardY = Math.round(height*.54)
  const minimalCard = template === 'minimal' ? `<rect x="${margin*.72}" y="${minimalCardY}" width="${width-margin*1.44}" height="${height-minimalCardY-margin*.72}" rx="${story ? 42 : 32}" fill="#fbfcfa" opacity=".96"/>` : ''
  const luxeFrame = template === 'luxe' ? `<rect x="${margin*.55}" y="${margin*.55}" width="${width-margin*1.1}" height="${height-margin*1.1}" rx="${story ? 34 : 28}" fill="none" stroke="${accent}" stroke-width="2" opacity=".72"/><line x1="${margin}" y1="${Math.round(height*.43)}" x2="${margin + (story ? 220 : 170)}" y2="${Math.round(height*.43)}" stroke="${accent}" stroke-width="7"/>` : ''
  const boldBand = template === 'bold' ? `<rect x="0" y="${Math.round(height*.47)}" width="${width}" height="${Math.round(height*.53)}" fill="${primary}" opacity=".82"/>` : ''
  const posterAccent = template === 'poster' ? `<rect x="${margin}" y="${Math.round(height*.24)}" width="${story ? 150 : 115}" height="12" rx="6" fill="${accent}"/><text x="${margin}" y="${Math.round(height*.31)}" font-family="Arial,sans-serif" font-size="${story ? 24 : 18}" font-weight="900" letter-spacing="5" fill="#ffffff" opacity=".86">TODAY'S PICK</text>` : ''

  const minimalHeadline = template === 'minimal'
    ? lines.map((line, index) => `<text x="${textX}" y="${copyY + index*lineHeight}" font-family="Georgia,serif" font-size="${Math.round(headSize*.88)}" font-weight="700" letter-spacing="-2" fill="${primary}">${escapeXml(line)}</text>`).join('')
    : headlineSvg
  const minimalBody = template === 'minimal'
    ? bodyLines.map((line, index) => `<text x="${textX}" y="${bodyStart + index*bodySize*1.38}" font-family="Arial,sans-serif" font-size="${bodySize}" font-weight="500" fill="#4f5b52">${escapeXml(line)}</text>`).join('')
    : bodySvg

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07100a" stop-opacity=".05"/><stop offset=".43" stop-color="#07100a" stop-opacity="${Math.max(.12, overlay-.45)}"/><stop offset="1" stop-color="#07100a" stop-opacity="${overlay}"/></linearGradient>
      <linearGradient id="softShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07100a" stop-opacity=".02"/><stop offset=".72" stop-color="#07100a" stop-opacity=".12"/><stop offset="1" stop-color="#07100a" stop-opacity=".48"/></linearGradient>
      <linearGradient id="splitFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${primary}" stop-opacity="1"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></linearGradient>
    </defs>
    ${background}
    ${shade}
    ${boldBand}
    ${minimalCard}
    ${luxeFrame}
    ${posterAccent}
    ${brand}
    ${price}
    ${minimalHeadline}
    ${minimalBody}
    ${cta}
    <text x="${margin}" y="${height-margin}" font-family="Arial,sans-serif" font-size="${story ? 19 : 15}" font-weight="800" letter-spacing="3" fill="${template === 'minimal' ? primary : '#ffffff'}" opacity=".55">${escapeXml(input.restaurantName.toUpperCase())}</text>
  </svg>`
}
