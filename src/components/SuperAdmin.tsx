import { useEffect, useMemo, useState } from 'react'
import { BadgeEuro, Ban, Banknote, CheckCircle2, Copy, CreditCard, KeyRound, RefreshCw, Save, Search, Settings2, ShieldCheck, Store, TicketCheck, UserRoundCheck, UsersRound, WalletCards, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CustomerProfile, CustomerSubscription, LicenseCodeRow, SalesOrder, SalesPlan, SalesSettings } from '../types'

type AdminView = 'overview' | 'customers' | 'orders' | 'licenses' | 'plans' | 'settings'
type RestaurantLite = { id: string; owner_id: string; name: string; city: string | null; created_at: string }
type GeneratedLicense = { id: string; code: string; plan: string; assigned_email: string | null }

export function SuperAdmin({ onCloseApp, setNotice }: { onCloseApp?: () => void; setNotice: (value: string) => void }) {
  const [view, setView] = useState<AdminView>('overview')
  const [profiles, setProfiles] = useState<CustomerProfile[]>([])
  const [restaurants, setRestaurants] = useState<RestaurantLite[]>([])
  const [plans, setPlans] = useState<SalesPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [licenses, setLicenses] = useState<LicenseCodeRow[]>([])
  const [settings, setSettings] = useState<SalesSettings | null>(null)
  const [working, setWorking] = useState(false)
  const [search, setSearch] = useState('')
  const [generatedLicense, setGeneratedLicense] = useState<GeneratedLicense | null>(null)
  const [licenseForm, setLicenseForm] = useState({ planId: '', email: '', days: '', amount: '', paymentMethod: 'manual', note: '' })
  const [grantForm, setGrantForm] = useState({ userId: '', planId: '', days: '', amount: '', paymentMethod: 'manual', note: '' })

  useEffect(() => { void loadAll() }, [])

  async function loadAll() {
    setWorking(true)
    const [p, r, pl, s, o, l, cfg] = await Promise.all([
      supabase.from('customer_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('restaurants').select('id,owner_id,name,city,created_at').order('created_at', { ascending: false }),
      supabase.from('sales_plans').select('*').order('sort_order'),
      supabase.from('customer_subscriptions').select('*, sales_plans(*)').order('created_at', { ascending: false }),
      supabase.from('sales_orders').select('*, sales_plans(*)').order('created_at', { ascending: false }),
      supabase.from('license_codes').select('*, sales_plans(*)').order('created_at', { ascending: false }).limit(100),
      supabase.from('sales_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    const error = p.error || r.error || pl.error || s.error || o.error || l.error || cfg.error
    if (error) setNotice(error.message)
    setProfiles((p.data || []) as CustomerProfile[])
    setRestaurants((r.data || []) as RestaurantLite[])
    setPlans((pl.data || []) as SalesPlan[])
    setSubscriptions((s.data || []) as CustomerSubscription[])
    setOrders((o.data || []) as SalesOrder[])
    setLicenses((l.data || []) as LicenseCodeRow[])
    setSettings((cfg.data || null) as SalesSettings | null)
    setWorking(false)
  }

  const activeSubs = useMemo(() => subscriptions.filter((sub) => ['active','trialing'].includes(sub.status) && (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now())), [subscriptions])
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === 'pending'), [orders])
  const paidRevenue = useMemo(() => orders.filter((order) => order.status === 'paid').reduce((sum, order) => sum + Number(order.amount || 0), 0), [orders])
  const currentByUser = useMemo(() => { const map = new Map<string, CustomerSubscription>(); for (const sub of subscriptions) if (!map.has(sub.user_id)) map.set(sub.user_id, sub); return map }, [subscriptions])
  const restaurantByUser = useMemo(() => { const map = new Map<string, RestaurantLite>(); for (const item of restaurants) if (!map.has(item.owner_id)) map.set(item.owner_id, item); return map }, [restaurants])
  const filteredProfiles = useMemo(() => { const q = search.toLowerCase().trim(); return q ? profiles.filter((profile) => `${profile.email} ${profile.full_name || ''} ${profile.company || ''} ${restaurantByUser.get(profile.user_id)?.name || ''}`.toLowerCase().includes(q)) : profiles }, [profiles, search, restaurantByUser])

  async function markPaid(order: SalesOrder) {
    setWorking(true)
    const { error } = await supabase.rpc('admin_mark_order_paid', { p_order_id: order.id, p_admin_note: 'Potvrđeno iz Superadmin panela' })
    if (error) setNotice(error.message)
    else { setNotice(`${order.order_number} je plaćen i paket je aktiviran.`); await loadAll() }
    setWorking(false)
  }

  async function cancelOrder(order: SalesOrder) {
    if (!confirm(`Otkaži ${order.order_number}?`)) return
    setWorking(true)
    const { error } = await supabase.from('sales_orders').update({ status: 'cancelled', admin_note: 'Otkazano iz Superadmin panela' }).eq('id', order.id)
    if (error) setNotice(error.message); else { setNotice('Narudžbina je otkazana.'); await loadAll() }
    setWorking(false)
  }

  async function createLicense() {
    if (!licenseForm.planId) { setNotice('Izaberi paket.'); return }
    setWorking(true)
    const { data, error } = await supabase.rpc('admin_create_license_code', {
      p_plan_id: licenseForm.planId,
      p_duration_days: licenseForm.days ? Number(licenseForm.days) : null,
      p_assigned_email: licenseForm.email || null,
      p_sale_amount: licenseForm.amount ? Number(licenseForm.amount) : null,
      p_payment_method: licenseForm.paymentMethod,
      p_note: licenseForm.note || null,
    })
    if (error) setNotice(error.message)
    else {
      setGeneratedLicense(data as GeneratedLicense)
      setNotice('Licenca je napravljena. Kod se prikazuje samo sada — kopiraj ga kupcu.')
      setLicenseForm((current) => ({ ...current, email: '', days: '', amount: '', note: '' }))
      await loadAll()
    }
    setWorking(false)
  }

  async function grantAccess() {
    if (!grantForm.userId || !grantForm.planId) { setNotice('Izaberi kupca i paket.'); return }
    setWorking(true)
    const { error } = await supabase.rpc('admin_grant_access', {
      p_user_id: grantForm.userId,
      p_plan_id: grantForm.planId,
      p_days: grantForm.days ? Number(grantForm.days) : null,
      p_payment_method: grantForm.paymentMethod,
      p_amount: grantForm.amount ? Number(grantForm.amount) : null,
      p_note: grantForm.note || null,
    })
    if (error) setNotice(error.message)
    else { setNotice('Kupcu je odmah aktiviran paket i prodaja je evidentirana.'); setGrantForm({ userId: '', planId: '', days: '', amount: '', paymentMethod: 'manual', note: '' }); await loadAll() }
    setWorking(false)
  }

  async function setSubscriptionStatus(sub: CustomerSubscription, status: CustomerSubscription['status']) {
    setWorking(true)
    const { error } = await supabase.from('customer_subscriptions').update({ status }).eq('id', sub.id)
    if (error) setNotice(error.message); else { setNotice(`Pristup je ${status === 'suspended' ? 'suspendovan' : 'ponovo aktiviran'}.`); await loadAll() }
    setWorking(false)
  }

  async function extendSubscription(sub: CustomerSubscription, days = 30) {
    const base = sub.expires_at && new Date(sub.expires_at).getTime() > Date.now() ? new Date(sub.expires_at) : new Date()
    base.setDate(base.getDate() + days)
    setWorking(true)
    const { error } = await supabase.from('customer_subscriptions').update({ expires_at: base.toISOString(), status: 'active' }).eq('id', sub.id)
    if (error) setNotice(error.message); else { setNotice(`Pristup je produžen za ${days} dana.`); await loadAll() }
    setWorking(false)
  }

  async function updatePlan(plan: SalesPlan, patch: Partial<SalesPlan>) {
    const { error } = await supabase.from('sales_plans').update(patch).eq('id', plan.id)
    if (error) setNotice(error.message); else { setNotice(`${plan.name} je ažuriran.`); await loadAll() }
  }

  async function saveSettings() {
    if (!settings) return
    setWorking(true)
    const { error } = await supabase.from('sales_settings').update({
      company_name: settings.company_name, sales_email: settings.sales_email || null, support_email: settings.support_email || null,
      bank_instructions: settings.bank_instructions || null, paypal_url: settings.paypal_url || null, terms_url: settings.terms_url || null,
      allow_bank_transfer: settings.allow_bank_transfer, allow_paypal: settings.allow_paypal, allow_card: settings.allow_card, allow_invoice: settings.allow_invoice, trial_enabled: settings.trial_enabled,
    }).eq('id', 1)
    if (error) setNotice(error.message); else setNotice('Prodajna podešavanja su sačuvana.')
    setWorking(false)
  }

  async function revokeLicense(row: LicenseCodeRow) {
    setWorking(true)
    const { error } = await supabase.from('license_codes').update({ status: 'revoked' }).eq('id', row.id)
    if (error) setNotice(error.message); else { setNotice(`Licenca ••••${row.code_last4} je opozvana.`); await loadAll() }
    setWorking(false)
  }

  function copy(text: string) { navigator.clipboard.writeText(text).then(() => setNotice('Kopirano.')).catch(() => setNotice('Browser nije dozvolio kopiranje.')) }

  return <div className="superadmin-page">
    <header className="admin-topbar"><div><span className="admin-shield"><ShieldCheck size={21}/></span><div><p>RESTAURANT AUTOPILOT</p><h1>Superadmin</h1></div></div><div className="admin-top-actions"><span className="admin-live"><i/> SYSTEM LIVE</span><button className="secondary" onClick={() => void loadAll()} disabled={working}><RefreshCw size={15}/> Osveži</button>{onCloseApp && <button className="secondary" onClick={onCloseApp}>Nazad u app</button>}</div></header>

    <nav className="admin-tabs">{([
      ['overview','Pregled',Zap],['customers','Kupci',UsersRound],['orders','Prodaja',WalletCards],['licenses','Licence',KeyRound],['plans','Paketi',BadgeEuro],['settings','Podešavanja',Settings2],
    ] as [AdminView,string,typeof Zap][]).map(([key,label,Icon]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><Icon size={16}/>{label}{key === 'orders' && pendingOrders.length > 0 ? <b>{pendingOrders.length}</b> : null}</button>)}</nav>

    {view === 'overview' && <>
      <section className="admin-metrics"><Metric icon={UsersRound} label="Registrovani" value={profiles.length}/><Metric icon={Store} label="Restorani" value={restaurants.length}/><Metric icon={UserRoundCheck} label="Aktivni paketi" value={activeSubs.length}/><Metric icon={WalletCards} label="Čeka uplatu" value={pendingOrders.length}/><Metric icon={BadgeEuro} label="Evidentirano" value={`${paidRevenue.toFixed(0)} €`}/></section>
      <div className="admin-overview-grid"><section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">BRZA PRODAJA</p><h2>Aktiviraj kupca odmah</h2></div><TicketCheck size={22}/></div><p className="muted">Za uplatu na račun, keš, PayPal ili fakturu. Kupac mora prvo da napravi nalog.</p><div className="admin-form-grid"><label>Kupac<select value={grantForm.userId} onChange={(e) => setGrantForm({ ...grantForm, userId: e.target.value })}><option value="">Izaberi kupca</option>{profiles.map((profile) => <option value={profile.user_id} key={profile.user_id}>{profile.email}</option>)}</select></label><label>Paket<select value={grantForm.planId} onChange={(e) => setGrantForm({ ...grantForm, planId: e.target.value })}><option value="">Izaberi paket</option>{plans.filter((plan) => plan.active).map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · {plan.price} {plan.currency}</option>)}</select></label><label>Trajanje dana<input type="number" min="1" value={grantForm.days} onChange={(e) => setGrantForm({ ...grantForm, days: e.target.value })} placeholder="prazno = paket"/></label><label>Naplaćeno<input type="number" min="0" step="0.01" value={grantForm.amount} onChange={(e) => setGrantForm({ ...grantForm, amount: e.target.value })} placeholder="prazno = puna cena"/></label><label>Način<select value={grantForm.paymentMethod} onChange={(e) => setGrantForm({ ...grantForm, paymentMethod: e.target.value })}>{adminMethods.map((method) => <option value={method.key} key={method.key}>{method.label}</option>)}</select></label><label>Napomena<input value={grantForm.note} onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })} placeholder="npr. predračun 12/2026"/></label></div><button className="primary full" onClick={grantAccess} disabled={working}><CheckCircle2 size={16}/> Aktiviraj i evidentiraj prodaju</button></section>
      <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">AKTIVACIONI KOD</p><h2>Prodaj licencu</h2></div><KeyRound size={22}/></div><p className="muted">Napravi jednokratni kod i pošalji ga kupcu. Možeš ga vezati za tačan email.</p><LicenseForm form={licenseForm} setForm={setLicenseForm} plans={plans}/><button className="primary full" onClick={createLicense} disabled={working}><KeyRound size={16}/> Generiši licencu</button>{generatedLicense && <div className="generated-license"><span>NOVI KOD · KOPIRAJ SADA</span><strong>{generatedLicense.code}</strong><small>{generatedLicense.plan}{generatedLicense.assigned_email ? ` · ${generatedLicense.assigned_email}` : ''}</small><button onClick={() => copy(generatedLicense.code)}><Copy size={15}/> Kopiraj kod</button></div>}</section></div>
      <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">POSLEDNJE NARUDŽBINE</p><h2>Prodajni tok</h2></div><WalletCards size={22}/></div><OrdersTable orders={orders.slice(0,8)} profiles={profiles} onPaid={markPaid} onCancel={cancelOrder} working={working}/></section>
    </>}

    {view === 'customers' && <section className="admin-panel"><div className="admin-panel-head admin-customers-head"><div><p className="eyebrow">KUPCI</p><h2>Nalozi i pristup</h2></div><div className="admin-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Email, restoran, firma..."/></div></div><div className="admin-table customer-table"><div className="admin-table-head"><span>Kupac</span><span>Restoran</span><span>Paket</span><span>Važi do</span><span>Kontrola</span></div>{filteredProfiles.map((profile) => { const sub = currentByUser.get(profile.user_id); const restaurant = restaurantByUser.get(profile.user_id); return <div className="admin-table-row" key={profile.user_id}><div><strong>{profile.full_name || profile.email}</strong><small>{profile.email}</small></div><div><strong>{restaurant?.name || '—'}</strong><small>{restaurant?.city || 'nije dodat'}</small></div><div>{sub ? <><span className={`status ${sub.status}`}>{sub.status}</span><small>{sub.sales_plans?.name || 'custom'}</small></> : <span className="status pending">bez paketa</span>}</div><div><strong>{sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString('sr-RS') : sub ? 'bez isteka' : '—'}</strong></div><div className="admin-row-actions">{sub && <><button title="+30 dana" onClick={() => extendSubscription(sub,30)}>+30d</button>{sub.status === 'suspended' ? <button onClick={() => setSubscriptionStatus(sub,'active')}><CheckCircle2 size={13}/> Aktiviraj</button> : <button className="danger-soft" onClick={() => setSubscriptionStatus(sub,'suspended')}><Ban size={13}/> Pauza</button>}</>}</div></div>})}</div></section>}

    {view === 'orders' && <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">PRODAJA</p><h2>Narudžbine i uplate</h2></div><span className="admin-counter">{pendingOrders.length} čeka potvrdu</span></div><OrdersTable orders={orders} profiles={profiles} onPaid={markPaid} onCancel={cancelOrder} working={working}/></section>}

    {view === 'licenses' && <div className="admin-two-column"><section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">NOVA LICENCA</p><h2>Generiši aktivacioni kod</h2></div><KeyRound size={22}/></div><LicenseForm form={licenseForm} setForm={setLicenseForm} plans={plans}/><button className="primary full" onClick={createLicense} disabled={working}>Generiši kod</button>{generatedLicense && <div className="generated-license"><span>KOD SE PRIKAZUJE SAMO SADA</span><strong>{generatedLicense.code}</strong><button onClick={() => copy(generatedLicense.code)}><Copy size={15}/> Kopiraj</button></div>}</section><section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">IZDATE LICENCE</p><h2>Kontrola kodova</h2></div></div><div className="license-list">{licenses.map((row) => <div className="license-row-admin" key={row.id}><div><strong>•••• {row.code_last4}</strong><span>{row.sales_plans?.name || 'Paket'} · {row.assigned_email || 'bez email ograničenja'}</span></div><div><span className={`status ${row.status}`}>{row.status}</span><small>{row.use_count}/{row.max_uses} korišćenja</small></div>{row.status === 'active' && <button className="danger-soft" onClick={() => revokeLicense(row)}>Opozovi</button>}</div>)}</div></section></div>}

    {view === 'plans' && <section className="admin-panel"><div className="admin-panel-head"><div><p className="eyebrow">PAKETI I CENE</p><h2>Menjaš cenu bez izmene koda</h2></div><BadgeEuro size={22}/></div><div className="plan-admin-grid">{plans.map((plan) => <AdminPlan key={plan.id} plan={plan} onUpdate={updatePlan}/>)}</div><div className="admin-tip"><Zap size={16}/><span>Lifetime model je podržan u bazi, ali ga nisam uključio javno jer AI/SaaS ima stalne troškove. Ako ga želiš, napravićemo ograničen Founders paket.</span></div></section>}

    {view === 'settings' && settings && <section className="admin-panel admin-settings-panel"><div className="admin-panel-head"><div><p className="eyebrow">PRODAJNA PODEŠAVANJA</p><h2>Načini plaćanja</h2></div><Settings2 size={22}/></div><div className="admin-form-grid"><label>Naziv firme / prodavca<input value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}/></label><label>Sales email<input value={settings.sales_email || ''} onChange={(e) => setSettings({ ...settings, sales_email: e.target.value })}/></label><label>Support email<input value={settings.support_email || ''} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}/></label><label>PayPal link<input value={settings.paypal_url || ''} onChange={(e) => setSettings({ ...settings, paypal_url: e.target.value })} placeholder="https://..."/></label><label className="span-2">Podaci za uplatu na račun<textarea rows={5} value={settings.bank_instructions || ''} onChange={(e) => setSettings({ ...settings, bank_instructions: e.target.value })} placeholder={'Primalac:\nIBAN / račun:\nSWIFT:\nModel / poziv na broj:'}/></label></div><div className="payment-toggles"><Toggle label="Uplata na račun" icon={Banknote} value={settings.allow_bank_transfer} onChange={(value) => setSettings({ ...settings, allow_bank_transfer: value })}/><Toggle label="Predračun / faktura" icon={WalletCards} value={settings.allow_invoice} onChange={(value) => setSettings({ ...settings, allow_invoice: value })}/><Toggle label="PayPal" icon={CreditCard} value={settings.allow_paypal} onChange={(value) => setSettings({ ...settings, allow_paypal: value })}/><Toggle label="Kartica" icon={CreditCard} value={settings.allow_card} onChange={(value) => setSettings({ ...settings, allow_card: value })}/><Toggle label="Besplatan trial" icon={Sparkles} value={settings.trial_enabled} onChange={(value) => setSettings({ ...settings, trial_enabled: value })}/></div><button className="primary" onClick={saveSettings} disabled={working}><Save size={16}/> Sačuvaj prodaju</button></section>}
  </div>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Zap; label: string; value: string | number }) { return <div className="admin-metric"><span><Icon size={18}/></span><div><small>{label}</small><strong>{value}</strong></div></div> }

function OrdersTable({ orders, profiles, onPaid, onCancel, working }: { orders: SalesOrder[]; profiles: CustomerProfile[]; onPaid: (order: SalesOrder) => void; onCancel: (order: SalesOrder) => void; working: boolean }) {
  const email = (id: string) => profiles.find((p) => p.user_id === id)?.email || id.slice(0,8)
  return <div className="admin-table orders-table"><div className="admin-table-head"><span>Broj</span><span>Kupac</span><span>Paket</span><span>Iznos</span><span>Način</span><span>Status / akcija</span></div>{orders.length === 0 ? <div className="admin-empty">Još nema narudžbina.</div> : orders.map((order) => <div className="admin-table-row" key={order.id}><div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString('sr-RS',{dateStyle:'short',timeStyle:'short'})}</small></div><div><strong>{email(order.user_id)}</strong></div><div><strong>{order.sales_plans?.name || 'Paket'}</strong></div><div><strong>{Number(order.amount).toFixed(0)} {order.currency}</strong></div><div><span>{methodLabel(order.payment_method)}</span></div><div className="order-admin-actions"><span className={`status ${order.status}`}>{order.status}</span>{order.status === 'pending' && <><button className="paid-button" disabled={working} onClick={() => onPaid(order)}><CheckCircle2 size={13}/> Uplata primljena</button><button className="danger-soft" onClick={() => onCancel(order)}>Otkaži</button></>}</div></div>)}</div>
}

