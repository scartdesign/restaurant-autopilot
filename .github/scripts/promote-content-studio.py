from pathlib import Path
p=Path('src/components/SimpleContentStudio.tsx')
s=p.read_text()
replacements={
"<div><span>OVA NEDELJA</span><h1>Pregledaj. Doradi samo ako želiš.</h1><p>Autopilot radi glavni posao. Ovde ručno menjaš jelo, vizual ili tekst samo kada ti zatreba.</p></div>":"<div><span>RESTORAPP STUDIO</span><h1>Autopilot ili ručno. Sve na jednom mestu.</h1><p>Pregledaj gotovu nedelju ili napravi novu objavu iz menija i premium dizajna.</p></div>",
"<button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}><LayoutTemplate size={17}/><span>Uredi ručno</span><b>{templates.length}</b></button>":"<button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}><LayoutTemplate size={17}/><span>Kreiraj objavu</span><b>{templates.length}</b></button>",
"<div className=\"dts-section-head\"><div><span>RUČNA DORADA</span><h2>Promeni izgled samo ako želiš</h2></div><small>{selectedDish?<>Za: <strong>{selectedDish.name}</strong></>:'Prvo izaberi jelo.'}</small></div>":"<div className=\"dts-section-head\"><div><span>DIZAJN OBJAVE</span><h2>Izaberi pravac i napravi objavu</h2></div><small>{selectedDish?<>Za: <strong>{selectedDish.name}</strong></>:'Prvo izaberi jelo.'}</small></div>",
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit('missing expected studio text: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s)
print('content studio promoted to first-class workflow')