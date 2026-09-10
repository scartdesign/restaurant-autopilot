import { useEffect, useMemo, useState } from 'react'
import { Download, Image as ImageIcon, LayoutTemplate, Sparkles, WandSparkles } from 'lucide-react'
import type { MenuItem, Post, Restaurant } from '../types'

type Format = 'feed' | 'story'
type Template = 'editorial' | 'bold' | 'minimal'

export function VisualStudio({ restaurant, posts, menuItems, setNotice }: {
  restaurant: Restaurant
  posts: Post[]
  menuItems: MenuItem[]
  setNotice: (value: string) => void
}) {
  const usablePosts = useMemo(() => posts.filter((post) => post.status !== 'rejected'), [posts])
  const [selectedId, setSelectedId] = useState(() => usablePosts.find((post) => post.status === 'approved')?.id || usablePosts[0]?.id || '')
  const selected = usablePosts.find((post) => post.id === selectedId) || usablePosts[0]
  const [format, setFormat] = useState<Format>(selected?.post_type === 'story' ? 'story' : 'feed')
  const [template, setTemplate] = useState<Template>('editorial')
  const [headline, setHeadline] = useState(selected?.title || '')
  const [subline, setSubline] = useState(shorten(selected?.caption || '', 110))
  const [cta, setCta] = useState(selected?.cta || 'Svrati danas')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!selected) return
    setFormat(selected.post_type === 'story' ? 'story' : 'feed')
    setHeadline(selected.title || '')
    setSubline(shorten(selected.caption || '', 110))
    setCta(selected.cta || 'Svrati danas')
  }, [selectedId])

  const item = selected ? menuItems.find((entry) => entry.id === selected.menu_item_id) : undefined
  const imageUrl = selected && typeof selected.generation_meta?.image_url === 'string'
    ? selected.generation_meta.image_url
    : item?.image_url || null
  const price = item?.price ? `${item.price} ${item.currency || 'RSD'}` : ''

  if (!selected) {
    return (
      <>
        <header className="page-header"><div><p className="eyebrow">VISUAL STUDIO</p><h1>Gotovi vizuali</h1><p className="muted">Prvo generiši nedelju sadržaja, pa će Autopilot ovde pripremiti grafike.</p></div></header>
        <div className="empty-state"><ImageIcon size={34} /><h3>Nema objava za dizajn</h3><p>Dodaj jela sa fotografijama i generiši sadržaj.</p></div>
      </>
    )
  }

  async function downloadPng() {
    setWorking(true)
    setNotice('Pripremam PNG u punoj rezoluciji…')
    try {
      const width = 1080
      const height = format === 'story' ? 1920 : 1350
      const backgroundData = imageUrl ? await urlToDataUrl(imageUrl) : null
      const logoData = restaurant.logo_url ? await urlToDataUrl(restaurant.logo_url).catch(() => null) : null
      const svg = buildSvg({
        width,
        height,
        template,
        headline,
        subline,
        cta,
        restaurantName: restaurant.name,
        location: [restaurant.neighborhood, restaurant.city].filter(Boolean).join(', '),
        price,
        primary: restaurant.primary_color || '#17211b',
        accent: restaurant.secondary_color || '#b9df72',
        backgroundData,
        logoData,
      })
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const objectUrl = URL.createObjectURL(blob)
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas nije dostupan u browseru.')
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
          link.download = `${slug(restaurant.name)}-${slug(headline || 'objava')}-${format}.png`
          link.click()
          setTimeout(() => URL.revokeObjectURL(link.href), 1500)
          setNotice(`PNG ${width}×${height} je spreman.`)
          setWorking(false)
        }, 'image/png', 1)
      }
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        setNotice('Greška pri renderovanju vizuala.')
        setWorking(false)
      }
      image.src = objectUrl
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Greška pri izvozu vizuala.')
      setWorking(false)
    }
  }

  function magicLayout() {
    const order: Template[] = ['editorial', 'bold', 'minimal']
    setTemplate(order[(order.indexOf(template) + 1) % order.length])
    setNotice('Promenjen je dizajn. Sadržaj i brend ostaju isti.')
  }

  return (
    <>
      <header className="page-header studio-header">
        <div>
          <p className="eyebrow">VISUAL STUDIO BETA</p>
          <h1>Od objave do gotove grafike.</h1>
          <p className="muted">Brend, fotografija, poruka i CTA se slažu u format spreman za Instagram i Facebook.</p>
        </div>
        <button className="primary" onClick={downloadPng} disabled={working}><Download size={18} /> {working ? 'Renderujem…' : `Preuzmi ${format === 'story' ? '1080×1920' : '1080×1350'}`}</button>
      </header>

      <div className="studio-shell">
        <aside className="studio-controls panel">
          <div className="studio-control-head"><LayoutTemplate size={19} /><div><strong>Dizajn objave</strong><span>Izaberi sadržaj i prilagodi pre izvoza.</span></div></div>

          <label>Objava
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {usablePosts.map((post) => <option key={post.id} value={post.id}>{post.title || 'Objava'} · {post.post_type}</option>)}
            </select>
          </label>

          <div className="studio-fieldset"><span>Format</span><div className="segmented"><button type="button" className={format === 'feed' ? 'active' : ''} onClick={() => setFormat('feed')}>Feed 4:5</button><button type="button" className={format === 'story' ? 'active' : ''} onClick={() => setFormat('story')}>Story 9:16</button></div></div>

          <div className="studio-fieldset"><span>Template</span><div className="template-picker">
            {(['editorial','bold','minimal'] as Template[]).map((value) => <button type="button" key={value} className={template === value ? 'active' : ''} onClick={() => setTemplate(value)}><i className={`template-dot ${value}`} />{value === 'editorial' ? 'Editorial' : value === 'bold' ? 'Bold' : 'Minimal'}</button>)}
          </div></div>

          <label>Glavni naslov<input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={55} /></label>
          <label>Podnaslov<textarea rows={4} value={subline} onChange={(event) => setSubline(event.target.value)} maxLength={170} /></label>
          <label>CTA<input value={cta} onChange={(event) => setCta(event.target.value)} maxLength={30} /></label>

          <div className="studio-image-status"><ImageIcon size={17} /><div><strong>{imageUrl ? 'Fotografija jela je povezana' : 'Nema fotografije jela'}</strong><span>{imageUrl ? 'Koristi se original koji je restoran uneo.' : 'Vizual će koristiti premium brand pozadinu.'}</span></div></div>
          <button type="button" className="secondary full" onClick={magicLayout}><WandSparkles size={17} /> Magic layout</button>
        </aside>

        <section className="studio-stage">
          <div className="stage-toolbar"><span><Sparkles size={14} /> LIVE PREVIEW</span><span>{format === 'story' ? '9:16 · 1080×1920' : '4:5 · 1080×1350'}</span></div>
          <div className={`studio-artboard ${format} template-${template}`} style={{ '--brand': restaurant.primary_color || '#17211b', '--accent': restaurant.secondary_color || '#b9df72', backgroundImage: imageUrl ? `linear-gradient(180deg, rgba(7,12,9,.05), rgba(7,12,9,.82)), url(${imageUrl})` : undefined } as React.CSSProperties}>
            <div className="artboard-top">
              {restaurant.logo_url ? <img src={restaurant.logo_url} alt="" /> : <div className="studio-brand-fallback">{restaurant.name.slice(0, 1).toUpperCase()}</div>}
              <div><strong>{restaurant.name}</strong><span>{[restaurant.neighborhood, restaurant.city].filter(Boolean).join(' · ') || restaurant.cuisine_type || 'Restaurant'}</span></div>
            </div>
            <div className="artboard-copy">
              {price && <span className="visual-price">{price}</span>}
              <h2>{headline || 'Naslov objave'}</h2>
              <p>{subline || 'Kratka poruka koja prodaje iskustvo, ne samo jelo.'}</p>
              <div className="visual-cta">{cta || 'Svrati danas'} <span>→</span></div>
            </div>
            <div className="artboard-footer"><span>RESTAURANT AUTOPILOT</span><span>{format === 'story' ? 'STORY' : 'FEED'}</span></div>
          </div>
          <p className="stage-note">Preview je umanjen. Izvoz se radi direktno u punoj rezoluciji.</p>
        </section>
      </div>
    </>
  )
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
}) {
  const { width, height, template, primary, accent } = input
  const story = height > 1500
  const margin = story ? 78 : 64
  const headSize = story ? 104 : 78
  const bodySize = story ? 36 : 28
  const lines = wrap(input.headline || 'Naslov objave', story ? 18 : 22, story ? 4 : 3)
  const bodyLines = wrap(input.subline || '', story ? 38 : 48, story ? 4 : 3)
  const copyY = template === 'minimal' ? Math.round(height * .58) : Math.round(height * .54)
  const overlay = template === 'bold' ? '.78' : template === 'minimal' ? '.64' : '.72'
  const background = input.backgroundData
    ? `<image href="${input.backgroundData}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/><rect width="${width}" height="${height}" fill="url(#shade)"/>`
    : `<rect width="${width}" height="${height}" fill="${primary}"/><circle cx="${width * .82}" cy="${height * .18}" r="${width * .44}" fill="${accent}" opacity=".12"/><circle cx="${width * .12}" cy="${height * .72}" r="${width * .38}" fill="#ffffff" opacity=".05"/>`

  const logo = input.logoData
    ? `<image href="${input.logoData}" x="${margin}" y="${margin}" width="${story ? 116 : 92}" height="${story ? 116 : 92}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${margin}" y="${margin}" rx="24" width="${story ? 116 : 92}" height="${story ? 116 : 92}" fill="${accent}"/><text x="${margin + (story ? 58 : 46)}" y="${margin + (story ? 75 : 60)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story ? 58 : 46}" font-weight="800" fill="${primary}">${escapeXml(input.restaurantName.slice(0,1).toUpperCase())}</text>`

  const textX = margin
  const lineHeight = headSize * 1.02
  const headlineSvg = lines.map((line, index) => `<text x="${textX}" y="${copyY + index * lineHeight}" font-family="Arial,sans-serif" font-size="${headSize}" font-weight="900" letter-spacing="-3" fill="#ffffff">${escapeXml(line)}</text>`).join('')
  const bodyStart = copyY + lines.length * lineHeight + (story ? 42 : 30)
  const bodySvg = bodyLines.map((line, index) => `<text x="${textX}" y="${bodyStart + index * bodySize * 1.35}" font-family="Arial,sans-serif" font-size="${bodySize}" font-weight="500" fill="#f4f6f3" opacity=".94">${escapeXml(line)}</text>`).join('')
  const ctaY = bodyStart + Math.max(1, bodyLines.length) * bodySize * 1.35 + (story ? 58 : 38)
  const price = input.price ? `<rect x="${margin}" y="${copyY - (story ? 98 : 76)}" rx="999" width="${story ? 260 : 210}" height="${story ? 64 : 52}" fill="${accent}"/><text x="${margin + (story ? 130 : 105)}" y="${copyY - (story ? 55 : 41)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story ? 30 : 24}" font-weight="900" fill="${primary}">${escapeXml(input.price)}</text>` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08100b" stop-opacity=".06"/><stop offset=".48" stop-color="#08100b" stop-opacity=".18"/><stop offset="1" stop-color="#08100b" stop-opacity="${overlay}"/></linearGradient></defs>
    ${background}
    ${template === 'editorial' ? `<rect x="${margin}" y="${Math.round(height*.18)}" width="8" height="${Math.round(height*.14)}" rx="4" fill="${accent}" opacity=".95"/>` : ''}
    ${template === 'bold' ? `<rect x="0" y="${Math.round(height*.49)}" width="${width}" height="${Math.round(height*.51)}" fill="${primary}" opacity=".76"/>` : ''}
    ${logo}
    <text x="${margin + (story ? 142 : 116)}" y="${margin + (story ? 43 : 35)}" font-family="Arial,sans-serif" font-size="${story ? 34 : 27}" font-weight="800" fill="#ffffff">${escapeXml(input.restaurantName)}</text>
    <text x="${margin + (story ? 142 : 116)}" y="${margin + (story ? 78 : 66)}" font-family="Arial,sans-serif" font-size="${story ? 23 : 19}" fill="#ffffff" opacity=".76">${escapeXml(input.location || 'Restaurant')}</text>
    ${price}
    ${headlineSvg}
    ${bodySvg}
    <rect x="${margin}" y="${ctaY}" rx="999" width="${story ? 390 : 320}" height="${story ? 82 : 64}" fill="${accent}"/>
    <text x="${margin + (story ? 195 : 160)}" y="${ctaY + (story ? 53 : 42)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${story ? 31 : 25}" font-weight="800" fill="${primary}">${escapeXml(input.cta || 'Svrati danas')}  →</text>
    <text x="${margin}" y="${height - margin}" font-family="Arial,sans-serif" font-size="${story ? 20 : 16}" font-weight="700" letter-spacing="4" fill="#ffffff" opacity=".55">RESTAURANT AUTOPILOT</text>
  </svg>`
}
