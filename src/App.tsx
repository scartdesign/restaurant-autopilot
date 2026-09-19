import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { BadgeEuro, BarChart3, Bell, Building2, CalendarDays, ChefHat, Download, Image as ImageIcon, LifeBuoy, LockKeyhole, LogOut, Megaphone, Menu as MenuIcon, Palette, Plus, RefreshCw, Rocket, Send, Settings, Share2, ShieldCheck, Smartphone, Sparkles, UtensilsCrossed, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Entitlement, MenuItem, Post, Restaurant } from './types'
import { AuthScreen } from './components/AuthScreen'
import { PasswordRecovery } from './components/PasswordRecovery'
import { Onboarding } from './components/Onboarding'
import { AdminSetup } from './components/AdminSetup'
import { LaunchCenter } from './components/LaunchCenter'
import { LandingScreen } from './components/LandingScreen'
import { LegalScreen } from './components/LegalScreen'
import { NetworkStatus } from './components/NetworkStatus'

const DemoScreen = lazy(() => import('./components/DemoScreen').then((m) => ({ default: m.DemoScreen })))
const VisualStudio = lazy(() => import('./components/VisualStudio').then((m) => ({ default: m.VisualStudio })))
const PublishCenter = lazy(() => import('./components/PublishCenter').then((m) => ({ default: m.PublishCenter })))
const BrandKit = lazy(() => import('./components/BrandKit').then((m) => ({ default: m.BrandKit })))
const BillingPage = lazy(() => import('./components/BillingPage').then((m) => ({ default: m.BillingPage })))
const OwnerControlPlus = lazy(() => import('./components/OwnerControlPlus').then((m) => ({ default: m.OwnerControlPlus })))
const CreativeHub = lazy(() => import('./components/CreativeHub').then((m) => ({ default: m.CreativeHub })))
const InsightsCenter = lazy(() => import('./components/InsightsCenter').then((m) => ({ default: m.InsightsCenter })))
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })))
const MenuManager = lazy(() => import('./components/MenuManager').then((m) => ({ default: m.MenuManager })))
const Promotions = lazy(() => import('./components/Promotions').then((m) => ({ default: m.Promotions })))
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then((m) => ({ default: m.SettingsPanel })))
const SupportCenter = lazy(() => import('./components/SupportCenter').then((m) => ({ default: m.SupportCenter })))
const NotificationsCenter = lazy(() => import('./components/NotificationsCenter').then((m) => ({ default: m.NotificationsCenter })))

