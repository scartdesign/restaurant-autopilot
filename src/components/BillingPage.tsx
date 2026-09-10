import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Banknote, CalendarDays, CheckCircle2, Clock3, Copy, CreditCard, FileText, KeyRound, LogOut, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { CustomerSubscription, SalesOrder, SalesPlan, SalesSettings } from '../types'

type Method = 'bank_transfer' | 'paypal' | 'card' | 'invoice'

export function BillingPage({ email, onAccessChanged, onSignOut }: { email: string; onAccessChanged: () => Promise<void>; onSignOut: () => Promise<void> }) {
  const [plans, setPlans] = useState<SalesPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [settings, setSettings] = useState<SalesSettings | null>(null)
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [license, setLicense] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<SalesPlan | null>(null)
  const [method, setMethod] = useState<Method>('bank_transfer')
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { void load() }, [])

  const visiblePlans = useMemo(() => plans.filter((plan) => plan.billing_interval === interval), [plans, interval])
  const current = useMemo(() => subscriptions.find((sub) => ['active', 'trialing'].includes(sub.status) && (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now())), [subscriptions])

  async function load() {
    const [{ data: planData }, { data: subData }, { data: orderData }, { data: settingsData }] = await Promise.all([
      supabase.from('sales_plans').select('*').eq('active', true).eq('public', true).order('sort_order'),
      supabase.from('customer_subscriptions').select('*, sales_plans(*)').order('created_at', { ascending: false }),
      supabase.from('sales_orders').select('*, sales_plans(*)').order('created_at', { ascending: false }).limit(12),
      supabase.from('sales_settings').select('*').eq('id', 1).maybeSingle(),
    ])
    setPlans((planData || []) as SalesPlan[])
    setSubscriptions((subData || []) as CustomerSubscription[])
    setOrders((orderData || []) as SalesOrder[])
    setSettings((settingsData || null) as SalesSettings | null)
  }

  async function startTrial() {
    setWorking(true); setMessage('')
    const { error } = await supabase.rpc('request_trial')
    if (error) setMessage(error.message)
    else {
      setMessage('Probni period je aktiviran. Autopilot je otključan.')
      await load(); await onAccessChanged()
    }
    setWorking(false)
  }

  async function redeem() {
    if (!license.trim()) { setMessage('Unesi aktivacioni kod.'); return }
    setWorking(true); setMessage('')
    const { error } = await supabase.rpc('redeem_license_code', { p_code: license.trim() })
    if (error) setMessage(error.message)
    else {
      setLicense(''); setMessage('Licenca je aktivirana. Dobro došao u Restaurant Autopilot.')
      await load(); await onAccessChanged()
    }
    setWorking(false)
  }

  async function createOrder() {
    if (!selectedPlan) return
    setWorking(true); setMessage('')
    const { data, error } = await supabase.rpc('create_sales_order', { p_plan_id: selectedPlan.id, p_payment_method: method, p_customer_note: note || null })
    if (error) setMessage(error.message)
    else {
      const order = data as SalesOrder
      setMessage(`Zahtev ${order.order_number} je kreiran. Aktivacija sledi nakon potvrde uplate.`)
      setSelectedPlan(null); setNote(''); await load()
      if (method === 'paypal' && settings?.paypal_url) window.open(settings.paypal_url, '_blank', 'noopener,noreferrer')
    }
    setWorking(false)
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => setMessage('Kopirano.')).catch(() => setMessage('Kopiranje nije dozvoljeno u browseru.'))
  }

  const methods: { key: Method; label: string; enabled: boolean; icon: typeof Banknote }[] = [
    { key: 'bank_transfer', label: 'Uplata na račun', enabled: settings?.allow_bank_transfer ?? true, icon: Banknote },
    { key: 'invoice', label: 'Predračun / faktura', enabled: settings?.allow_invoice ?? true, icon: FileText },
    { key: 'paypal', label: 'PayPal', enabled: settings?.allow_paypal ?? false, icon: CreditCard },
    { key: 'card', label: 'Kartica', enabled: settings?.allow_card ?? false, icon: CreditCard },
  ]

  if (current) return <div className="billing-page"><div className="billing-topbar"><div><strong>Restaurant Autopilot</strong><span>{email}</span></div><button className="secondary" onClick={onSignOut}><LogOut size={15}/> Odjavi se</button></div><div className="access-success"><div className="access-success-icon"><BadgeCheck size={34}/></div><p className="eyebrow">PRISTUP AKTIVAN</p><h1>{current.sales_plans?.name || 'Aktivan paket'}</h1><p>{current.status === 'trialing' ? 'Probni period je aktivan.' : 'Tvoj paket je aktivan i Autopilot je spreman.'}</p><div className="access-meta"><span><ShieldCheck size={15}/> {current.status}</span><span><CalendarDays size={15}/> {current.expires_at ? `važi do ${new Date(current.expires_at).toLocaleDateString('sr-RS')}` : 'bez isteka'}</span></div><button className="primary" onClick={onAccessChanged}><Sparkles size={17}/> Uđi u Autopilot</button></div></div>

  return <div className="billing-page">
    <div className="billing-topbar"><div><strong>Restaurant Autopilot</strong><span>{email}</span></div><button className="secondary" onClick={onSignOut}><LogOut size={15}/> Odjavi se</button></div>
    <section className="billing-hero"><div><span className="billing-kicker"><Zap size={14}/> DESIGN · DISCOVERY · PUBLISH</span><h1>Izaberi paket i pokreni Autopilot.</h1><p>Jedan nalog, profesionalni vizuali, sadržaj, hashtag/discovery sistem i raspored objava.</p></div><div className="license-activate"><div><KeyRound size={19}/><strong>Imaš licencu?</strong></div><div className="license-row"><input value={license} onChange={(e) => setLicense(e.target.value.toUpperCase())} placeholder="RA-XXXX-XXXX-XXXX-XXXX"/><button onClick={redeem} disabled={working}>Aktiviraj</button></div></div></section>

    {message && <div className="billing-message">{message}</div>}

    <div className="billing-toggle"><button className={interval === 'monthly' ? 'active' : ''} onClick={() => setInterval('monthly')}>Mesečno</button><button className={interval === 'yearly' ? 'active' : ''} onClick={() => setInterval('yearly')}>Godišnje <span>2 meseca gratis</span></button></div>

    <section className="pricing-grid">{visiblePlans.map((plan, index) => <article className={`pricing-card ${index === 1 ? 'featured' : ''}`} key={plan.id}>{index === 1 && <div className="popular-badge">NAJPOPULARNIJI</div>}<p className="eyebrow">{plan.name.toUpperCase()}</p><h2>{plan.price}<small> {plan.currency}</small></h2><span className="billing-period">/{plan.billing_interval === 'yearly' ? 'god' : 'mes'}</span><p>{plan.description}</p><div className="plan-features"><span><CheckCircle2 size={14}/> do {plan.max_restaurants} {plan.max_restaurants === 1 ? 'restorana' : 'restorana'}</span><span><CheckCircle2 size={14}/> do {plan.monthly_generation_limit} AI/generacija mesečno</span><span><CheckCircle2 size={14}/> Brand Kit + Visual Studio</span><span><CheckCircle2 size={14}/> Publish Center + discovery</span></div><button className={index === 1 ? 'primary full' : 'secondary full'} onClick={() => setSelectedPlan(plan)}>Izaberi {plan.name}</button></article>)}</section>

    {settings?.trial_enabled && <section className="trial-strip"><div><Clock3 size={20}/><div><strong>Želiš prvo da probaš?</strong><span>Jednokratni probni period otključava pravi nalog bez kartice.</span></div></div><button className="secondary" onClick={startTrial} disabled={working}>Aktiviraj probni period</button></section>}

    {orders.length > 0 && <section className="customer-orders"><div className="section-title"><div><p className="eyebrow">MOJE NARUDŽBINE</p><h2>Status uplata</h2></div></div>{orders.map((order) => <div className="customer-order-row" key={order.id}><div><strong>{order.order_number}</strong><span>{order.sales_plans?.name || 'Paket'} · {new Date(order.created_at).toLocaleDateString('sr-RS')}</span></div><b>{order.amount} {order.currency}</b><span className={`status ${order.status}`}>{order.status}</span><button className="icon-button" title="Kopiraj broj" onClick={() => copy(order.order_number)}><Copy size={14}/></button></div>)}</section>}

    {selectedPlan && <div className="modal-backdrop" onMouseDown={() => setSelectedPlan(null)}><div className="modal-card sales-checkout" onMouseDown={(e) => e.stopPropagation()}><p className="eyebrow">KUPOVINA / AKTIVACIJA</p><h2>{selectedPlan.name} · {selectedPlan.price} {selectedPlan.currency}</h2><p className="muted">Izaberi način prodaje. Superadmin vidi zahtev i aktivira paket nakon potvrde.</p><div className="payment-methods">{methods.filter((m) => m.enabled).map((entry) => { const Icon = entry.icon; return <button key={entry.key} className={method === entry.key ? 'active' : ''} onClick={() => setMethod(entry.key)}><Icon size={18}/><span>{entry.label}</span></button> })}</div>{method === 'bank_transfer' && <div className="payment-help"><strong>Uplata na račun</strong><p>{settings?.bank_instructions || 'Nakon kreiranja zahteva dobićeš broj narudžbine. Podaci za uplatu se mogu podesiti iz Superadmin panela.'}</p></div>}{method === 'invoice' && <div className="payment-help"><strong>Predračun / faktura</strong><p>Upiši naziv firme, PIB ili napomenu u polje ispod. Administrator potvrđuje zahtev.</p></div>}{method === 'paypal' && <div className="payment-help"><strong>PayPal</strong><p>{settings?.paypal_url ? 'Posle kreiranja narudžbine otvoriće se PayPal stranica.' : 'PayPal link još nije podešen u Superadmin panelu.'}</p></div>}<label>Napomena<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Firma, PIB, kontakt ili napomena..."/></label><div className="modal-actions"><button className="secondary" onClick={() => setSelectedPlan(null)}>Otkaži</button><button className="primary" onClick={createOrder} disabled={working}><ShieldCheck size={16}/>{working ? 'Kreiram…' : 'Kreiraj zahtev'}</button></div></div></div>}
  </div>
}
