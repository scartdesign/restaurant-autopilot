import { ArrowLeft, Bot, CreditCard, LockKeyhole, Scale, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type LegalKind = 'terms' | 'privacy' | 'ai' | 'refund'
type Identity = {
  company_name?: string | null
  legal_name?: string | null
  tax_id?: string | null
  company_number?: string | null
  address?: string | null
  support_email?: string | null
  sales_email?: string | null
}

const titles: Record<LegalKind, { eyebrow: string; title: string; icon: any }> = {
  terms: { eyebrow: 'PRAVNI DOKUMENT', title: 'Uslovi korišćenja', icon: Scale },
  privacy: { eyebrow: 'PRIVATNOST', title: 'Politika privatnosti', icon: LockKeyhole },
  ai: { eyebrow: 'AI TRANSPARENTNOST', title: 'Kako koristimo AI', icon: Bot },
  refund: { eyebrow: 'NAPLATA', title: 'Otkazivanje i povraćaj sredstava', icon: CreditCard },
}

export function LegalScreen({ kind, onBack }: { kind: LegalKind; onBack: () => void }) {
  const [id, setId] = useState<Identity>({})
  useEffect(() => { void supabase.rpc('public_sales_identity').then(({ data }) => setId((data || {}) as Identity)) }, [])
  const meta = titles[kind]
  const Icon = meta.icon
  const seller = id.legal_name || id.company_name || 'Restorapp'
  const contact = id.support_email || id.sales_email || 'podrška unutar aplikacije'

  return <div className="legal-screen">
    <header className="legal-top">
      <button className="secondary" onClick={onBack}><ArrowLeft size={16}/> Nazad</button>
      <div className="landing-brand"><span><ShieldCheck size={18}/></span><strong>Restorapp</strong></div>
    </header>
    <main className="legal-wrap">
      <div className="legal-title"><span className="eyebrow"><Icon size={14}/> {meta.eyebrow}</span><h1>{meta.title}</h1><p>Poslednje ažuriranje: 15.09.2026.</p></div>
      {kind === 'terms' && <Terms seller={seller} contact={contact} id={id}/>}
      {kind === 'privacy' && <Privacy seller={seller} contact={contact}/>}
      {kind === 'ai' && <Ai seller={seller}/>}
      {kind === 'refund' && <Refund seller={seller} contact={contact}/>}
    </main>
  </div>
}

function Terms({ seller, contact, id }: { seller: string; contact: string; id: Identity }) {
  const identity = [seller, id.address, id.tax_id ? 'PIB ' + id.tax_id : '', id.company_number ? 'MB ' + id.company_number : ''].filter(Boolean).join(' · ')
  return <div className="legal-copy">
    <section><h2>1. Usluga</h2><p>Restorapp je softverska usluga za planiranje, izradu i organizaciju marketinškog sadržaja restorana. Funkcije mogu uključivati Brand Kit, Visual Studio, AI predloge, generisanje tekstova i slika, kalendar objava, export i administraciju naloga.</p></section>
    <section><h2>2. Nalog i odgovornost korisnika</h2><p>Korisnik odgovara za tačnost podataka koje unosi, prava na logotipe i fotografije koje postavlja, kao i za konačnu proveru sadržaja pre objavljivanja. Pristupni podaci naloga ne treba da se dele sa neovlašćenim licima.</p></section>
    <section><h2>3. Paketi i limiti</h2><p>Funkcije, broj lokacija, mesečni limit generacija i AI slika zavise od aktivnog paketa. Sistem može tehnički ograničiti korišćenje kada je paket istekao ili kada je dostignut limit.</p></section>
    <section><h2>4. AI sadržaj</h2><p>AI sadržaj je pomoćni predlog, ne garancija rezultata. Korisnik treba da proveri cene, popuste, radno vreme, tvrdnje i sve druge činjenice pre objavljivanja.</p></section>
    <section><h2>5. Dostupnost</h2><p>Cilj je pouzdan rad servisa, ali povremeni prekidi mogu nastati zbog održavanja ili zavisnih servisa kao što su Supabase, OpenAI, email ili buduće Meta/payment integracije.</p></section>
    <section><h2>6. Nosilac usluge</h2><p><b>{identity}</b>. Kontakt: {contact}.</p></section>
  </div>
}

function Privacy({ seller, contact }: { seller: string; contact: string }) {
  return <div className="legal-copy">
    <section><h2>1. Koje podatke čuvamo</h2><p>Možemo čuvati podatke naloga, podatke restorana, meni, fotografije, generisani sadržaj, podatke o paketu i narudžbinama, support zahteve i tehničke zapise potrebne za rad i bezbednost sistema.</p></section>
    <section><h2>2. Zašto ih koristimo</h2><p>Podaci se koriste za pružanje usluge, autentikaciju, naplatu i evidenciju, podršku, zaštitu od zloupotrebe, generisanje sadržaja i poboljšanje pouzdanosti proizvoda.</p></section>
    <section><h2>3. Spoljni servisi</h2><p>Za pojedine funkcije mogu se koristiti infrastrukturni ili AI/email/payment provajderi. Njima se šalje samo ono što je potrebno za konkretnu funkciju.</p></section>
    <section><h2>4. Kontrola korisnika</h2><p>U podešavanjima naloga postoji izvoz podataka i kontrolisan zahtev za gašenje naloga. Finansijski dokumenti mogu biti zadržani kada postoji zakonska ili računovodstvena obaveza.</p></section>
    <section><h2>5. Bezbednost</h2><p>Osetljivi provider ključevi se čuvaju server-side i ne izlažu se browseru. Pristup poslovnim podacima ograničen je autentikacijom i pravilima baze.</p></section>
    <section><h2>6. Kontakt</h2><p>Rukovalac uslugom: <b>{seller}</b>. Zahtevi u vezi privatnosti mogu se poslati kroz podršku ili na {contact}.</p></section>
  </div>
}

function Ai({ seller }: { seller: string }) {
  return <div className="legal-copy">
    <section><h2>AI asistira, korisnik odlučuje</h2><p>Restorapp može koristiti generativne AI modele za marketinške preporuke, tekst i food fotografije. Sistem ne treba posmatrati kao automatskog donosioca poslovnih odluka.</p></section>
    <section><h2>Činjenice restorana</h2><p>Promptovi su projektovani tako da koriste podatke koje je restoran uneo i da ne izmišljaju popuste, cene, radno vreme, promet, recenzije ili rezultate kampanja. Ipak, korisnik mora da pregleda sadržaj pre objave.</p></section>
    <section><h2>Generisane slike</h2><p>AI food fotografije predstavljaju vizuelizaciju jela na osnovu opisa. Mogu se razlikovati od stvarnog serviranja. Restoran treba da ih koristi na način koji ne dovodi gosta u zabludu.</p></section>
    <section><h2>Provider</h2><p>AI funkcije zavise od provider konfiguracije koju kontroliše OWNER. Ako provider nije konfigurisan ili nije dostupan, sistem može koristiti Smart fallback tamo gde je to podržano.</p></section>
    <section><h2>Odgovornost</h2><p><b>{seller}</b> pruža alat za asistirano kreiranje sadržaja; konačna odluka o objavi, oglasu, budžetu i poslovnoj tvrdnji ostaje na korisniku.</p></section>
  </div>
}

function Refund({ seller, contact }: { seller: string; contact: string }) {
  return <div className="legal-copy">
    <section><h2>1. Trial i aktivacija</h2><p>Ako je trial omogućen, njegovo trajanje i funkcije prikazuju se uz paket. Po isteku trial-a pristup plaćenim funkcijama može biti ograničen dok se paket ne aktivira.</p></section>
    <section><h2>2. Otkazivanje</h2><p>Ručno kupljen paket se po pravilu ne obnavlja automatski osim kada je to izričito uključeno i prikazano korisniku. Korisnik može da zatraži prekid budućeg obnavljanja kroz podršku.</p></section>
    <section><h2>3. Povraćaj sredstava</h2><p>Zahtev za refund se razmatra pojedinačno u skladu sa važećim propisima, načinom plaćanja i stepenom korišćenja digitalne usluge.</p></section>
    <section><h2>4. Fakture i bankovne uplate</h2><p>Predračun/potvrda u aplikaciji nije fiskalni račun. Zvanični račun ili drugi obavezni dokument izdaje {seller} u skladu sa primenljivim propisima.</p></section>
    <section><h2>5. Kontakt</h2><p>Za pitanje o naplati ili refundu koristi podršku u aplikaciji ili kontakt {contact}.</p></section>
  </div>
}