type BeforeInstallPromptEvent = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed';platform:string}> }
type Tab = 'launch' | 'dashboard' | 'creative' | 'studio' | 'brand' | 'publish' | 'insights' | 'menu' | 'promotions' | 'settings' | 'support' | 'notifications' | 'billing' | 'admin'
type AppControlsLite = { maintenance_mode:boolean; maintenance_message:string|null; sales_open:boolean; signup_open:boolean; announcement_enabled:boolean; announcement_text:string|null; announcement_tone:'info'|'success'|'warning'; app_version:string }
const ACTIVE_RESTAURANT_KEY = 'restorapp-active-restaurant'\nconst LEGACY_ACTIVE_RESTAURANT_KEY = 'restaurant-autopilot-active-restaurant'
const defaultControls:AppControlsLite={maintenance_mode:false,maintenance_message:null,sales_open:true,signup_open:true,announcement_enabled:false,announcement_text:null,announcement_tone:'info',app_version:'1.0'}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [appControls,setAppControls]=useState<AppControlsLite>(defaultControls)
  const [loading, setLoading] = useState(true)
  const [accountReady, setAccountReady] = useState(false)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [notice, setNotice] = useState('')
  const [unreadNotifications,setUnreadNotifications]=useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('launch')
  const [demo, setDemo] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1' || ['htmlpreview.github.io','html-preview.github.io','raw.githack.com','rawcdn.githack.com'].includes(window.location.hostname))
  const [showAuth,setShowAuth]=useState(false)
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false)
  const [addingRestaurant, setAddingRestaurant] = useState(false)
  const [recoveryMode,setRecoveryMode]=useState(false)
  const [installPrompt,setInstallPrompt]=useState<BeforeInstallPromptEvent|null>(null)
  const [pwaInstalled,setPwaInstalled]=useState(()=>isStandaloneApp())
  const [showIosInstall,setShowIosInstall]=useState(false)
  const [pwaUpdateReady,setPwaUpdateReady]=useState(false)
  const [stripeReturnHandled,setStripeReturnHandled]=useState(false)
  const params = new URLSearchParams(window.location.search)
  const adminSetupRequested = params.get('superadmin') === 'setup'
  const legalParam = params.get('legal') as 'terms'|'privacy'|'ai'|'refund'|null

  useEffect(() => {
    void loadAppControls()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (!nextSession) resetLocalState()
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setLoading(false); return }
    void boot(session)
  }, [session?.user.id])

  useEffect(()=>{
    if(!session||stripeReturnHandled)return
    const query=new URLSearchParams(window.location.search)
    const payment=query.get('payment')
    if(payment!=='stripe-success'&&payment!=='stripe-cancel')return
    setStripeReturnHandled(true)
    void handleGlobalStripeReturn(payment,query)
  },[session?.user.id,stripeReturnHandled])

  async function handleGlobalStripeReturn(payment:string,query:URLSearchParams){
    const clean=()=>{
      query.delete('payment');query.delete('session_id');query.delete('order')
      const qs=query.toString()
      window.history.replaceState({},'',window.location.pathname+(qs?'?'+qs:'')+window.location.hash)
    }
    if(payment==='stripe-cancel'){
      const orderId=query.get('order')||''
      if(orderId)await supabase.functions.invoke('checkout-order',{body:{action:'cancel_checkout',orderId}}).catch(()=>null)
      clean()
      setNotice('Kartično plaćanje je otkazano. Narudžbina nije naplaćena i više ne blokira novu kupovinu.')
      return
    }
    const sessionId=query.get('session_id')||''
    if(!sessionId){
      clean()
      setNotice('Stripe povratak nema session ID. Proveri status narudžbine u Paketu / licenci.')
      return
    }
    setNotice('Proveravam Stripe uplatu…')
    const{data,error}=await supabase.functions.invoke('checkout-order',{body:{action:'confirm_stripe',sessionId}})
    clean()
    if(error||data?.error){
      setNotice(data?.error||error?.message||'Stripe uplata još nije potvrđena.')
      return
    }
    if(data?.paid){
      setNotice('Kartična uplata je potvrđena. Paket je aktiviran / produžen.')
      await loadAccountState()
      await loadUnreadNotifications()
      if(session)await loadRestaurants(session.user.id,restaurant?.id)
      return
    }
    setNotice('Stripe još obrađuje uplatu. Status će se osvežiti kada potvrda stigne.')
  }

  useEffect(()=>{
    const installHandler=(event:Event)=>{
      const promptEvent=event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      setInstallPrompt(promptEvent)
    }
    const installedHandler=()=>{setPwaInstalled(true);setInstallPrompt(null);setShowIosInstall(false)}
    const updateHandler=()=>setPwaUpdateReady(true)
    window.addEventListener('beforeinstallprompt',installHandler)
    window.addEventListener('appinstalled',installedHandler)
    window.addEventListener('restorapp-sw-update',updateHandler)\n    window.addEventListener('restaurant-autopilot-sw-update',updateHandler)
    const media=window.matchMedia('(display-mode: standalone)')
    const modeHandler=()=>setPwaInstalled(isStandaloneApp())
    media.addEventListener?.('change',modeHandler)
    return()=>{
      window.removeEventListener('beforeinstallprompt',installHandler)
      window.removeEventListener('appinstalled',installedHandler)
      window.removeEventListener('restorapp-sw-update',updateHandler)\n      window.removeEventListener('restaurant-autopilot-sw-update',updateHandler)
      media.removeEventListener?.('change',modeHandler)
    }
  },[])

  async function loadAppControls(){
    const {data}=await supabase.from('app_controls').select('maintenance_mode,maintenance_message,sales_open,signup_open,announcement_enabled,announcement_text,announcement_tone,app_version').eq('id',1).maybeSingle()
    if(data)setAppControls(data as AppControlsLite)
  }

  function resetLocalState() {
    setRestaurants([]); setRestaurant(null); setMenuItems([]); setPosts([]); setEntitlement(null)
    setIsSuperadmin(false); setHasAccess(false); setAccountReady(false); setActiveTab('launch'); setAddingRestaurant(false); setRecoveryMode(false)
  }

  async function boot(currentSession = session) {
    if (!currentSession) return
    setLoading(true)
    await Promise.all([loadAccountState(),loadAppControls(),loadUnreadNotifications()])
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
    if (admin) setActiveTab(current => (current === 'dashboard' || current === 'launch') && !restaurant ? 'admin' : current)
  }

  async function loadRestaurants(ownerId = session?.user.id, preferredId?: string) {
    if (!ownerId) return
    const { data, error } = await supabase.from('restaurants').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true })
    if (error) { setNotice(error.message); return }
    const list = (data || []) as Restaurant[]
    setRestaurants(list)
    const stored = preferredId || localStorage.getItem(ACTIVE_RESTAURANT_KEY) || localStorage.getItem(LEGACY_ACTIVE_RESTAURANT_KEY) || ''
    const selected = list.find(item => item.id === stored) || list[0] || null
    setRestaurant(selected)
    if (selected) {
      localStorage.setItem(ACTIVE_RESTAURANT_KEY, selected.id)
      await Promise.all([loadMenu(selected.id), loadPosts(selected.id)])
      await ensureAutopilotWeek(selected)
    } else { setMenuItems([]); setPosts([]) }
    const onboardingWarning = sessionStorage.getItem('restorapp-onboarding-warning') || sessionStorage.getItem('restaurant-autopilot-onboarding-warning')
    if (onboardingWarning) {
      sessionStorage.removeItem('restorapp-onboarding-warning')\n      sessionStorage.removeItem('restaurant-autopilot-onboarding-warning')
      setNotice(onboardingWarning)
    }
  }

  async function selectRestaurant(id: string) {
    const next = restaurants.find(item => item.id === id)
    if (!next || next.id === restaurant?.id) return
    setRestaurant(next); localStorage.setItem(ACTIVE_RESTAURANT_KEY, next.id); setLoading(true)
    await Promise.all([loadMenu(next.id), loadPosts(next.id)])
    await ensureAutopilotWeek(next)
    setActiveTab('launch'); setLoading(false)
  }

  async function ensureAutopilotWeek(target: Restaurant) {
    if (!target.weekly_autopilot_enabled) return
    const dateKey = localDateKey(target.timezone || 'Europe/Belgrade')
    const attemptKey = `restorapp-weekly-check:${target.id}:${dateKey}`
    if (sessionStorage.getItem(attemptKey)) return
    sessionStorage.setItem(attemptKey, 'inflight')

    const { data: preflightData, error: preflightError } = await supabase.functions.invoke('content-engine', {
      body: { action: 'preflight', restaurantId: target.id },
    })
    if (preflightError || preflightData?.error) {
      sessionStorage.removeItem(attemptKey)
      return
    }
    if (preflightData?.existing) {
      const polished=await polishBackgroundDrafts(target)
      sessionStorage.setItem(attemptKey, 'done')
      if(polished)setNotice(`Background AUTO WEEK je već bio spreman · AI je doradio ${polished} draftova.`)
      return
    }
    if (!preflightData?.ready) {
      sessionStorage.setItem(attemptKey, 'blocked')
      const blockers=(preflightData?.blockers||[]).map((item:any)=>item.label).filter(Boolean)
      if(blockers.length)setNotice('AUTO WEEK nije pokrenut: '+blockers.join(', ')+'.')
      return
    }

    const { data, error } = await supabase.functions.invoke('content-engine', {
      body: { action: 'ensure_week', restaurantId: target.id },
    })
    if (error || data?.error) {
      sessionStorage.removeItem(attemptKey)
      return
    }
    sessionStorage.setItem(attemptKey, 'done')
    if (data?.created) {
      const generated=(data?.posts||[]) as Post[]
      let aiEnhanced=0
      try{
        const{data:aiStatus}=await supabase.functions.invoke('creative-advisor',{body:{action:'status',restaurantId:target.id}})
        if(aiStatus?.ai_text_ready&&generated.length){
          for(let index=0;index<generated.length;index+=1){
            const post=generated[index]
            setNotice(`AUTO WEEK · AI tekst ${index+1}/${generated.length} · ${post.title||'objava'}…`)
            const{data:aiData,error:aiError}=await supabase.functions.invoke('creative-advisor',{body:{action:'post_copy',restaurantId:target.id,postId:post.id}})
            if(!aiError&&!aiData?.error)aiEnhanced+=1
          }
        }
      }catch{
        // Deterministička AUTO WEEK nedelja ostaje validna ako AI provider trenutno nije dostupan.
      }
      await loadPosts(target.id)
      await loadAccountState()
      const weekLabel=data?.next_week?'sledeću nedelju':'ovu nedelju'
      setNotice(aiEnhanced
        ? `Autopilot je sam pripremio ${weekLabel} za ${target.name} · AI je doradio ${aiEnhanced}/${generated.length} tekstova.`
        : `Autopilot je sam pripremio ${weekLabel} za ${target.name}.`)
    }
  }

  async function loadMenu(restaurantId: string) {
    const { data, error } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false })
    if (error) setNotice(error.message); else setMenuItems((data || []) as MenuItem[])
  }
  async function loadUnreadNotifications() {
    await supabase.rpc('sync_account_notifications')
    const { count } = await supabase.from('notification_outbox').select('id',{count:'exact',head:true}).eq('visible_in_app',true).is('read_at',null)
    setUnreadNotifications(count || 0)
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
    if (tab === 'notifications') await loadUnreadNotifications()
    if (restaurant) {
      if (tab === 'launch' || tab === 'dashboard' || tab === 'creative' || tab === 'publish' || tab === 'studio' || tab === 'insights') await loadPosts(restaurant.id)
      if (tab === 'launch' || tab === 'creative' || tab === 'menu' || tab === 'promotions' || tab === 'studio' || tab === 'brand') await loadMenu(restaurant.id)
      if (tab === 'creative') await loadAccountState()
    }
    setActiveTab(tab)
  }

  async function polishBackgroundDrafts(target:Restaurant){
    const{data:pending}=await supabase.from('posts')
      .select('id,title,generation_meta')
      .eq('restaurant_id',target.id)
      .eq('status','draft')
      .order('created_at',{ascending:true})
      .limit(12)
    const needsPolish=(pending||[]).filter(post=>post.generation_meta?.needs_ai_polish===true)
    if(!needsPolish.length)return 0
    const{data:aiStatus}=await supabase.functions.invoke('creative-advisor',{body:{action:'status',restaurantId:target.id}})
    if(!aiStatus?.ai_text_ready)return 0
    let done=0
    for(let index=0;index<needsPolish.length;index+=1){
      const post=needsPolish[index]
      setNotice(`Background AUTO WEEK · AI polish ${index+1}/${needsPolish.length} · ${post.title||'objava'}…`)
      const{data,error}=await supabase.functions.invoke('creative-advisor',{body:{action:'post_copy',restaurantId:target.id,postId:post.id}})
      if(!error&&!data?.error)done+=1
    }
    if(done)await loadPosts(target.id)
    return done
  }

  async function installPwa(){
    if(pwaInstalled){setNotice('Restorapp je već instaliran na ovom uređaju.');return}
    if(installPrompt){
      await installPrompt.prompt()
      const choice=await installPrompt.userChoice
      if(choice.outcome==='accepted'){setPwaInstalled(true);setNotice('Restorapp je instaliran.')}
      else setNotice('Instalacija je otkazana — možeš je pokrenuti kasnije iz menija.')
      setInstallPrompt(null)
      return
    }
    if(isIosDevice()){setShowIosInstall(true);return}
    setNotice('U browser meniju izaberi „Install app“ / „Dodaj na početni ekran“. Ako opcija još nije dostupna, otvori aplikaciju preko HTTPS produkcionog domena.')
  }

  async function applyPwaUpdate(){
    if(!('serviceWorker' in navigator)){setPwaUpdateReady(false);return}
    const registration=await navigator.serviceWorker.getRegistration()
    if(registration?.waiting){registration.waiting.postMessage({type:'SKIP_WAITING'});return}
    await registration?.update()
    setNotice('Proveravam novu verziju aplikacije…')
  }

  async function accessChanged() { await loadAccountState(); await loadAppControls(); if (session) await loadRestaurants(session.user.id, restaurant?.id); setActiveTab('launch') }
  async function adminActivated() { window.history.replaceState({}, '', window.location.pathname); await loadAccountState(); await loadAppControls(); setActiveTab('admin') }
  async function signOut() { setMobileMenuOpen(false); await supabase.auth.signOut() }
  function mobileGo(tab:Tab){setMobileMenuOpen(false);void openTab(tab)}
  async function recoveryDone(){setRecoveryMode(false);await boot()}

  const canUseCampaigns = isSuperadmin || entitlement?.features?.campaigns === true
  const restaurantLimit = entitlement?.restaurants_limit ?? (isSuperadmin ? null : 1)
  const canAddRestaurant = isSuperadmin || (Boolean(entitlement?.active) && (restaurantLimit === null || restaurants.length < restaurantLimit))
  const remainingRestaurants = restaurantLimit === null ? null : Math.max(0, restaurantLimit - restaurants.length)
  const planName = isSuperadmin ? 'OWNER' : entitlement?.plan_name || 'Aktivan paket'
  const generationUsage = useMemo(() => entitlement?.generation_limit == null ? null : `${entitlement.generated_this_month || 0}/${entitlement.generation_limit}`, [entitlement])

  if (legalParam && ['terms','privacy','ai','refund'].includes(legalParam)) return <LegalScreen kind={legalParam} onBack={()=>{window.history.replaceState({},'',window.location.pathname);window.location.reload()}} />
  if (demo) return <Suspense fallback={<LazyScreenFallback label="Učitavam demo…" />}><DemoScreen onExit={() => { const next = new URL(window.location.href); next.searchParams.delete('demo'); window.history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`); setDemo(false) }} /></Suspense>
  if (loading || (session && !accountReady)) return <div className="screen-center"><div className="loader" />Učitavanje Restorappa…</div>
  if (recoveryMode && session) return <PasswordRecovery onDone={recoveryDone}/>
  if (!session) {
    if (showAuth || adminSetupRequested) return <AuthScreen onDemo={() => setDemo(true)} onBack={adminSetupRequested?undefined:()=>setShowAuth(false)} signupOpen={appControls.signup_open} />
    return <LandingScreen onAuth={()=>setShowAuth(true)} onDemo={()=>setDemo(true)}/>
  }
  if (adminSetupRequested && !isSuperadmin) return <AdminSetup email={session.user.email || ''} onActivated={adminActivated} onCancel={() => { window.history.replaceState({}, '', window.location.pathname); void loadAccountState() }} />
  if (!isSuperadmin && appControls.maintenance_mode) return <MaintenanceScreen message={appControls.maintenance_message} version={appControls.app_version} onSignOut={signOut}/>
  if (!isSuperadmin && !hasAccess) return <Suspense fallback={<LazyScreenFallback label="Učitavam paket i licencu…" />}><BillingPage email={session.user.email || ''} onAccessChanged={accessChanged} onSignOut={signOut} /></Suspense>

  if (addingRestaurant) return <Onboarding additional userId={session.user.id} onCancel={() => setAddingRestaurant(false)} onCreated={async () => { setAddingRestaurant(false); await loadAccountState(); await loadRestaurants(session.user.id); setActiveTab('launch') }} />

  if (!restaurant) {
    if (isSuperadmin && activeTab === 'admin') return <div className="standalone-admin"><Suspense fallback={<LazyScreenFallback label="Učitavam OWNER Control…" />}><OwnerControlPlus setNotice={setNotice} onCloseApp={async()=>{await loadAppControls();setActiveTab('dashboard')}} /></Suspense>{notice && <div className="notice floating-notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15}/></button></div>}</div>
    return <Onboarding userId={session.user.id} onCreated={async () => { await loadAccountState(); await loadRestaurants(session.user.id); setActiveTab('launch') }} />
  }

  return <div className="app-shell"><NetworkStatus/>
    {pwaUpdateReady&&<div className="pwa-update-banner"><div><RefreshCw size={16}/><span><strong>Nova verzija je spremna.</strong><small>Osveži aplikaciju bez gubitka podataka.</small></span></div><button onClick={()=>void applyPwaUpdate()}>Ažuriraj</button><button className="icon-button" onClick={()=>setPwaUpdateReady(false)}><X size={14}/></button></div>}
    <aside className="sidebar sidebar-pro"><div>
      <div className="brand-mark"><div className="brand-icon"><ChefHat size={21}/></div><span>Restaurant<br/><strong>Autopilot</strong></span></div>
      <div className="restaurant-chip restaurant-switcher">{restaurant.logo_url?<img className="sidebar-logo" src={restaurant.logo_url} alt=""/>:<div className="avatar" style={{background:restaurant.secondary_color||undefined}}>{restaurant.name.slice(0,1).toUpperCase()}</div>}<div className="restaurant-switch-copy"><strong>{restaurant.name}</strong><small>{restaurant.neighborhood||restaurant.city||restaurant.cuisine_type||'Restoran'}</small></div></div>
      {(restaurants.length > 1 || restaurantLimit === null || (restaurantLimit || 1) > 1) && <div className="location-control"><label><Building2 size={14}/><select value={restaurant.id} onChange={e=>void selectRestaurant(e.target.value)}>{restaurants.map(item=><option key={item.id} value={item.id}>{item.name}{item.city?` · ${item.city}`:''}</option>)}</select></label>{canAddRestaurant?<button onClick={()=>setAddingRestaurant(true)} title="Dodaj restoran"><Plus size={15}/><span>Dodaj lokaciju</span></button>:<small>Limit paketa: {restaurants.length}/{restaurantLimit}</small>}</div>}
      <div className={`autopilot-status ${isSuperadmin?'owner-status':''}`}><span className="live-dot"/> {isSuperadmin?'OWNER · SUPERADMIN':`${planName.toUpperCase()} · AKTIVAN`}</div>
      {!isSuperadmin && <div className="sidebar-plan-mini"><span>{restaurants.length}/{restaurantLimit || '∞'} lokacija</span>{generationUsage&&<span>{generationUsage} objava</span>}{remainingRestaurants===0&&restaurantLimit!==null?<small>Za više lokacija promeni paket.</small>:null}</div>}
      <nav>
        <button className={activeTab==='launch'?'nav-active launch-nav':''} onClick={()=>void openTab('launch')}><Rocket size={18}/> Start <span className="nav-beta">100%</span></button>
        <button className={activeTab==='dashboard'?'nav-active':''} onClick={()=>void openTab('dashboard')}><CalendarDays size={18}/> Sadržaj</button>
        <button className={activeTab==='creative'?'nav-active creative-nav':''} onClick={()=>void openTab('creative')}><Sparkles size={18}/> Creative AI <span className="nav-beta">NEW</span></button>
        <button className={activeTab==='studio'?'nav-active':''} onClick={()=>void openTab('studio')}><ImageIcon size={18}/> Visual Studio</button>
        <button className={(activeTab==='brand'?'nav-active brand-nav':'brand-nav')+' mobile-hide'} onClick={()=>void openTab('brand')}><Palette size={18}/> Brend <span className="nav-beta">LOGO</span></button>
        <button className={activeTab==='publish'?'nav-active':''} onClick={()=>void openTab('publish')}><Send size={18}/> Publish Center</button>
        <button className={(activeTab==='insights'?'nav-active insights-nav':'insights-nav')+' mobile-hide'} onClick={()=>void openTab('insights')}><BarChart3 size={18}/> Rezultati <span className="nav-beta">DATA</span></button>
        <button className={(activeTab==='menu'?'nav-active':'')+' mobile-hide'} onClick={()=>void openTab('menu')}><UtensilsCrossed size={18}/> Meni</button>
        <button className={`${activeTab==='promotions'?'nav-active ':''}${canUseCampaigns?'':'locked-nav'} mobile-hide`} onClick={()=>void openTab('promotions')}><Megaphone size={18}/> Akcije {!canUseCampaigns&&<span className="nav-beta"><LockKeyhole size={9}/> PRO</span>}</button>
        <button className={(activeTab==='billing'?'nav-active billing-nav':'billing-nav')+' mobile-hide'} onClick={()=>void openTab('billing')}><BadgeEuro size={18}/> Paket / licenca</button>
        <button className={(activeTab==='settings'?'nav-active':'')+' mobile-hide'} onClick={()=>void openTab('settings')}><Settings size={18}/> Podešavanja</button>
        <button className={(activeTab==='support'?'nav-active support-nav':'support-nav')+' mobile-hide'} onClick={()=>void openTab('support')}><LifeBuoy size={18}/> Podrška</button>
        <button className={(activeTab==='notifications'?'nav-active':'')+' mobile-hide'} onClick={()=>void openTab('notifications')}><Bell size={18}/> Obaveštenja {unreadNotifications>0&&<span className="nav-beta">{unreadNotifications>99?'99+':unreadNotifications}</span>}</button>
        {isSuperadmin&&<button className={(activeTab==='admin'?'nav-active admin-nav':'admin-nav')+' mobile-hide'} onClick={()=>void openTab('admin')}><ShieldCheck size={18}/> Superadmin <span className="nav-beta">OWNER</span></button>}
        <button className="mobile-nav-more" onClick={()=>setMobileMenuOpen(true)}><MenuIcon size={18}/> Više</button>
      </nav>
    </div><div className="sidebar-bottom-actions">{!pwaInstalled&&<button className="pwa-install-sidebar" onClick={()=>void installPwa()}><Download size={17}/><span><strong>Instaliraj aplikaciju</strong><small>telefon / desktop</small></span></button>}<button className="logout" onClick={signOut}><LogOut size={18}/> Odjavi se</button></div></aside>

    {mobileMenuOpen&&<div className="mobile-drawer-backdrop" onMouseDown={()=>setMobileMenuOpen(false)}><div className="mobile-drawer" onMouseDown={e=>e.stopPropagation()}><div className="mobile-drawer-head"><div><strong>{restaurant.name}</strong><small>Restorapp</small></div><button className="icon-button" onClick={()=>setMobileMenuOpen(false)}><X size={19}/></button></div><div className="mobile-drawer-grid">
      <button onClick={()=>mobileGo('brand')}><Palette size={19}/><span>Brend</span><small>logo i boje</small></button>
      <button onClick={()=>mobileGo('menu')}><UtensilsCrossed size={19}/><span>Meni</span><small>jela i slike</small></button>
      <button onClick={()=>mobileGo('insights')}><BarChart3 size={19}/><span>Rezultati</span><small>reach i konverzije</small></button>
      <button onClick={()=>mobileGo('promotions')} className={!canUseCampaigns?'locked':''}><Megaphone size={19}/><span>Akcije</span><small>{canUseCampaigns?'kampanje':'PRO / BUSINESS'}</small></button>
      <button onClick={()=>mobileGo('billing')}><BadgeEuro size={19}/><span>Paket</span><small>licenca i naplata</small></button>
      <button onClick={()=>mobileGo('settings')}><Settings size={19}/><span>Podešavanja</span><small>restoran i mreže</small></button>
      <button onClick={()=>mobileGo('support')}><LifeBuoy size={19}/><span>Podrška</span><small>pošalji zahtev</small></button>
      <button onClick={()=>mobileGo('notifications')}><Bell size={19}/><span>Obaveštenja</span><small>{unreadNotifications?unreadNotifications+' novo':'sve pročitano'}</small></button>
      {!pwaInstalled&&<button onClick={()=>{setMobileMenuOpen(false);void installPwa()}}><Smartphone size={19}/><span>Instaliraj app</span><small>na početni ekran</small></button>}
      {isSuperadmin&&<button onClick={()=>mobileGo('admin')} className="owner"><ShieldCheck size={19}/><span>Superadmin</span><small>OWNER Control</small></button>}
    </div><button className="mobile-drawer-logout" onClick={signOut}><LogOut size={17}/> Odjavi se</button></div></div>}

    {showIosInstall&&<div className="pwa-ios-backdrop" onMouseDown={()=>setShowIosInstall(false)}><div className="pwa-ios-card" onMouseDown={e=>e.stopPropagation()}><div className="pwa-ios-icon"><Smartphone size={26}/></div><button className="icon-button pwa-ios-close" onClick={()=>setShowIosInstall(false)}><X size={16}/></button><span>IPHONE / IPAD</span><h3>Dodaj Restorapp na početni ekran</h3><ol><li>U Safariju dodirni <b>Share</b> <Share2 size={14}/></li><li>Izaberi <b>Add to Home Screen</b></li><li>Potvrdi sa <b>Add</b></li></ol><p>Posle toga aplikacija se otvara preko svoje ikonice, bez browser trake.</p></div></div>}

    <main className={`main-area ${activeTab==='admin'?'admin-main-area':''}`}>
      {appControls.announcement_enabled&&appControls.announcement_text&&<div className={`global-announcement ${appControls.announcement_tone}`}><Megaphone size={15}/><span>{appControls.announcement_text}</span></div>}
      {notice&&<div className="notice"><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
      <Suspense fallback={<LazyScreenFallback label="Učitavam modul…" />}>
      {activeTab==='launch'&&<LaunchCenter restaurant={restaurant} menuItems={menuItems} posts={posts} pwaInstalled={pwaInstalled} onInstall={()=>void installPwa()} onNavigate={(tab)=>void openTab(tab as Tab)}/>} 
      {activeTab==='dashboard'&&<Dashboard restaurant={restaurant} menuItems={menuItems} posts={posts} entitlement={isSuperadmin?{active:true,is_superadmin:true,generation_limit:null,generated_this_month:0,features:{}}:entitlement} onChanged={refreshContent} setNotice={setNotice} onNavigate={(tab)=>void openTab(tab)}/>} 
      {activeTab==='creative'&&<CreativeHub restaurant={restaurant} menuItems={menuItems} entitlement={isSuperadmin?{active:true,is_superadmin:true,features:{campaign_pack:true}}:entitlement} onChanged={refreshContent} setNotice={setNotice}/>} 
      {activeTab==='studio'&&<VisualStudio restaurant={restaurant} menuItems={menuItems} posts={posts} setNotice={setNotice} onChanged={()=>loadPosts(restaurant.id)}/>} 
      {activeTab==='brand'&&<BrandKit restaurant={restaurant} menuItems={menuItems} onSaved={refreshRestaurant} setNotice={setNotice}/>} 
      {activeTab==='publish'&&<PublishCenter restaurant={restaurant} posts={posts} onChanged={()=>loadPosts(restaurant.id)} setNotice={setNotice}/>} 
      {activeTab==='insights'&&<InsightsCenter restaurant={restaurant} posts={posts} menuItems={menuItems} setNotice={setNotice} onChanged={refreshContent} onNavigate={(tab)=>void openTab(tab)}/>} 
      {activeTab==='menu'&&<MenuManager restaurant={restaurant} userId={session.user.id} items={menuItems} onChanged={()=>loadMenu(restaurant.id)} setNotice={setNotice}/>} 
      {activeTab==='promotions'&&canUseCampaigns&&<Promotions restaurant={restaurant} menuItems={menuItems} onChanged={refreshContent} setNotice={setNotice}/>} 
      {activeTab==='billing'&&<BillingPage email={session.user.email||''} onAccessChanged={accessChanged} onSignOut={signOut}/>} 
      {activeTab==='settings'&&<SettingsPanel restaurant={restaurant} onSaved={refreshRestaurant} setNotice={setNotice}/>} 
      {activeTab==='support'&&<SupportCenter restaurant={restaurant} setNotice={setNotice}/>} 
      {activeTab==='notifications'&&<NotificationsCenter setNotice={setNotice} onUnreadChanged={setUnreadNotifications} onNavigate={(target)=>void openTab(target)}/>} 
      {activeTab==='admin'&&isSuperadmin&&<OwnerControlPlus setNotice={setNotice} onCloseApp={async()=>{await loadAppControls();setActiveTab('dashboard')}}/>} 
      </Suspense>
    </main>
  </div>
}

function LazyScreenFallback({label}:{label:string}){return <div className="screen-center lazy-screen-fallback"><div className="loader"/>{label}</div>}

function MaintenanceScreen({message,version,onSignOut}:{message:string|null;version:string;onSignOut:()=>Promise<void>}){
  return <div className="maintenance-screen"><div className="maintenance-card"><div className="maintenance-logo"><ChefHat size={30}/></div><span>RESTORAPP · v{version}</span><h1>Kratko održavanje.</h1><p>{message||'OWNER trenutno radi na sistemu. Tvoji podaci ostaju sačuvani i pristup će se vratiti čim održavanje bude završeno.'}</p><button className="secondary" onClick={onSignOut}><LogOut size={15}/> Odjavi se</button></div></div>
}

export default App

function localDateKey(timeZone:string){
  try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
    const get=(type:string)=>parts.find(part=>part.type===type)?.value||''
    return `${get('year')}-${get('month')}-${get('day')}`
  }catch{return new Date().toISOString().slice(0,10)}
}

function isStandaloneApp(){
  const iosStandalone=Boolean((navigator as Navigator & {standalone?:boolean}).standalone)
  return window.matchMedia('(display-mode: standalone)').matches||iosStandalone
}
function isIosDevice(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
