import { FormEvent, useState } from 'react'
import { CheckCircle2, KeyRound, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function PasswordRecovery({ onDone }: { onDone: () => Promise<void> | void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) { setMessage('Nova lozinka mora imati najmanje 8 karaktera.'); return }
    if (password !== confirm) { setMessage('Lozinke se ne poklapaju.'); return }
    setWorking(true); setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else {
      setMessage('Lozinka je promenjena. Ulaziš u Autopilot…')
      window.setTimeout(() => { void onDone() }, 700)
    }
    setWorking(false)
  }

  return <div className="auth-page password-recovery-page">
    <div className="auth-card recovery-card">
      <div className="auth-logo"><KeyRound size={28}/></div>
      <p className="eyebrow">SIGURAN PRISTUP</p>
      <h1>Postavi novu lozinku.</h1>
      <p className="muted">Izaberi novu lozinku za Restaurant Autopilot nalog.</p>
      <form onSubmit={submit}>
        <label>Nova lozinka<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="Najmanje 8 karaktera" required/></label>
        <label>Ponovi lozinku<input type="password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="Ponovi novu lozinku" required/></label>
        <button className="primary full" disabled={working}><LockKeyhole size={16}/>{working?'Čuvam…':'Sačuvaj novu lozinku'}</button>
      </form>
      {message&&<div className="form-message recovery-message"><CheckCircle2 size={15}/>{message}</div>}
    </div>
  </div>
}
