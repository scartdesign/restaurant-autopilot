import { FormEvent, useState } from 'react'
import { ChefHat, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function AuthScreen({ onDemo }: { onDemo: () => void }) {
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
    else if (mode === 'signup' && !result.data.session) setMessage('Proveri email i potvrdi registraciju, pa se prijavi.')
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
        <div className="auth-divider"><span>ili</span></div>
        <button className="secondary full" type="button" onClick={onDemo}><Eye size={17} /> Pogledaj demo bez registracije</button>
      </div>
    </div>
  )
}
