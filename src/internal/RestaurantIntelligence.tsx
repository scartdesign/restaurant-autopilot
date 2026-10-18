import { useMemo, useState } from 'react';

export type RestaurantLead = {
  id: string;
  name: string;
  city: string;
  website: string;
  email: string;
  stage: 'new' | 'audit' | 'qualified' | 'offer' | 'contacted' | 'negotiation' | 'won' | 'lost';
  findings: Array<{ title: string; sourceUrl: string; verifiedAt: string }>;
  nextAction: string;
};

// Internal tool only. Mount behind server-validated owner/admin authorization.
// Persistence must use an RLS-protected table before production use.
export default function RestaurantIntelligence({
  initialLeads = [],
  onChange,
}: {
  initialLeads?: RestaurantLead[];
  onChange?: (leads: RestaurantLead[]) => Promise<void> | void;
}) {
  const [leads, setLeads] = useState<RestaurantLead[]>(initialLeads);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [findingText, setFindingText] = useState('');
  const [sourceText, setSourceText] = useState('');
  const filtered = useMemo(() => leads.filter(l =>
    [l.name, l.city, l.stage].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())), [leads, search]);
  const stages: RestaurantLead['stage'][] = ['new', 'audit', 'qualified', 'offer', 'contacted', 'negotiation', 'won', 'lost'];

  async function commit(next: RestaurantLead[]) {
    if (!onChange) {
      setNotice('Demo režim: izmene nisu sačuvane na serveru.');
      setLeads(next);
      return;
    }
    try { await onChange(next); setLeads(next); setNotice('Promene su sačuvane.'); }
    catch { setNotice('Čuvanje nije uspelo. Nema potvrde da su izmene upisane.'); }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const site = website.trim();
    if (site && !/^https:\/\//i.test(site)) return setNotice('Sajt mora biti HTTPS URL.');
    if (leads.some(l => l.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()
      && l.city.toLocaleLowerCase() === city.trim().toLocaleLowerCase())) return setNotice('Restoran već postoji.');
    const lead: RestaurantLead = {id: crypto.randomUUID(), name:name.trim(), city:city.trim(),
      website:site, email:email.trim(), stage:'new', findings:[], nextAction:'Proveriti javno dostupne izvore'};
    await commit([lead, ...leads]);
    setName(''); setCity(''); setWebsite(''); setEmail('');
  }
  async function recordFinding(e: React.FormEvent) {
    e.preventDefault();
    if (!auditId || !findingText.trim()) return;
    let parsed: URL;
    try { parsed = new URL(sourceText.trim()); } catch { setNotice('Potrebna je ispravna adresa izvora.'); return; }
    if (parsed.protocol !== 'https:') { setNotice('Izvor mora koristiti HTTPS.'); return; }
    const next = leads.map(lead => lead.id !== auditId ? lead : ({
      ...lead,
      findings: [...lead.findings, { title: findingText.trim(), sourceUrl: parsed.href, verifiedAt: new Date().toISOString() }]
    }));
    await commit(next);
    setAuditId(null); setFindingText(''); setSourceText('');
  }
  function proposal(lead: RestaurantLead) {
    const evidence = lead.findings.map(item => '- ' + item.title + ' (' + item.sourceUrl + ')').join('\n');
    const draft = 'Poštovani,\n\nPripremili smo predlog za poboljšanje digitalnog nastupa restorana ' +
      lead.name + '.\n\n' + (evidence ? 'Uočili smo:\n' + evidence + '\n\n' : '') +
      'Možemo unaprediti sajt, digitalni meni i proces rezervacije.\n\n' +
      'Da li biste želeli kratak razgovor o konkretnom rešenju?\n\nSCART Design';
    void navigator.clipboard.writeText(draft).then(
      () => setNotice('Nacrt ponude kopiran; nije poslat.'),
      () => setNotice('Kopiranje nije uspelo.')
    );
  }
  return <section aria-label="Restaurant Intelligence" style={{maxWidth:1120,margin:'auto',padding:24}}>
    <header><h1>Restaurant Intelligence</h1><p>Interni modul za proverljive audite i individualne prodajne ponude.</p></header>
    <div style={{display:'flex',gap:24,marginBottom:16}}>
      <strong>Restorana: {leads.length}</strong>
      <strong>Sa nalazima: {leads.filter(l=>l.findings.length).length}</strong>
      <strong>U pregovorima: {leads.filter(l=>l.stage==='negotiation').length}</strong>
    </div>
    {notice && <p role="status">{notice}</p>}
    <form onSubmit={add} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>
      <input aria-label="Restoran" required placeholder="Naziv restorana" value={name} onChange={e=>setName(e.target.value)} />
      <input aria-label="Grad" placeholder="Grad" value={city} onChange={e=>setCity(e.target.value)} />
      <input aria-label="Sajt" type="url" placeholder="https://sajt.com" value={website} onChange={e=>setWebsite(e.target.value)} />
      <input aria-label="Email" type="email" placeholder="Poslovni email" value={email} onChange={e=>setEmail(e.target.value)} />
      <button type="submit">Dodaj restoran</button>
    </form>
    <p><input aria-label="Pretraga" placeholder="Pretraži restorane…" value={search} onChange={e=>setSearch(e.target.value)} /></p>
    <div style={{display:'grid',gap:12}}>
      {filtered.map(lead=><article key={lead.id} style={{border:'1px solid #aaa',padding:16,borderRadius:10}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div><strong>{lead.name}</strong> · {lead.city}
            <p>{lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer">Sajt restorana</a> : 'Sajt nije dodat'}</p>
            <small>{lead.findings.length} dokumentovanih nalaza · {lead.nextAction}</small>
            {lead.findings.map((finding, i) => <p key={i}><small>{finding.title} — <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer">izvor</a></small></p>)}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              <button type="button" onClick={() => setAuditId(lead.id)}>Dodaj nalaz</button>
              <button type="button" onClick={() => proposal(lead)}>Kopiraj ponudu</button>
            </div>
            {auditId===lead.id && <form onSubmit={recordFinding} style={{display:'grid',gap:8,marginTop:8}}>
              <input required maxLength={300} aria-label="Opis nalaza" placeholder="Opis proverenog problema" value={findingText} onChange={e=>setFindingText(e.target.value)} />
              <input required type="url" aria-label="Izvor" placeholder="https://izvor..." value={sourceText} onChange={e=>setSourceText(e.target.value)} />
              <button type="submit">Sačuvaj nalaz</button>
            </form>}
          </div>
          <label>Status <select aria-label={'Status za '+lead.name} value={lead.stage} onChange={e=>void commit(leads.map(l=>l.id===lead.id?{...l,stage:e.target.value as RestaurantLead['stage']}:l))}>
            {stages.map(stage=><option key={stage} value={stage}>{stage}</option>)}
          </select></label>
        </div>
      </article>)}
    </div>
    <p style={{marginTop:20,fontSize:12}}>Nema automatskog prikupljanja podataka, slanja mejlova ili izmišljanja ocena. AI audit se dodaje samo uz izvor i datum provere.</p>
  </section>;
}
