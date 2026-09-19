import { FormEvent, useState } from 'react'
import { ArrowRight, CalendarDays, Camera, ChefHat, CheckCircle2, Eye, Hash, KeyRound, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

const LOGIN_FOOD = 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1800&q=88'

export function AuthScreen({ onDemo, onBack, signupOpen=true }: { onDemo: () => void; onBack?:()=>void; signupOpen?:boolean }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [recoveryWorking,setRecoveryWorking]=useState(false)

  const strength=passwordStrength(password)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if(mode==='signup'&&!signupOpen){setMessage('Nove registracije su trenutno zatvorene. Kontaktiraj Restorapp prodaju za aktivaciju.');return}
    if(mode==='signup'&&strength<4){setMessage('Lozinka treba da ima najmanje 10 karaktera, veliko i malo slovo i broj.');return}
    setWorking(true)
    setMessage('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup' && !result.data.session) setMessage('Proveri email i potvrdi registraciju, pa se prijavi.')
    setWorking(false)
  }

  async function sendRecovery(){
    if(!email.trim()){setMessage('Prvo upiši email naloga.');return}
    setRecoveryWorking(true);setMessage('')
    const redirectTo=`${window.location.origin}${window.location.pathname}`
    const{error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo})
    if(error)setMessage(error.message);else setMessage('Poslali smo link za novu lozinku na tvoj email.')
    setRecoveryWorking(false)
  }

  return (
    <div className="auth-page auth-page-wow">
      <section className="auth-showcase" style={{ backgroundImage: `linear-gradient(180deg, rgba(8,13,10,.08), rgba(8,13,10,.88)), url(${LOGIN_FOOD})` }}>
        <div className="auth-showcase-top"><div className="auth-showcase-brand"><span><ChefHat size={22} /></span><strong>Restorapp</strong></div><span className="auth-live"><i /> AI MARKETING SYSTEM</span></div>
        <div className="auth-showcase-copy"><span className="auth-overline">OD MENIJA DO OBJAVE</span><h2>Tvoj restoran izgleda dobro.<br /><em>Sada neka tako izgleda i online.</em></h2><p>Fotografije, tekstovi, lokalni discovery, kampanje i gotovi vizuali — u jednom toku.</p><div className="auth-showcase-pills"><span><Camera size={15} /> Realne fotografije</span><span><CalendarDays size={15} /> Nedeljni plan</span><span><Hash size={15} /> Smart discovery</span></div></div>
        <div className="auth-floating-card"><div className="auth-floating-head"><div><span>Sledeća objava</span><strong>Pizza Capricciosa</strong></div><span className="auth-score">94/100</span></div><div className="auth-floating-meta"><span><CheckCircle2 size={14} /> spremno</span><span>Feed 4:5</span><span>18:30</span></div></div>
      </section>

      <section className="auth-form-zone">
        <div className="auth-card auth-card-pro auth-card-wow">{onBack&&<button type="button" className="auth-back-home" onClick={onBack}>← Nazad na početnu</button>}
          <div className="auth-logo"><ChefHat size={28} /></div><p className="eyebrow">MARKETING BEZ CIMANJA</p><h1>{mode === 'login' ? <>Dobrodošao<br />nazad.</> : <>Pokreni svoj<br />Autopilot.</>}</h1><p className="muted">{mode === 'login' ? 'Uđi u komandni centar svog restorana.' : signupOpen?'Napravi nalog i pripremi prvi sadržaj za nekoliko minuta.':'Registracije su trenutno zatvorene od strane OWNER-a.'}</p>
          <div className="auth-benefits"><span><Sparkles size={13} /> sadržaj</span><span><MapPin size={13} /> local reach</span><span><Hash size={13} /> discovery</span></div>
          <form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="restoran@email.com" autoComplete="email" /></label><label>Lozinka<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode==='signup'?10:6} placeholder={mode==='signup'?'10+ karaktera, slova i broj':'Tvoja lozinka'} autoComplete={mode==='login'?'current-password':'new-password'} /></label>{mode==='signup'&&<div className="password-strength"><div><i className={strength>=1?'on':''}/><i className={strength>=2?'on':''}/><i className={strength>=3?'on':''}/><i className={strength>=4?'on':''}/></div><span><ShieldCheck size={12}/> {strength<2?'Slaba':strength<4?'Dobra':'Jaka'} lozinka</span></div>}<button className="primary full auth-submit" disabled={working||(mode==='signup'&&(!signupOpen||strength<4))}>{working ? 'Sačekaj…' : mode === 'login' ? 'Prijavi se' : signupOpen?'Napravi nalog':'Registracije zatvorene'} <ArrowRight size={17} /></button></form>
          {mode==='login'&&<button className="auth-recovery-link" type="button" onClick={sendRecovery} disabled={recoveryWorking}><KeyRound size={14}/>{recoveryWorking?'Šaljem link…':'Zaboravljena lozinka?'}</button>}
          {message && <p className="form-message">{message}</p>}
          {signupOpen?<button className="text-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Nemaš nalog? Registruj restoran' : 'Već imaš nalog? Prijavi se'}</button>:mode==='signup'?<button className="text-button" onClick={()=>setMode('login')}>Vrati se na prijavu</button>:<div className="signup-closed-note">Novi nalozi se trenutno aktiviraju direktno preko prodaje.</div>}
          {mode==='signup'&&<p className="auth-legal-consent">Registracijom prihvataš <a href="?legal=terms">Uslove korišćenja</a> i <a href="?legal=privacy">Politiku privatnosti</a>. AI funkcije su opisane u <a href="?legal=ai">AI transparentnosti</a>.</p>}<div className="auth-divider"><span>ili</span></div><button className="secondary full demo-login" type="button" onClick={onDemo}><Eye size={17} /> Pogledaj interaktivni demo</button>
        </div>
      </section>
    </div>
  )
}

function passwordStrength(value:string){let score=0;if(value.length>=10)score++;if(/[a-z]/.test(value)&&/[A-Z]/.test(value))score++;if(/\d/.test(value))score++;if(/[^A-Za-z0-9]/.test(value)||value.length>=14)score++;return score}
