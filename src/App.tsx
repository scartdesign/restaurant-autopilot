import { useEffect, useState } from 'react'
import { CalendarDays, ChefHat, Image as ImageIcon, LogOut, Megaphone, Palette, Send, Settings, UtensilsCrossed, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { MenuItem, Post, Restaurant } from './types'
import { AuthScreen } from './components/AuthScreen'
import { Onboarding } from './components/Onboarding'
import { Dashboard } from './components/Dashboard'
import { MenuManager } from './components/MenuManager'
import { Promotions } from './components/Promotions'
import { SettingsPanel } from './components/SettingsPanel'
import { DemoScreen } from './components/DemoScreen'
import { VisualStudio } from './components/VisualStudio'
import { PublishCenter } from './components/PublishCenter'
import { BrandKit } from './components/BrandKit'

type Tab = 'dashboard' | 'studio' | 'brand' | 'publish' | 'menu' | 'promotions' | 'settings'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
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
    void loadRestaurant()
  }, [session])

  async function loadRestaurant() {
    setLoading(true)
    const { data, error } = await supabase.from('restaurants').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (error) {
      setNotice(error.message)
      setLoading(false)
      return
    }
    setRestaurant(data as Restaurant | null)
    if (data) await Promise.all([loadMenu(data.id), loadPosts(data.id)])
    setLoading(false)
  }

  async function loadMenu(restaurantId: string) {
    const { data, error } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
    if (error) setNotice(error.message)
    else setMenuItems((data || []) as MenuItem[])
  }

  async function loadPosts(restaurantId: string) {
    const { data, error } = await supabase.from('posts').select('*').eq('restaurant_id', restaurantId).order('scheduled_for', { ascending: false }).limit(40)
    if (error) setNotice(error.message)
    else setPosts((data || []) as Post[])
  }

  async function refreshContent() {
    if (!restaurant) return
    await Promise.all([loadMenu(restaurant.id), loadPosts(restaurant.id)])
  }

  async function openTab(tab: Tab) {
    if (restaurant) {
      if (tab === 'dashboard' || tab === 'publish' || tab === 'studio') await loadPosts(restaurant.id)
      if (tab === 'menu' || tab === 'promotions' || tab === 'studio' || tab === 'brand') await loadMenu(restaurant.id)
    }
    setActiveTab(tab)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (demo) return <DemoScreen onExit={() => setDemo(false)} />
  if (loading) return <div className="screen-center"><div className="loader" />Učitavanje Restaurant Autopilota…</div>
  if (!session) return <AuthScreen onDemo={() => setDemo(true)} />
  if (!restaurant) return <Onboarding userId={session.user.id} onCreated={loadRestaurant} />

  return (
    <div className="app-shell">
      <aside className="sidebar sidebar-pro">
        <div>
          <div className="brand-mark"><div className="brand-icon"><ChefHat size={21} /></div><span>Restaurant<br /><strong>Autopilot</strong></span></div>
          <div className="restaurant-chip">
            {restaurant.logo_url ? <img className="sidebar-logo" src={restaurant.logo_url} alt="" /> : <div className="avatar" style={{ background: restaurant.secondary_color || undefined }}>{restaurant.name.slice(0, 1).toUpperCase()}</div>}
            <div><strong>{restaurant.name}</strong><small>{restaurant.neighborhood || restaurant.city || restaurant.cuisine_type || 'Restoran'}</small></div>
          </div>
          <div className="autopilot-status"><span className="live-dot" /> DESIGN + DISCOVERY ACTIVE</div>
          <nav>
            <button className={activeTab === 'dashboard' ? 'nav-active' : ''} onClick={() => void openTab('dashboard')}><CalendarDays size={18} /> Sadržaj</button>
            <button className={activeTab === 'studio' ? 'nav-active' : ''} onClick={() => void openTab('studio')}><ImageIcon size={18} /> Visual Studio</button>
            <button className={activeTab === 'brand' ? 'nav-active brand-nav' : 'brand-nav'} onClick={() => void openTab('brand')}><Palette size={18} /> Brend <span className="nav-beta">LOGO</span></button>
            <button className={activeTab === 'publish' ? 'nav-active' : ''} onClick={() => void openTab('publish')}><Send size={18} /> Publish Center</button>
            <button className={activeTab === 'menu' ? 'nav-active' : ''} onClick={() => void openTab('menu')}><UtensilsCrossed size={18} /> Meni</button>
            <button className={activeTab === 'promotions' ? 'nav-active' : ''} onClick={() => void openTab('promotions')}><Megaphone size={18} /> Akcije</button>
            <button className={activeTab === 'settings' ? 'nav-active' : ''} onClick={() => void openTab('settings')}><Settings size={18} /> Podešavanja</button>
          </nav>
        </div>
        <button className="logout" onClick={signOut}><LogOut size={18} /> Odjavi se</button>
      </aside>

      <main className="main-area">
        {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}
        {activeTab === 'dashboard' && <Dashboard restaurant={restaurant} menuItems={menuItems} posts={posts} onChanged={refreshContent} setNotice={setNotice} />}
        {activeTab === 'studio' && <VisualStudio restaurant={restaurant} menuItems={menuItems} posts={posts} setNotice={setNotice} />}
        {activeTab === 'brand' && <BrandKit restaurant={restaurant} menuItems={menuItems} onSaved={loadRestaurant} setNotice={setNotice} />}
        {activeTab === 'publish' && <PublishCenter restaurant={restaurant} posts={posts} onChanged={() => loadPosts(restaurant.id)} setNotice={setNotice} />}
        {activeTab === 'menu' && <MenuManager restaurant={restaurant} userId={session.user.id} items={menuItems} onChanged={() => loadMenu(restaurant.id)} setNotice={setNotice} />}
        {activeTab === 'promotions' && <Promotions restaurant={restaurant} menuItems={menuItems} onChanged={() => loadPosts(restaurant.id)} setNotice={setNotice} />}
        {activeTab === 'settings' && <SettingsPanel restaurant={restaurant} onSaved={loadRestaurant} setNotice={setNotice} />}
      </main>
    </div>
  )
}

export default App