import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ImagePlus, LayoutGrid, Sparkles, Target, WandSparkles } from 'lucide-react'

type Collection = 'premium' | 'dark' | 'sale' | 'clean' | 'family' | 'lunch'
type Suggestion = { id:string; label:string; title:string; reason:string; time:string; cta:string; image:string|null }

const food = {
  pizza:'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1400&q=88',
  pasta:'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=88',
  steak:'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=88',
  salad:'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=88',
  dessert:'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=88',
  risotto:'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=1200&q=88',
}

const baseSuggestions: Suggestion[] = [
  {id:'hero',label:'PRODAJNA PREPORUKA',title:'Guraj premium pizzu večeras',reason:'Najbolji spoj jakog vizuala, večernjeg termina i cilja rezervacija.',time:'18:30',cta:'Rezerviši sto',image:food.pizza},
  {id:'lunch',label:'RUČAK',title:'Carbonara za lunch rush',reason:'Kraći CTA i objava pred ručak daju jasan razlog da gost dođe danas.',time:'11:15',cta:'Svrati na ručak',image:food.pasta},
  {id:'weekend',label:'VIKEND KAMPANJA',title:'Porodični meni + desert',reason:'Vikend traži paket ponudu i više vizuala, ne samo jednu objavu.',time:'10:30',cta:'Rezerviši za vikend',image:food.dessert},
]

const collections:{id:Collection;name:string;accent:string;headline:string}[] = [
  {id:'premium',name:'Premium Food Grid',accent:'#ff9f0a',headline:'PREMIUM MENU'},
  {id:'dark',name:'Dark Luxe',accent:'#c9a66b',headline:'LUXURY FOOD'},
  {id:'sale',name:'Bold Offer',accent:'#ff6b1a',headline:'DELICIOUS DEALS'},
  {id:'clean',name:'Clean Menu',accent:'#9fbd82',headline:'FRESH MENU'},
  {id:'family',name:'Family Time',accent:'#e0a45a',headline:'FAMILY TIME'},
  {id:'lunch',name:'Lunch Rush',accent:'#ffad24',headline:'TIME 4 LUNCH'},
]

