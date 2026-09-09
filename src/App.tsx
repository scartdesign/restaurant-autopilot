import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChefHat, LogOut, Plus, Sparkles, UtensilsCrossed } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Restaurant = {
  id: string
  owner_id: string
  name: string
  city: string | null
  phone: string | null
  website: string | null
  instagram: string | null
  cuisine_type: string | null
  brand_style: string
  primary_color: string | null
  onboarding_completed: boolean
}

type MenuItem = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  category: string | null
  price: number | null
  currency: string
  image_url: string | null
  is_active: boolean
}

type Post = {
  id: string
  restaurant_id: string
  post_type: 'feed' | 'story' | 'promotion'
  scheduled_for: string | null
  title: string | null
  caption: string | null
  cta: string | null
  hashtags: string[]
  status: string
}

function mondayOfCurrentWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10)
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu'>('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setRestaurant(null)
        setMenuItems([])
        setPosts([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    loadRestaurant()
  }, [session])

  async function loadRestaurant() {
    setLoading(true)
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      setNotice(error.message)
      setLoading(false)
      return
    }

    setRestaurant(data)
    if (data) {
      await Promise.all([loadMenu(data.id), loadPosts(data.id)])
    }
    setLoading(false)
  }

  async function loadMenu(restaurantId: string) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })

    if (!error) setMenuItems(data ?? [])
  }

  async function loadPosts(restaurantId: string) {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('scheduled_for', { ascending: true })
      .limit(20)

    if (!error) setPosts(data ?? [])
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const approvedCount = useMemo(() => posts.filter((post) => post.status === 'approved').length, [posts])

  if (loading) {
    return <div className="screen-center"><div className="loader" />Učitavanje Restaurant Autopilota…</div>
  }

  if (!session) return <AuthScreen />

  if (!restaurant) {
    return <Onboarding userId={session.user.id} onCreated={loadRestaurant} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-mark"><ChefHat size={24} /><span>Restaurant<br /><strong>Autopilot</strong></span></div>
          <div className="restaurant-chip">
            <div className="avatar">{restaurant.name.slice(0, 1).toUpperCase()}</div>
            <div><strong>{restaurant.name}</strong><small>{restaurant.city || 'Restoran'}</small></div>
          </div>
          <nav>
            <button className={activeTab === 'dashboard' ? 'nav-active' : ''} onClick={() => setActiveTab('dashboard')}><CalendarDays size={18} /> Sadržaj</button>
            <button className={activeTab === 'menu' ? 'nav-active' : ''} onClick={() => setActiveTab('menu')}><UtensilsCrossed size={18} /> Meni</button>
          </nav>
        </div>
        <button className="logout" onClick={signOut}><LogOut size={18} /> Odjavi se</button>
      </aside>

      <main className="main-area">
        {notice && <div className="notice">{notice}</div>}
        {activeTab === 'dashboard' ? (
          <Dashboard
            restaurant={restaurant}
            menuItems={menuItems}
            posts={posts}
            approvedCount={approvedCount}
            onGenerated={() => loadPosts(restaurant.id)}
            setNotice={setNotice}
          />
        ) : (
          <MenuManager restaurant={restaurant} items={menuItems} onChanged={() => loadMenu(restaurant.id)} setNotice={setNotice} />
        )}
      </main>
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    setMessage('')

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Proveri email i potvrdi registraciju.')
    setWorking(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><ChefHat size={28} /></div>
        <p className="eyebrow">MARKETING BEZ CIMANJA</p>
        <h1>Restaurant Autopilot</h1>
        <p className="muted">Meni unutra. Sadržaj napolje. Svake nedelje.</p>
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="restoran@email.com" /></label>
          <label>Lozinka<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Najmanje 6 karaktera" /></label>
          <button className="primary full" disabled={working}>{working ? 'Sačekaj…' : mode === 'login' ? 'Prijavi se' : 'Napravi nalog'}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
        <button className="text-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Nemaš nalog? Registruj restoran' : 'Već imaš nalog? Prijavi se'}
        </button>
      </div>
    </div>
  )
}

function Onboarding({ userId, onCreated }: { userId: string; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', city: '', cuisine_type: '', brand_style: 'modern', phone: '', instagram: '' })
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    const { error } = await supabase.from('restaurants').insert({
      owner_id: userId,
      ...form,
      onboarding_completed: true,
    })
    if (error) setMessage(error.message)
    else await onCreated()
    setWorking(false)
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <p className="eyebrow">KORAK 1 OD 1</p>
        <h1>Podesi svoj restoran</h1>
        <p className="muted">Ovo nam daje osnovu za ton, izgled i sadržaj koji ćemo praviti.</p>
        <form onSubmit={submit} className="grid-form">
          <label>Naziv restorana<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bella Napoli" /></label>
          <label>Grad<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Beograd" /></label>
          <label>Tip kuhinje<input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} placeholder="Italijanska" /></label>
          <label>Stil brenda<select value={form.brand_style} onChange={(e) => setForm({ ...form, brand_style: e.target.value })}><option value="modern">Moderan</option><option value="premium">Premium</option><option value="traditional">Tradicionalan</option><option value="fast_food">Fast food</option><option value="casual">Casual</option></select></label>
          <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+381…" /></label>
          <label>Instagram<input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@bellanapoli" /></label>
          <button className="primary span-2" disabled={working}>{working ? 'Kreiram…' : 'Pokreni moj Autopilot'}</button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </div>
    </div>
  )
}