function LicenseForm({ form, setForm, plans }: { form: { planId:string; email:string; days:string; amount:string; paymentMethod:string; note:string }; setForm: (value: { planId:string; email:string; days:string; amount:string; paymentMethod:string; note:string }) => void; plans: SalesPlan[] }) { return <div className="admin-form-grid"><label>Paket<select value={form.planId} onChange={(e) => setForm({ ...form, planId:e.target.value })}><option value="">Izaberi paket</option>{plans.filter((p) => p.active).map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · {plan.price} {plan.currency}</option>)}</select></label><label>Veži za email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email:e.target.value })} placeholder="kupac@email.com ili prazno"/></label><label>Trajanje dana<input type="number" min="1" value={form.days} onChange={(e) => setForm({ ...form, days:e.target.value })} placeholder="prazno = period paketa"/></label><label>Prodajna cena<input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount:e.target.value })} placeholder="prazno = puna cena"/></label><label>Način prodaje<select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod:e.target.value })}>{adminMethods.map((method) => <option value={method.key} key={method.key}>{method.label}</option>)}</select></label><label>Napomena<input value={form.note} onChange={(e) => setForm({ ...form, note:e.target.value })} placeholder="Partner, akcija, račun..."/></label></div> }

function AdminPlan({ plan, onUpdate }: { plan: SalesPlan; onUpdate: (plan: SalesPlan, patch: Partial<SalesPlan>) => Promise<void> }) {
  const [price, setPrice] = useState(String(plan.price)); const [limit, setLimit] = useState(String(plan.monthly_generation_limit))
  return <article className={`admin-plan ${plan.active ? '' : 'inactive'}`}><div><span className="plan-code">{plan.code}</span><h3>{plan.name}</h3><p>{plan.billing_interval === 'yearly' ? 'Godišnje' : plan.billing_interval === 'monthly' ? 'Mesečno' : plan.billing_interval}</p></div><label>Cena<div className="price-admin-input"><input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)}/><b>{plan.currency}</b></div></label><label>Limit generacija<input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)}/></label><div className="admin-plan-actions"><button className={plan.active ? 'toggle-active active' : 'toggle-active'} onClick={() => onUpdate(plan,{active:!plan.active})}>{plan.active ? 'Aktivan' : 'Isključen'}</button><button className="primary" onClick={() => onUpdate(plan,{price:Number(price),monthly_generation_limit:Number(limit)})}><Save size={14}/> Sačuvaj</button></div></article>
}

function Toggle({ label, icon: Icon, value, onChange }: { label:string; icon:typeof Zap; value:boolean; onChange:(value:boolean)=>void }) { return <button type="button" className={value ? 'payment-toggle active' : 'payment-toggle'} onClick={() => onChange(!value)}><Icon size={17}/><span>{label}</span><b>{value ? 'UKLJUČENO' : 'ISKLJUČENO'}</b></button> }

const adminMethods = [{key:'manual',label:'Ručno / ostalo'},{key:'bank_transfer',label:'Uplata na račun'},{key:'invoice',label:'Predračun / faktura'},{key:'paypal',label:'PayPal'},{key:'card',label:'Kartica'},{key:'cash',label:'Keš'}]
function methodLabel(method: string) { return adminMethods.find((item) => item.key === method)?.label || (method === 'license_code' ? 'Licenca' : method) }
