import { KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabase'

export function AccountSecurity({setNotice}:{setNotice:(v:string)=>void}){
  const[current,setCurrent]=useState('')
  const[next,setNext]=useState('')
  const[confirm,setConfirm]=useState('')
  const[working,setWorking]=useState(false)
  const[signingOut,setSigningOut]=useState(false)

  async function changePassword(e:FormEvent){
    e.preventDefault()
    if(!strong(next)){setNotice('Nova lozinka treba da ima 10+ karaktera, veliko i malo slovo i broj.');return}
    if(next!==confirm){setNotice('Nova lozinka i potvrda se ne poklapaju.');return}
    setWorking(true)
    const{data:userData}=await supabase.auth.getUser()
    const email=userData.user?.email
    if(!email){setNotice('Sesija je istekla.');setWorking(false);return}
    const reauth=await supabase.auth.signInWithPassword({email,password:current})
    if(reauth.error){setNotice('Trenutna lozinka nije ispravna.');setWorking(false);return}
    const{error}=await supabase.auth.updateUser({password:next})
    if(error)setNotice(error.message)
    else{setCurrent('');setNext('');setConfirm('');setNotice('Lozinka je promenjena.')}
    setWorking(false)
  }

  async function signOutOthers(){
    if(!confirmWindow())return
    setSigningOut(true)
    const{error}=await supabase.auth.signOut({scope:'others'})
    if(error)setNotice(error.message);else setNotice('Ostale aktivne sesije su odjavljene.')
    setSigningOut(false)
  }

  return <section className="settings-section panel account-security">
    <div className="settings-section-head"><div className="settings-icon"><ShieldCheck size={19}/></div><div><h2>Bezbednost naloga</h2><p>Promeni lozinku i prekini pristup na drugim uređajima.</p></div></div>
    <div className="account-security-grid">
      <form onSubmit={changePassword}><div className="security-card-head"><LockKeyhole size={20}/><div><strong>Promena lozinke</strong><span>Potvrdi trenutnu pa postavi novu lozinku.</span></div></div><label>Trenutna lozinka<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required/></label><label>Nova lozinka<input type="password" autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)} minLength={10} required/></label><label>Ponovi novu lozinku<input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={10} required/></label><button className="primary" disabled={working}><KeyRound size={15}/>{working?'Menjam…':'Promeni lozinku'}</button></form>
      <article className="security-session-card"><div className="security-card-head"><LogOut size={20}/><div><strong>Aktivne sesije</strong><span>Ako si se prijavio na tuđem računaru, odjavi ostale uređaje.</span></div></div><p>Ova akcija zadržava trenutnu sesiju, a ostale aktivne prijave više neće imati važeći refresh token.</p><button className="secondary" onClick={()=>void signOutOthers()} disabled={signingOut}><LogOut size={15}/>{signingOut?'Odjavljujem…':'Odjavi ostale uređaje'}</button></article>
    </div>
  </section>
}
function confirmWindow(){return window.confirm('Odjavi sve ostale uređaje sa ovog naloga?')}

function strong(v:string){return v.length>=10&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/\d/.test(v)}
