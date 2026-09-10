import { useEffect, useMemo, useState } from 'react'
import { BadgeEuro, Building2, CalendarDays, ChefHat, Image as ImageIcon, LockKeyhole, LogOut, Megaphone, Palette, Plus, Send, Settings, ShieldCheck, UtensilsCrossed, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Entitlement, MenuItem, Post, Restaurant } from './types'
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
import { BillingPage } from './components/BillingPage'
import { SuperAdmin } from './components/SuperAdmin'
import { AdminSetup } from './components/AdminSetup'

type Tab = 'dashboard' | 'studio' | 'brand' | 'publish' | 'menu' | 'promotions' | 'settings' | 'billing' | 'admin'
const ACTIVE_RESTAURANT_KEY = 'restaurant-autopilot-active-restaurant'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountReady, setAccountReady] = useState(false)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [demo, setDemo] = useState(false)
  const [addingRestaurant, setAddingRestaurant] = useState(false)
  const adminSetupRequested = new URLSearchParams(window.location.search).get('superadmin') === 'setup'

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) resetLocalState()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setLoading(false); return }
    void boot(session)
  }, [session?.user.id])

  function resetLocalState() {
    setRestaurants([]); setRestaurant(null); setMenuItems([]); setPosts([]); setEntitlement(null)
    setIsSuperadmin(false); setHasAccess(false); setAccountReady(false); setActiveTab('dashboard'); setAddingRestaurant(false)
  }

  async function boot(currentSession = session) {
    if (!currentSession) return
    setLoading(true)
    await loadAccountState()
    await loadRestaurants(currentSession.user.id)
    setAccountReady(true)
    setLoading(false)
  }

  async function loadAccountState() {
    const [{ data: adminData, error: adminError }, { data: accessData, error: accessError }, { data: entitlementData, error: entitlementError }] = await Promise.all([
      supabase.rpc('is_superadmin'), supabase.rpc('has_active_access'), supabase.rpc('current_entitlement'),
    ])
    const error = adminError || accessError || entitlementError
    if (error) setNotice(error.message)
    const admin = Boolean(adminData)
    setIsSuperadmin(admin); setHasAccess(Boolean(accessData) || admin); setEntitlement((entitlementData || null) as Entitlement | null)
    if (admin) setActiveTab(current => current === 'dashboard' && !restaurant ? 'admin' : current)
  }

  async function loadRestaurants(ownerId = session?.user.id, preferredId?: string) {
    if (!ownerId) return
    const { data, error } = await supabase.from('restaurants').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true })
    if (error) { setNotice(error.message); return }
    const list = (data || []) as Restaurant[]
    setRestaurants(list)
    const stored = preferredId || localStorage.getItem(ACTIVE_RESTAURANT_KEY) || ''
    const selected = list.find(item => item.id === stored) || list[0] || null
    setRestaurant(selected)
    if (selected) {
      localStorage.setItem(ACTIVE_RESTAURANT_KEY, selected.id)
      await Promise.all([loadMenu(selected.id), loadPosts(selected.id)])
    } else { setMenuItems([]); setPosts([]) }
  }

  async function selectRestaurant(id: string) {
    const next = restaurants.find(item => item.id === id)
    if (!next || next.id === restaurant?.id) return
    setRestaurant(next); localStorage.setItem(ACTIVE_RESTAURANT_KEY, next.id); setLoading(true)
    await Promise.all([loadMenu(next.id), loadPosts(next.id)])
    setActiveTab('dashboard'); setLoading(false)
  }

  async function loadMenu(restaurantId: string) {
    const { data, error } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
    if (error) setNotice(error.message); else setMenuItems((data || []) as MenuItem[])
  }
  async function loadPosts(restaurantId: string) {
    const { data, error } = await supabase.from('posts').select('*').eq('restaurant_id', restaurantId).order('scheduled_for', { ascending: false }).limit(60)
    if (error) setNotice(error.message); else setPosts((data || []) as Post[])
  }
  async function refreshContent() { if (restaurant) await Promise.all([loadMenu(restaurant.id), loadPosts(restaurant.id), loadAccountState()]) }
  async function refreshRestaurant() { if (session && restaurant) await loadRestaurants(session.user.id, restaurant.id) }

  async function openTab(tab: Tab) {
    if (tab === 'promotions' && !canUseCampaigns) {
      setNotice('Campaign Autopilot je uključen u Pro i Business paket. Paket možeš promeniti iz „Paket / licenca“.')
      setActiveTab('billing'); return
    }
    if (restaurant) {
      if (tab === 'dashboard' || tab === 'publish' || tab === 'studio') await loadPosts(restaurant.id)
      if (tab === 'menu' || tab === 'promotions' || tab === 'studio' || tab === 'brand') await loadMenu(restaurant.id)
    }
    setActiveTab(tab)
  }

  async function accessChanged() { await loadAccountState(); if (session) await loadRestaurants(session.user.id, restaurant?.id); setActiveTab('dashboard') }
  async function adminActivated() { window.history.replaceState({}, '', window.location.pathname); await loadAccountState(); setActiveTab('admin') }
  async function signOut() { await supabase.auth.signOut() }

  const canUseCampaigns = isSuperadmin || entitlement?.features?.campaigns === true
  const restaurantLimit = entitlement?.restaurants_limit ?? (isSuperadmin ? null : 1)
  const canAddRestaurant = isSuperadmin || (Boolean(entitlement?.active) && (restaurantLimit === null || restaurants.length < restaurantLimit))
  const remainingRestaurants = restaurantLimit === null ? null : Math.max(0, restaurantLimit - restaurants.length)
  const planName = isSuperadmin ? 'OWNER' : entitlement?.plan_name || 'Aktivan paket'
  const generationUsage = useMemo(() => entitlement?.generation_limit == null ? null : `${entitlement.generated_this_month || 0}/${entitlement.generation_limit}`, [entitlement])

  if (demo) return <DemoScreen onExit={() => setDemo(false)} />
  if (loading || (session && !accountReady)) return <div className="screen-center"><div className="loader" />Učitavanje Restaurant Autopilota…</div>
  if (!session) return <AuthScreen onDemo={() => setDemo(true)} />
  if (adminSetupRequested && !isSuperadmin) return <AdminSetup email={session.user.email || ''} onActivated={adminActivated} onCancel={() => { window.history.replaceState({}, '', window.location.pathname); void loadAccountState() }} />
  if (!isSuperadmin && !hasAccess) return <BillingPage email={session.user.email || ''} onAccessChanged={accessChanged} onSignOut={signOut} />

  if (addingRestaurant) return <Onboarding additional userId={session.user.id} onCancel={() => setAddingRestaurant(false)} onCreated={async () => { setAddingRestaurant(false); await loadAccountState(); await loadRestaurants(session.user.id); setActiveTab('dashboard') }} />

  if (!restaurant) {
    if (isSuperadmin && activeTab === 'admin') return <div className="standalone-admin"><SuperAdmin setNotice={setNotice} onCloseApp={() => setActiveTab('dashboard')} />{notice && <div className="notice floating-notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}</div>
    return <Onboarding userId={session.user.id} onCreated={async () => { await loadAccountState(); await loadRestaurants(session.user.id); setActiveTab('dashboard') }} />
  }

  return <div className="app-shell">
    <aside className="sidebar sidebar-pro"><div>
      <div className="brand-mark"><div className="brand-icon"><ChefHat size={21}/></div><span>Restaurant<br/><strong>Autopilot</strong></span></div>
      <div className="restaurant-chip restaurant-switcher">{restaurant.logo_url?<img className="sidebar-logo" src={restaurant.logo_url} alt=""/>:<div className="avatar" style={{background:restaurant.secondary_color||undefined}}>{restaurant.name.slice(0,1).toUpperCase()}</div>}<div className="restaurant-switch-copy"><strong>{restaurant.name}</strong><small>{restaurant.neighborhood||restaurant.city||restaurant.cuisine_type||'Restoran'}</small></div></div>
      {(restaurants.length > 1 || restaurantLimit === null || (restaurantLimit || 1) > 1) && <div className="location-control"><label><Building2 size={14}/><select value={restaurant.id} onChange={e=>void selectRestaurant(e.target.value)}>{restaurants.map(item=><option key={item.id} value={item.id}>{item.name}{item.city?` · ${item.city}`:''}</option>)}</select></label>{canAddRestaurant?<button onClick={()=>setAddingRestaurant(true)} title="Dodaj restoran"><Plus size={15}/><span>Dodaj lokaciju</span></button>:<small>Limit paketa: {restaurants.length}/{restaurantLimit}</small>}</div>}
      <div className={`autopilot-status ${isSuperadmin?'owner-status':''}`}><span className="live-dot"/> {isSuperadmin?'OWNER · SUPERADMIN':`${planName.toUpperCase()} · AKTIVAN`}</div>
      {!isSuperadmin && <div className="sidebar-plan-mini"><span>{restaurants.length}/{restaurantLimit || '∞'} lokacija</span>{generationUsage&&<span>{generationUsage} objava</span>}{remainingRestaurants===0&&restaurantLimit!==null?<small>Za više lokacija promeni paket.</small>:null}</div>}
      <nav>
        <button className={activeTab==='dashboard'?'nav-active':''} onClick={()=>void openTab('dashboard')}><CalendarDays size={18}/> Sadržaj</button>
        <button className={activeTab==='studio'?'nav-active':''} onClick={()=>void openTab('studio')}><ImageIcon size={18}/> Visual Studio</button>
        <button className={activeTab==='brand'?'nav-active brand-nav':'brand-nav'} onClick={()=>void openTab('brand')}><Palette size={18}/> Brend <span className="nav-beta">LOGO</span></button>
        <button className={activeTab==='publish'?'nav-active':''} onClick={()=>void openTab('publish')}><Send size={18}/> Publish Center</button>
        <button className={activeTab==='menu'?'nav-active':''} onClick={()=>void openTab('menu')}><UtensilsCrossed size={18}/> Meni</button>
        <button className={`${activeTab==='promotions'?'nav-active ':''}${canUseCampaigns?'':'locked-nav'}`} onClick={()=>void openTab('promotions')}><Megaphone size={18}/> Akcije {!canUseCampaigns&&<span className="nav-beta"><LockKeyhole size={9}/> PRO</span>}</button>
        <button className={activeTab==='billing'?'nav-active billing-nav':'billing-nav'} onClick={()=>void openTab('billing')}><BadgeEuro size={18}/> Paket / licenca</button>
        <button className={activeTab==='settings'?'nav-active':''} onClick={()=>void openTab('settings')}><Settings size={18}/> Podešavanja</button>
        {isSuperadmin&&<button className={activeTab==='admin'?'nav-active admin-nav':'admin-nav'} onClick={()=>void openTab('admin')}><ShieldCheck size={18}/> Superadmin <span className="nav-beta">OWNER</span></button>}
      </nav>
    </div><button className="logout" onClick={signOut}><LogOut size={18}/> Odjavi se</button></aside>

    <main className={`main-area ${activeTab==='admin'?'admin-main-area':''}`}>{notice&&<div className="notice"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
      {activeTab==='dashboard'&&<Dashboard restaurant={restaurant} menuItems={menuItems} posts={posts} onChanged={refreshContent} setNotice={setNotice}/>} 
      {activeTab==='studio'&&<VisualStudio restaurant={restaurant} menuItems={menuItems} posts={posts} setNotice={setNotice}/>} 
      {activeTab==='brand'&&<BrandKit restaurant={restaurant} menuItems={menuItems} onSaved={refreshRestaurant} setNotice={setNotice}/>} 
      {activeTab==='publish'&&<PublishCenter restaurant={restaurant} posts={posts} onChanged={()=>loadPosts(restaurant.id)} setNotice={setNotice}/>} 
      {activeTab==='menu'&&<MenuManager restaurant={restaurant} userId={session.user.id} items={menuItems} onChanged={()=>loadMenu(restaurant.id)} setNotice={setNotice}/>} 
      {activeTab==='promotions'&&canUseCampaigns&&<Promotions restaurant={restaurant} menuItems={menuItems} onChanged={refreshContent} setNotice={setNotice}/>} 
      {activeTab==='billing'&&<BillingPage email={session.user.email||''} onAccessChanged={accessChanged} onSignOut={signOut}/>} 
      {activeTab==='settings'&&<SettingsPanel restaurant={restaurant} onSaved={refreshRestaurant} setNotice={setNotice}/>} 
      {activeTab==='admin'&&isSuperadmin&&<SuperAdmin setNotice={setNotice} onCloseApp={()=>setActiveTab('dashboard')}/>} 
    </main>
  </div>
}
export default App