function Dashboard({ restaurant, menuItems, posts, approvedCount, onGenerated, setNotice }: {
  restaurant: Restaurant
  menuItems: MenuItem[]
  posts: Post[]
  approvedCount: number
  onGenerated: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [generating, setGenerating] = useState(false)

  async function generateWeek() {
    if (menuItems.length === 0) {
      setNotice('Prvo dodaj bar jedno jelo u meni.')
      return
    }

    setGenerating(true)
    setNotice('')
    const monday = mondayOfCurrentWeek()
    const weekStart = yyyyMmDd(monday)

    const { data: plan, error: planError } = await supabase
      .from('content_plans')
      .upsert({ restaurant_id: restaurant.id, week_start: weekStart, status: 'generated' }, { onConflict: 'restaurant_id,week_start' })
      .select()
      .single()

    if (planError) {
      setNotice(planError.message)
      setGenerating(false)
      return
    }

    await supabase.from('posts').delete().eq('content_plan_id', plan.id).eq('status', 'draft')

    const selected = [...menuItems].filter((item) => item.is_active).slice(0, 3)
    const days = [0, 2, 4]
    const payload = selected.map((item, index) => {
      const scheduled = new Date(monday)
      scheduled.setDate(monday.getDate() + days[index])
      scheduled.setHours(index === 2 ? 17 : 11, 0, 0, 0)
      const price = item.price ? `${item.price} ${item.currency}` : ''
      return {
        restaurant_id: restaurant.id,
        content_plan_id: plan.id,
        menu_item_id: item.id,
        post_type: index === 2 ? 'promotion' : 'feed',
        scheduled_for: scheduled.toISOString(),
        title: item.name,
        caption: index === 2
          ? `Vikend je bolji uz ${item.name}. ${price ? `Danas za ${price}. ` : ''}Rezerviši sto i prepusti ostalo nama.`
          : `${item.name} zaslužuje mesto na tvom stolu. ${item.description || 'Sveže pripremljeno i spremno za uživanje.'}`,
        cta: index === 2 ? 'Rezerviši sto' : 'Svrati danas',
        hashtags: [`#${restaurant.name.replace(/\s+/g, '')}`, '#restoran', '#food'],
        visual_brief: `Koristi fotografiju jela ${item.name}; stil: ${restaurant.brand_style}; čist premium raspored.`,
        status: 'draft',
      }
    })

    if (payload.length) {
      const { error } = await supabase.from('posts').insert(payload)
      if (error) setNotice(error.message)
      else setNotice('Nedeljni sadržaj je napravljen. Ovo je template engine MVP; AI generisanje dodajemo sledeće.')
    }

    await onGenerated()
    setGenerating(false)
  }

  async function approvePost(id: string) {
    const { error } = await supabase.from('posts').update({ status: 'approved' }).eq('id', id)
    if (error) setNotice(error.message)
    else await onGenerated()
  }

  return (
    <>
      <header className="page-header">
        <div><p className="eyebrow">DOBRO DOŠLI</p><h1>{restaurant.name}</h1><p className="muted">Jedna tabla za celu marketinšku nedelju.</p></div>
        <button className="primary" onClick={generateWeek} disabled={generating}><Sparkles size={18} /> {generating ? 'Generišem…' : 'Generiši ovu nedelju'}</button>
      </header>

      <section className="stats-grid">
        <div className="stat-card"><span>Jela u meniju</span><strong>{menuItems.length}</strong></div>
        <div className="stat-card"><span>Generisane objave</span><strong>{posts.length}</strong></div>
        <div className="stat-card"><span>Odobreno</span><strong>{approvedCount}</strong></div>
      </section>

      <section className="content-section">
        <div className="section-title"><div><p className="eyebrow">CONTENT PLAN</p><h2>Sadržaj ove nedelje</h2></div></div>
        {posts.length === 0 ? (
          <div className="empty-state"><Sparkles size={30} /><h3>Još nema sadržaja</h3><p>Dodaj jela u meni, zatim klikni „Generiši ovu nedelju“.</p></div>
        ) : (
          <div className="post-grid">
            {posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="post-preview"><span>{post.post_type === 'story' ? 'STORY' : post.post_type === 'promotion' ? 'PROMO' : 'FEED'}</span><ChefHat size={34} /></div>
                <div className="post-body">
                  <div className="post-meta">{post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Bez termina'} <span className={`status ${post.status}`}>{post.status}</span></div>
                  <h3>{post.title}</h3>
                  <p>{post.caption}</p>
                  <div className="hashtags">{post.hashtags?.join(' ')}</div>
                  {post.status !== 'approved' ? <button className="secondary full" onClick={() => approvePost(post.id)}><CheckCircle2 size={17} /> Odobri</button> : <div className="approved-line"><CheckCircle2 size={17} /> Odobreno</div>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function MenuManager({ restaurant, items, onChanged, setNotice }: {
  restaurant: Restaurant
  items: MenuItem[]
  onChanged: () => Promise<void>
  setNotice: (value: string) => void
}) {
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '' })
  const [working, setWorking] = useState(false)

  async function addItem(event: FormEvent) {
    event.preventDefault()
    setWorking(true)
    const { error } = await supabase.from('menu_items').insert({
      restaurant_id: restaurant.id,
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      price: form.price ? Number(form.price) : null,
      currency: 'RSD',
    })
    if (error) setNotice(error.message)
    else {
      setForm({ name: '', description: '', category: '', price: '' })
      setNotice('Jelo je dodato.')
      await onChanged()
    }
    setWorking(false)
  }

  return (
    <>
      <header className="page-header"><div><p className="eyebrow">MENI</p><h1>Jela i proizvodi</h1><p className="muted">Ovo je gorivo za Autopilot.</p></div></header>
      <div className="menu-layout">
        <form className="panel add-menu-form" onSubmit={addItem}>
          <h2><Plus size={19} /> Dodaj jelo</h2>
          <label>Naziv<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pizza Capricciosa" /></label>
          <label>Kategorija<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Pizza" /></label>
          <label>Cena<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="890" /></label>
          <label>Opis<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Pelat, mozzarella, šunka, pečurke…" rows={4} /></label>
          <button className="primary full" disabled={working}>{working ? 'Dodajem…' : 'Dodaj u meni'}</button>
        </form>
        <section className="panel">
          <h2>Trenutni meni <span className="pill">{items.length}</span></h2>
          <div className="menu-list">
            {items.length === 0 ? <div className="empty-small">Još nema jela.</div> : items.map((item) => (
              <div className="menu-row" key={item.id}>
                <div className="food-icon"><UtensilsCrossed size={18} /></div>
                <div className="menu-copy"><strong>{item.name}</strong><small>{item.category || 'Bez kategorije'}{item.description ? ` · ${item.description}` : ''}</small></div>
                <div className="price">{item.price ? `${item.price} ${item.currency}` : '—'}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

export default App
