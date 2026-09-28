from pathlib import Path

# 1) Dashboard: sell the outcome, not the editor.
p=Path('src/components/RestorappDashboardV2.tsx')
s=p.read_text()
s=s.replace("?{title:'Napravi prvu nedelju',text:'Restorapp će pripremiti sadržaj i termine za tebe.',label:'Napravi nedelju',kind:'week' as const}","?{title:'Napravi marketing za 7 dana',text:'Restorapp sam priprema plan, tekstove i termine. Ti samo pregledaš.',label:'Pokreni Autopilot',kind:'week' as const}")
s=s.replace("?{title:'Pregledaj sadržaj',text:`${posts.length} predloga je spremno. Odobri ono što ti se sviđa.`,label:'Pregledaj',kind:'content' as const}","?{title:'Tvoja nedelja je spremna',text:`${posts.length} predloga čeka pregled. Odobri dobre i završi posao.`,label:'Pregledaj nedelju',kind:'content' as const}")
s=s.replace("<span>GOOD AFTERNOON,</span>\n            <h1>Time to make<br/><em>today delicious!</em></h1>\n            <p>Restorapp pomaže da privučeš više gostiju, napraviš bolji sadržaj i razvijaš restoran — sve na jednom mestu.</p>\n            <div className=\"rd2-hero-actions\">\n              <button className=\"rd2-primary\" onClick={onCreate}><Sparkles size={17}/> Napravi sadržaj</button>\n            </div>","<span>RESTORAPP AUTOPILOT</span>\n            <h1>Marketing za 7 dana.<br/><em>Jedan klik.</em></h1>\n            <p>Ubaci meni i fotografije. Restorapp pripremi plan, tekstove i termine. Ti samo pregledaš i odobriš.</p>\n            <div className=\"rd2-hero-actions\">\n              <button className=\"rd2-primary\" onClick={()=>posts.length?onNavigate?.('dashboard'):void startFirstWeek()} disabled={firstWeekWorking}><Sparkles size={17}/> {firstWeekWorking?'Pripremam nedelju…':posts.length?'Otvori ovu nedelju':'Napravi moju nedelju'}</button>\n            </div>")
s=s.replace("<div className=\"rd2-hero-script\"><span>Great food</span><strong>brings people</strong><em>together</em></div>","<div className=\"rd2-hero-script\"><span>Manje posla.</span><strong>Više prisustva.</strong><em>Više gostiju.</em></div>")
s=s.replace("<header><h2>Brzo</h2></header>\n            <button onClick={()=>onNavigate?.('dashboard')}><Sparkles size={17}/><span>Sadržaj</span><ChevronRight size={15}/></button>","<header><h2>Brzo</h2></header>\n            <button onClick={()=>onNavigate?.('dashboard')}><Sparkles size={17}/><span>Pregledaj nedelju</span><ChevronRight size={15}/></button>")
p.write_text(s)

# 2) Main navigation: weekly outcome first.
p=Path('src/App.tsx')
s=p.read_text()
s=s.replace("<button className={activeTab==='dashboard'?'nav-active':''} onClick={()=>void openTab('dashboard')}><CalendarDays size={18}/> Sadržaj</button>","<button className={activeTab==='dashboard'?'nav-active':''} onClick={()=>void openTab('dashboard')}><CalendarDays size={18}/> Nedelja</button>")
p.write_text(s)

# 3) Studio: clearly secondary/manual, not the product promise.
p=Path('src/components/SimpleContentStudio.tsx')
s=p.read_text()
s=s.replace("<div><span>RESTORAPP CONTENT</span><h1>Od jela do objave za minut.</h1><p>Dodaj jelo jednom. Posle samo biraš gotov dizajn, upišeš tekst i sačuvaš.</p></div>\n      <div className=\"dts-mini-flow\"><b>1</b> Jelo <ChevronRight size={13}/><b>2</b> Šablon <ChevronRight size={13}/><b>3</b> Objava</div>","<div><span>OVA NEDELJA</span><h1>Pregledaj. Doradi samo ako želiš.</h1><p>Autopilot radi glavni posao. Ovde ručno menjaš jelo, vizual ili tekst samo kada ti zatreba.</p></div>\n      <div className=\"dts-mini-flow\"><b>1</b> Predlog <ChevronRight size={13}/><b>2</b> Pregled <ChevronRight size={13}/><b>3</b> Odobri</div>")
s=s.replace("<button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}><LayoutTemplate size={17}/><span>Šabloni</span><b>{templates.length}</b></button>","<button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}><LayoutTemplate size={17}/><span>Uredi ručno</span><b>{templates.length}</b></button>")
s=s.replace("<div className=\"dts-section-head\"><div><span>GOTOVI DIZAJNI</span><h2>Izaberi šablon</h2></div><small>{selectedDish?<>Za: <strong>{selectedDish.name}</strong></>:'Prvo izaberi jelo.'}</small></div>","<div className=\"dts-section-head\"><div><span>RUČNA DORADA</span><h2>Promeni izgled samo ako želiš</h2></div><small>{selectedDish?<>Za: <strong>{selectedDish.name}</strong></>:'Prvo izaberi jelo.'}</small></div>")
p.write_text(s)

print('Restorapp repositioned around weekly Autopilot outcome')