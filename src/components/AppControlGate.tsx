import { type ReactNode, useEffect, useState } from 'react'
import { AlertTriangle, ChefHat, Info, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Controls = {
  app_name: string
  app_version: string
  maintenance_mode: boolean
  maintenance_message: string | null
  announcement_enabled: boolean
  announcement_text: string | null
  announcement_tone: 'info' | 'success' | 'warning'
}

const fallback: Controls = {
  app_name: 'Restaurant Autopilot',
  app_version: '1.0',
  maintenance_mode: false,
  maintenance_message: null,
  announcement_enabled: false,
  announcement_text: null,
  announcement_tone: 'info',
}

export function AppControlGate({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<Controls>(fallback)
  const [admin, setAdmin] = useState(false)
  const [ready, setReady] = useState(false)

  async function load() {
    const [{ data }, { data: sessionData }] = await Promise.all([
      supabase.from('app_controls').select('app_name,app_version,maintenance_mode,maintenance_message,announcement_enabled,announcement_text,announcement_tone').eq('id', 1).maybeSingle(),
      supabase.auth.getSession(),
    ])
    if (data) setControls(data as Controls)
    if (sessionData.session) {
      const { data: isAdmin } = await supabase.rpc('is_superadmin')
      setAdmin(Boolean(isAdmin))
    } else setAdmin(false)
    setReady(true)
  }

  useEffect(() => {
    void load()
    const { data } = supabase.auth.onAuthStateChange(() => { void load() })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="screen-center"><div className="loader" />Učitavanje sistema…</div>

  if (controls.maintenance_mode && !admin) {
    return <div className="maintenance-screen">
      <div className="maintenance-card">
        <div className="maintenance-logo"><ChefHat size={30}/></div>
        <span className="maintenance-kicker"><ShieldCheck size={14}/> PRIVREMENO ODRŽAVANJE</span>
        <h1>{controls.app_name}</h1>
        <p>{controls.maintenance_message || 'Radimo kratko održavanje kako bi Autopilot radio stabilno. Pokušaj ponovo za nekoliko minuta.'}</p>
        <button className="primary" onClick={() => void load()}><RefreshCw size={16}/> Pokušaj ponovo</button>
        <small>Verzija {controls.app_version}</small>
      </div>
    </div>
  }

  const showAnnouncement = controls.announcement_enabled && Boolean(controls.announcement_text?.trim())
  return <div className={showAnnouncement ? 'app-with-announcement' : undefined}>
    {showAnnouncement && <div className={`global-announcement ${controls.announcement_tone}`}>
      <span>{controls.announcement_tone === 'warning' ? <AlertTriangle size={16}/> : controls.announcement_tone === 'success' ? <Sparkles size={16}/> : <Info size={16}/>}</span>
      <strong>{controls.announcement_text}</strong>
      {admin && <small>OWNER poruka</small>}
    </div>}
    {children}
  </div>
}
