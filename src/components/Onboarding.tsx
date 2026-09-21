import { type ChangeEvent, type FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, Hash, Image as ImageIcon, MapPin, Palette, Sparkles, Star, Target, Upload, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { OpeningHoursEditor, defaultOpeningHours } from './OpeningHoursEditor'
import { optimizeImage } from '../lib/image'
import { browserTimeZone, commonTimeZones, isValidTimeZone } from '../lib/timezone'

type StarterDish={name:string;category:string;price:string}

export function Onboarding({ userId, onCreated, onCancel, additional = false }: { userId: string; onCreated: () => Promise<void>; onCancel?: () => void; additional?: boolean }) {
  const [form, setForm] = useState({
    name: '', city: '', neighborhood: '', country: 'Serbia', timezone: browserTimeZone(), cuisine_type: '', target_audience: '',
    social_goal: 'reservations', hashtag_mode: 'smart', brand_style: 'modern', tone: 'friendly',
    phone: '', instagram: '', posting_frequency: '5', primary_color: '#17211b', secondary_color: '#b9df72', opening_hours: defaultOpeningHours(),
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [step,setStep]=useState(1)
  const [menuCurrency,setMenuCurrency]=useState('RSD')
  const [starterDishes,setStarterDishes]=useState<StarterDish[]>([
    {name:'',category:'',price:''},{name:'',category:'',price:''},{name:'',category:'',price:''},
  ])

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) { setMessage('Logo mora biti PNG, JPG, WEBP ili SVG.'); return }
    if (file.size > 5 * 1024 * 1024) { setMessage('Logo može imati najviše 5 MB.'); return }
    setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); setMessage('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if(!form.name.trim()){setStep(1);setMessage('Upiši naziv restorana.');return} if(!isValidTimeZone(form.timezone)){setStep(1);setMessage('Vremenska zona nije validna. Izaberi npr. Europe/Belgrade.');return} const invalidStarterPrice=starterDishes.some(dish=>dish.name.trim()&&dish.price.trim()!==''&&Number.isNaN(Number(dish.price.replace(',','.')))); if(invalidStarterPrice){setStep(4);setMessage('Proveri cenu u početnom meniju. Koristi broj, npr. 890 ili 12,90.');return} setWorking(true); setMessage('')
    try {
      const { data: restaurant, error } = await supabase.from('restaurants').insert({
        owner_id: userId, name: form.name.trim(), city: form.city.trim() || null, neighborhood: form.neighborhood.trim() || null, country: form.country.trim() || 'Serbia', timezone: form.timezone.trim() || 'Europe/Belgrade', cuisine_type: form.cuisine_type.trim() || null,
        target_audience: form.target_audience.trim() || null, social_goal: form.social_goal, hashtag_mode: form.hashtag_mode, brand_style: form.brand_style, tone: form.tone,
        phone: form.phone.trim() || null, instagram: form.instagram.trim() || null, posting_frequency: Number(form.posting_frequency), primary_color: form.primary_color, secondary_color: form.secondary_color,
        default_logo_visible: true, default_logo_position: 'top-right', default_logo_size: 'm', default_logo_badge: 'white', default_overlay_strength: .68, opening_hours: form.opening_hours, onboarding_completed: true,
      }).select('id').single()
      if (error) throw error
      let logoWarning = ''
      let menuWarning = ''
      if (logoFile && restaurant?.id) {
        const optimized = logoFile.type==='image/svg+xml' ? logoFile : await optimizeImage(logoFile,{maxSide:1400,quality:.92})
        const ext = optimized.name.split('.').pop()?.toLowerCase() || 'webp'
        const path = `${userId}/${restaurant.id}/brand/logo-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, optimized, { upsert: false, contentType: optimized.type || undefined })
        if (uploadError) logoWarning = 'Restoran je kreiran, ali logo nije uploadovan. Dodaj ga kasnije u Brend.'
        else {
          const logoUrl = supabase.storage.from('restaurant-assets').getPublicUrl(path).data.publicUrl
          const { error: logoError } = await supabase.from('restaurants').update({ logo_url: logoUrl }).eq('id', restaurant.id)
          if (logoError) logoWarning = 'Restoran je kreiran, ali logo nije sačuvan. Dodaj ga kasnije u Brend.'
        }
      }
      const quickMenu=starterDishes.filter(dish=>dish.name.trim()).map((dish,index)=>({
        restaurant_id:restaurant.id,
        name:dish.name.trim(),
        category:dish.category.trim()||null,
        price:dish.price.trim()===''?null:Number(dish.price.replace(',','.')),
        currency:menuCurrency,
        is_active:true,
        marketing_priority:index===0?3:index===1?2:1,
      }))
      if(quickMenu.length){
        if(quickMenu.some(item=>item.price!==null&&Number.isNaN(item.price))) menuWarning='Restoran je kreiran, ali jedna cena nije bila validna pa početni meni nije dodat.'
        else{
          const{error:menuError}=await supabase.from('menu_items').insert(quickMenu)
          if(menuError) menuWarning='Restoran je kreiran, ali početna jela nisu sačuvana. Dodaj ih kasnije u Menu & Offers.'
          else void supabase.functions.invoke('content-engine',{body:{action:'log_activity',restaurantId:restaurant.id,eventType:'onboarding_menu_seeded',metadata:{count:quickMenu.length,hero:quickMenu[0]?.name||null}}}).catch(()=>null)
        }
      }
      localStorage.setItem('restorapp-active-restaurant', restaurant.id)
      const warning=[logoWarning,menuWarning].filter(Boolean).join(' ')
      if (warning) sessionStorage.setItem('restorapp-onboarding-warning', warning)
      await onCreated()
    } catch (error) { setMessage(error instanceof Error ? humanError(error.message) : 'Nisam uspeo da kreiram restoran.') }
    setWorking(false)
  }

  function nextStep(){
    if(step===1&&!form.name.trim()){setMessage('Upiši naziv restorana da nastavimo.');return}
    if(step===1&&!isValidTimeZone(form.timezone)){setMessage('Izaberi validnu vremensku zonu.');return}
    setMessage('');setStep(value=>Math.min(4,value+1))
  }
  function previousStep(){setMessage('');setStep(value=>Math.max(1,value-1))}

  return <div className="onboarding-page restorapp-onboarding"><div className="onboarding-card onboarding-pro">
    <div className="onboarding-top">{additional && onCancel ? <button type="button" className="onboarding-back" onClick={onCancel}><ArrowLeft size={18}/></button> : <div className="onboarding-restorapp-logo"><img src="./restorapp-logo.webp" alt="Restorapp"/></div>}<div><p className="eyebrow">{additional ? 'NOVA LOKACIJA' : 'RESTORAPP SETUP'}</p><h1>{additional ? 'Dodaj još jedan restoran' : 'Postavi restoran za nekoliko minuta'}</h1><p className="muted">{additional ? 'Svaka lokacija dobija svoj meni, brend i marketing plan.' : 'Četiri kratka koraka. Posle toga Restorapp već zna šta, gde i kako da promoviše.'}</p></div></div>

    <div className="onboarding-progress">
      {[{n:1,label:'Restoran'},{n:2,label:'Marketing'},{n:3,label:'Brend'},{n:4,label:'Prva jela'}].map(item=><button type="button" key={item.n} className={step===item.n?'active':step>item.n?'done':''} onClick={()=>item.n<step&&setStep(item.n)}><span>{step>item.n?<CheckCircle2 size={14}/>:item.n}</span><strong>{item.label}</strong></button>)}
    </div>

    <form onSubmit={submit} className="grid-form onboarding-grid onboarding-step-form">
      {step===1&&<>
        <div className="onboarding-step-intro span-2"><span>01</span><div><strong>Osnova restorana</strong><p>Ovo Restorapp koristi za lokalni reach, ton i preporuke.</p></div></div>
        <label>Naziv restorana<input autoFocus required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Bella Napoli"/></label>
        <label>Tip kuhinje<input value={form.cuisine_type} onChange={e=>setForm({...form,cuisine_type:e.target.value})} placeholder="Italijanska, burger, tradicionalna…"/></label>
        <label>Grad<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="Beograd"/></label>
        <label>Kraj / naselje<input value={form.neighborhood} onChange={e=>setForm({...form,neighborhood:e.target.value})} placeholder="Vračar"/></label>
        <label>Država<input value={form.country} onChange={e=>setForm({...form,country:e.target.value})}/></label>
        <label>Vremenska zona<input list="onboarding-timezones" value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})} placeholder="Europe/Belgrade"/><datalist id="onboarding-timezones">{commonTimeZones.map(zone=><option key={zone} value={zone}/>)}</datalist></label>
      </>}

      {step===2&&<>
        <div className="onboarding-step-intro span-2"><span>02</span><div><strong>Kako želiš da rasteš?</strong><p>Na osnovu ovoga AI bira CTA, format, učestalost i discovery.</p></div></div>
        <label className="span-2">Ciljna publika<input value={form.target_audience} onChange={e=>setForm({...form,target_audience:e.target.value})} placeholder="Parovi, porodice, turisti, poslovni ljudi…"/></label>
        <label>Glavni cilj<select value={form.social_goal} onChange={e=>setForm({...form,social_goal:e.target.value})}><option value="reservations">Više rezervacija</option><option value="walk_ins">Više dolazaka</option><option value="delivery">Više porudžbina</option><option value="awareness">Prepoznatljivost</option></select></label>
        <label>Objava nedeljno<select value={form.posting_frequency} onChange={e=>setForm({...form,posting_frequency:e.target.value})}>{[3,4,5,6,7].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <label>Stil brenda<select value={form.brand_style} onChange={e=>setForm({...form,brand_style:e.target.value})}><option value="modern">Moderan</option><option value="premium">Premium</option><option value="traditional">Tradicionalan</option><option value="fast_food">Fast food</option><option value="casual">Casual</option></select></label>
        <label>Ton komunikacije<select value={form.tone} onChange={e=>setForm({...form,tone:e.target.value})}><option value="friendly">Prijateljski</option><option value="premium">Premium</option><option value="playful">Razigran</option><option value="traditional">Tradicionalan</option><option value="direct">Direktan</option></select></label>
        <label>Hashtag strategija<select value={form.hashtag_mode} onChange={e=>setForm({...form,hashtag_mode:e.target.value})}><option value="smart">Smart — automatski balans</option><option value="local">Local focus</option><option value="balanced">Balanced</option><option value="minimal">Minimal</option></select></label>
        <label>Instagram<input value={form.instagram} onChange={e=>setForm({...form,instagram:e.target.value})} placeholder="@bellanapoli"/></label>
        <label className="span-2">Telefon<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+381…"/></label>
      </>}

      {step===3&&<>
        <div className="onboarding-step-intro span-2"><span>03</span><div><strong>Brend i radno vreme</strong><p>Logo je opcionalan. Boje i radno vreme možeš kasnije menjati u Podešavanjima.</p></div></div>
        <div className="onboarding-brand-card span-2"><div className="onboarding-brand-title"><Palette size={18}/><div><strong>Logo i boje</strong><span>Restorapp ih automatski koristi u vizualima.</span></div></div><div className="onboarding-brand-body"><label className="onboarding-logo-upload"><div className="onboarding-logo-preview">{logoPreview?<img src={logoPreview} alt="Logo preview"/>:<ImageIcon size={25}/>}</div><span><Upload size={15}/> {logoPreview?'Promeni logo':'Ubaci logo'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={chooseLogo}/></label><label>Primarna boja<input type="color" value={form.primary_color} onChange={e=>setForm({...form,primary_color:e.target.value})}/></label><label>Akcent boja<input type="color" value={form.secondary_color} onChange={e=>setForm({...form,secondary_color:e.target.value})}/></label><div className="onboarding-brand-swatch"><i style={{background:form.primary_color}}/><i style={{background:form.secondary_color}}/><span>Identitet se čuva za ovu lokaciju.</span></div></div></div>
        <div className="onboarding-hours-card span-2"><OpeningHoursEditor value={form.opening_hours} onChange={(opening_hours)=>setForm({...form,opening_hours})}/></div>
      </>}

      {step===4&&<>
        <div className="onboarding-step-intro span-2"><span>04</span><div><strong>Prva jela za Autopilot</strong><p>Dodaj do 3 signature jela. Prvo uneseno jelo automatski postaje HERO i vodi prve kampanje.</p></div></div>
        <div className="onboarding-menu-toolbar span-2"><div><UtensilsCrossed size={18}/><span><strong>Brzi meni</strong><small>Korak je opcionalan — možeš ga preskočiti i meni dopuniti kasnije.</small></span></div><label>Valuta<select value={menuCurrency} onChange={e=>setMenuCurrency(e.target.value)}><option value="RSD">RSD</option><option value="EUR">EUR</option><option value="CHF">CHF</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="BAM">BAM</option><option value="MKD">MKD</option><option value="BGN">BGN</option></select></label></div>
        <div className="onboarding-starter-menu span-2">
          {starterDishes.map((dish,index)=><article className="onboarding-starter-dish" key={index}>
            <div className="starter-dish-head"><span className={index===0?'hero':'priority'}>{index===0?<><Star size={12}/> HERO</>:index===1?'VISOK':'STANDARD'}</span><strong>Jelo {index+1}</strong></div>
            <label>Naziv<input value={dish.name} onChange={e=>setStarterDishes(items=>items.map((item,i)=>i===index?{...item,name:e.target.value}:item))} placeholder={index===0?'Pizza Capricciosa':index===1?'Carbonara':'Tiramisu'}/></label>
            <div className="starter-dish-fields"><label>Kategorija<input value={dish.category} onChange={e=>setStarterDishes(items=>items.map((item,i)=>i===index?{...item,category:e.target.value}:item))} placeholder={index===0?'Pizza':index===1?'Pasta':'Desert'}/></label><label>Cena<input inputMode="decimal" value={dish.price} onChange={e=>setStarterDishes(items=>items.map((item,i)=>i===index?{...item,price:e.target.value}:item))} placeholder={menuCurrency==='RSD'?'890':'12.90'}/></label></div>
          </article>)}
        </div>
        <div className="onboarding-starter-note span-2"><Sparkles size={16}/><span>Sa jednim HERO jelom Restorapp odmah ima fokus za Campaign Builder, Launch Center i AUTO WEEK preflight.</span></div>
      </>}

      {message&&<p className="form-message span-2">{message}</p>}
      <div className="onboarding-step-actions span-2">
        {step>1?<button type="button" className="secondary" onClick={previousStep}><ArrowLeft size={16}/> Nazad</button>:additional&&onCancel?<button type="button" className="secondary" onClick={onCancel}>Otkaži</button>:<span/>}
        {step<4?<button type="button" className="primary" onClick={nextStep}>Nastavi <ArrowRight size={16}/></button>:<button className="primary onboarding-submit" disabled={working}><Sparkles size={17}/> {working?'Kreiram…':additional?'Dodaj lokaciju':'Pokreni Restorapp'}</button>}
      </div>
    </form>
  </div></div>
}
function humanError(v:string){if(v.includes('Dostignut je limit restorana'))return'Dostignut je broj restorana dozvoljen tvojim paketom.';if(v.includes('Aktivan paket je potreban'))return'Potreban je aktivan paket da dodaš restoran.';return v}
