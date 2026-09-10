import { FormEvent, useState } from 'react'
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function AdminSetup({ email, onActivated, onCancel }: { email: string; onActivated: () => Promise<void>; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    setWorking(true); setMessage('')
    const { error } = await supabase.rpc('claim_superadmin', { p_code: code.trim() })
    if (error) setMessage(error.message)
    else await onActivated()
    setWorking(false)
  }

  return <div className="admin-setup-page"><form className="admin-setup-card" onSubmit={submit}><div className="admin-setup-icon"><LockKeyhole size={30}/></div><p className="eyebrow">OWNER SETUP</p><h1>Aktiviraj Superadmin</h1><p>Ovo se radi samo jednom za vlasnički nalog. Posle aktivacije dobijaš kupce, prodaju, pakete, licence i kontrolu pristupa.</p><div className="admin-email"><ShieldCheck size={15}/><span>{email}</span></div><label>Jednokratni setup kod<div className="admin-code-field"><KeyRound size={17}/><input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="RA-..."/></div></label>{message && <div className="form-message">{message}</div>}<button className="primary full" disabled={working}>{working ? 'Aktiviram…' : 'Aktiviraj Superadmin'}</button><button type="button" className="secondary full" onClick={onCancel}>Nazad</button></form></div>
}