export function DemoCreative({ notify }:{ notify:(value:string)=>void }) {
  const [selectedId,setSelectedId] = useState('hero')
  const [collection,setCollection] = useState<Collection>('premium')
  const [risottoReady,setRisottoReady] = useState(false)
  const [generating,setGenerating] = useState(false)
  const [packWorking,setPackWorking] = useState(false)
  const selected = baseSuggestions.find(item=>item.id===selectedId) || baseSuggestions[0]
  const current = collections.find(item=>item.id===collection) || collections[0]
  const previewFoods = useMemo(()=>[selected.image || food.pizza, food.pasta, food.steak, risottoReady?food.risotto:null, food.dessert],[selected.image,risottoReady])

  function generateImage(){
    setGenerating(true)
    window.setTimeout(()=>{
      setRisottoReady(true)
      setGenerating(false)
      notify('AI demo: realistična fotografija rižota je generisana i ubačena u kampanju.')
    },700)
  }

  function createPack(){
    setPackWorking(true)
    window.setTimeout(()=>{
      setPackWorking(false)
      notify('Campaign Pack spreman: 5 vizuala + Feed/Story + CTA + termini.')
    },750)
  }

  return <div className="demo-creative-page">
    <header className="creative-hero demo-creative-hero">
      <div><span className="creative-kicker"><Sparkles size={15}/> CREATIVE AI</span><h1>Autopilot ti kaže šta da reklamiraš — i napravi reklamu.</h1><p>Izaberi preporuku, stil kampanje i odmah vidi paket vizuala. Ako nema fotografije jela, AI je pravi.</p><div className="creative-hero-actions"><span><Target size={15}/> preporuka + razlog</span><span><CalendarClock size={15}/> tačno vreme</span><span><ImagePlus size={15}/> AI food image</span></div></div>
      <div className="creative-pulse"><i/><strong>AI</strong><span>campaign ready</span></div>
    </header>

    <section className="creative-section">
      <div className="creative-section-head"><div><p className="eyebrow">ŠTA DA REKLAMIRAŠ DANAS</p><h2>3 konkretna predloga</h2></div><span>klikni predlog</span></div>
      <div className="creative-recommendations">{baseSuggestions.map((item,index)=><button key={item.id} type="button" className={`creative-rec-card ${selectedId===item.id?'active':''}`} onClick={()=>setSelectedId(item.id)}><div className="creative-rec-top"><span>0{index+1}</span><b>{item.label}</b></div><div className="creative-rec-image" style={{backgroundImage:`linear-gradient(180deg,transparent,rgba(7,12,9,.78)),url(${item.image})`}}/><strong>{item.title}</strong><p>{item.reason}</p><div className="creative-rec-meta"><span><CalendarClock size={13}/>{item.time}</span><span><Target size={13}/>{item.cta}</span></div></button>)}</div>
    </section>

    <section className="creative-section">
      <div className="creative-section-head"><div><p className="eyebrow">TEMPLATE LIBRARY</p><h2>Izgled kao prava reklamna kampanja</h2></div><span>{current.name}</span></div>
      <div className="creative-template-strip">{collections.map(item=><button key={item.id} type="button" className={`creative-template-chip ${collection===item.id?'active':''}`} onClick={()=>setCollection(item.id)} style={{'--demo-accent':item.accent} as React.CSSProperties}><i style={{background:`linear-gradient(90deg,#141714,${item.accent})`}}/><strong>{item.name}</strong><small>{item.id==='premium'?'Veliki hero + 4 prodajne kartice':item.id==='dark'?'Premium tamni vizual':item.id==='sale'?'Popust, 2x1 i jaka akcija':item.id==='clean'?'Čist meni i nova ponuda':item.id==='family'?'Porodica i vikend': 'Brza prodaja ručka'}</small></button>)}</div>

      <div className="campaign-builder-grid">
        <div className="demo-reference-pack" style={{'--demo-accent':current.accent} as React.CSSProperties}>
          <DemoTile image={previewFoods[0]} hero eyebrow="PREMIUM QUALITY" title={current.headline} subtitle={selected.title} logo/>
          <div className="demo-reference-mini-grid">
            <DemoTile image={previewFoods[1]} eyebrow="THE BEST FOOD" title="DELICIOUS TASTE" subtitle="OPEN NOW" logo/>
            <DemoTile image={previewFoods[2]} eyebrow="WE SERVE THE" title="BEST FOOD" subtitle="CHEF PICK" logo/>
            <DemoTile image={previewFoods[3]} eyebrow="IT'S ALWAYS" title="TIME 4 LUNCH" subtitle={risottoReady?'AI IMAGE READY':'NO PHOTO'} logo missing={!risottoReady}/>
            <DemoTile image={previewFoods[4]} eyebrow="IT'S ALWAYS" title="FAMILY TIME" subtitle="WEEKEND" logo/>
          </div>
        </div>

        <aside className="campaign-control-card demo-campaign-control">
          <span className="creative-kicker"><LayoutGrid size={14}/> CAMPAIGN BUILDER</span><h2>{selected.title}</h2><p>{selected.reason}</p>
          <div className="campaign-checklist"><span><CheckCircle2 size={14}/> 5 usklađenih vizuala</span><span><CheckCircle2 size={14}/> logo i boje restorana</span><span><CheckCircle2 size={14}/> Feed + Story + promo</span><span><CheckCircle2 size={14}/> termin {selected.time}</span></div>
          {!risottoReady?<div className="missing-photo-card"><ImagePlus size={20}/><div><strong>Rižoto nema fotografiju</strong><span>U pravom nalogu AI generiše food fotografiju, čuva je u meniju i koristi u objavama.</span></div><button type="button" onClick={generateImage} disabled={generating}>{generating?'AI generiše…':'Probaj AI sliku u demo-u'}</button></div>:<div className="demo-ai-ready"><CheckCircle2 size={18}/><div><strong>AI fotografija spremna</strong><span>Rižoto je sada automatski ubačen u četvrtu reklamu.</span></div></div>}
          <button className="creative-primary full big" type="button" onClick={createPack} disabled={packWorking}><WandSparkles size={18}/>{packWorking?'Pravim paket…':'Napravi celu kampanju'}</button>
        </aside>
      </div>
    </section>
  </div>
}

function DemoTile({image,eyebrow,title,subtitle,hero=false,logo=false,missing=false}:{image:string|null;eyebrow:string;title:string;subtitle:string;hero?:boolean;logo?:boolean;missing?:boolean}){
  return <div className={`demo-reference-tile ${hero?'hero':''} ${missing?'missing':''}`} style={image?{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.73)),url(${image})`}:undefined}>{logo&&<div className="demo-tile-logo">BN</div>}<div className="demo-tile-copy"><span>{eyebrow}</span><strong>{title}</strong><small>{subtitle}</small></div>{missing&&<div className="demo-missing-badge"><ImagePlus size={18}/> AI</div>}</div>
}
