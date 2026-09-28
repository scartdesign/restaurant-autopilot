from pathlib import Path

# ---------- Production weekly view ----------
p=Path('src/components/SimpleContentStudio.tsx')
s=p.read_text()

s=s.replace("import { CalendarClock, Check, CheckCircle2, ChevronRight, Copy, Image as ImageIcon, LayoutTemplate, Pencil, Plus, Save, Send, Trash2, Upload, UtensilsCrossed, X } from 'lucide-react'",
            "import { CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, Copy, Image as ImageIcon, LayoutTemplate, Pencil, Plus, Save, Send, Sparkles, Trash2, Upload, UtensilsCrossed, X } from 'lucide-react'")

s=s.replace("  const[tab,setTab]=useState<StudioTab>('dishes')", "  const[tab,setTab]=useState<StudioTab>(()=>posts.length?'posts':'dishes')")

s=s.replace("  const recentPosts=useMemo(()=>[...posts].filter(post=>post.status!=='rejected').slice(0,20),[posts])",
            "  const recentPosts=useMemo(()=>[...posts].filter(post=>post.status!=='rejected').sort((a,b)=>new Date(a.scheduled_for||'9999-12-31').getTime()-new Date(b.scheduled_for||'9999-12-31').getTime()).slice(0,20),[posts])")

anchor="  async function duplicatePost(post:Post){\n"
approve="""  async function approvePost(post:Post){
    const{error}=await supabase.from('posts').update({status:'approved'}).eq('id',post.id).eq('restaurant_id',restaurant.id)
    if(error){setNotice(error.message);return}
    setNotice(`„${post.title||'Objava'}“ je odobrena.`)
    await onChanged()
  }

"""
if anchor in s and 'async function approvePost(' not in s:
    s=s.replace(anchor,approve+anchor,1)

old_nav="""    <nav className=\"dts-tabs\">
      <button className={tab==='dishes'?'active':''} onClick={()=>setTab('dishes')}><UtensilsCrossed size={17}/><span>Jela</span><b>{menuItems.length}</b></button>
      <button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}><LayoutTemplate size={17}/><span>Uredi ručno</span><b>{templates.length}</b></button>
      <button className={tab==='posts'?'active':''} onClick={()=>setTab('posts')}><ImageIcon size={17}/><span>Objave</span><b>{recentPosts.length}</b></button>
    </nav>"""
new_nav="""    <nav className=\"dts-tabs dts-autopilot-tabs\">
      <button className={tab==='posts'?'active':''} onClick={()=>setTab('posts')}><CalendarClock size={17}/><span>Ova nedelja</span><b>{recentPosts.length}</b></button>
      <button className={tab==='dishes'?'active':''} onClick={()=>setTab('dishes')}><UtensilsCrossed size={17}/><span>Meni</span><b>{menuItems.length}</b></button>
      <button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}><LayoutTemplate size={17}/><span>Uredi ručno</span><b>{templates.length}</b></button>
    </nav>"""
if old_nav in s:
    s=s.replace(old_nav,new_nav,1)

start=s.find("    {tab==='posts'&&<section className=\"dts-posts\">")
end=s.find("    </section>}\n  </div>\n}",start)
if start!=-1 and end!=-1:
    end += len("    </section>}")
    new_posts="""    {tab==='posts'&&<section className=\"dts-posts dts-week\">
      <div className=\"dts-week-hero\">
        <div><span><Sparkles size={15}/> AUTOPILOT NEDELJA</span><h2>Marketing je spreman.</h2><p>{recentPosts.length?`${recentPosts.length} predloga je pripremljeno. Pregledaj, odobri i nastavi dalje.`:'Dodaj nekoliko jela i Restorapp će pripremiti celu nedelju.'}</p></div>
        <div className=\"dts-week-summary\"><b>{recentPosts.length}</b><span>objava</span><i>{recentPosts.filter(post=>post.status==='approved'||post.status==='published').length} odobreno</i></div>
      </div>
      {recentPosts.length?<div className=\"dts-week-list\">{recentPosts.map((post,index)=>{const image=resolvePostImage(post);const tpl=(post.generation_meta?.visual_design?.template as TemplateId)||'editorial';const manual=(post.generation_meta?.manual_fields||{}) as Record<string,unknown>;const design=post.generation_meta?.visual_design;const postPrimary=design?.primary_color||restaurant.primary_color||'#073c38';const postAccent=design?.accent_color||restaurant.secondary_color||'#ef7d3a';const postBaseFont=(design?.base_font as BaseFontId)||baseFontFromLegacyPair(design?.font_pair);const postScriptFont=(design?.script_font as ScriptFontId)||'signature';const postFontScale=normalizeFontScale(design?.font_scale);const postPhotoPosition=design?.photo_position==='left'||design?.photo_position==='right'?design.photo_position:'center';const scheduled=post.scheduled_for?new Date(post.scheduled_for):null;const day=scheduled?new Intl.DateTimeFormat('sr-Latn-RS',{weekday:'short',day:'2-digit',month:'short'}).format(scheduled):`Predlog ${index+1}`;const time=scheduled?new Intl.DateTimeFormat('sr-Latn-RS',{hour:'2-digit',minute:'2-digit'}).format(scheduled):'Termin predlaže Autopilot';const ready=post.status==='approved'||post.status==='published';return <article className={`dts-week-card ${ready?'ready':''}`} key={post.id}>
        <div className=\"dts-week-time\"><strong>{day}</strong><span><Clock3 size={13}/>{time}</span><em>{post.post_type==='story'?'STORY':'FEED'}</em></div>
        <div className=\"dts-week-art\"><RestaurantTemplateCanvas template={tpl} image={image} headline={post.title||'Objava'} text={post.caption||''} price={typeof manual.price==='string'?manual.price:''} badge={typeof manual.badge==='string'?manual.badge:''} cta={post.cta||'Svrati danas'} primary={postPrimary} accent={postAccent} textSlots={design?.text_slots||{}} itemSlots={design?.item_slots||[]} baseFont={postBaseFont} scriptFont={postScriptFont} fontScale={postFontScale} photoPosition={postPhotoPosition} format={post.post_type==='story'?'story':'feed'}/></div>
        <div className=\"dts-week-copy\"><div className=\"dts-week-copy-head\"><span className={`status ${post.status}`}>{post.status==='draft'?'Čeka odobrenje':post.status==='approved'?'Odobreno':post.status==='published'?'Objavljeno':'Za doradu'}</span><strong>{post.title||'Bez naslova'}</strong></div><p>{post.caption||'Autopilot je pripremio ovu objavu.'}</p><small>{post.cta||'Svrati danas'}</small></div>
        <div className=\"dts-week-actions\">{!ready&&<button className=\"dts-week-approve\" onClick={()=>void approvePost(post)}><CheckCircle2 size={16}/> Odobri</button>}<button onClick={()=>editPost(post)}><Pencil size={14}/> Uredi</button><button onClick={()=>onNavigate('publish')}><CalendarClock size={14}/> Termin</button><button className=\"icon-only\" title=\"Dupliraj\" onClick={()=>void duplicatePost(post)}><Copy size={14}/></button></div>
      </article>})}</div>:<div className=\"dts-week-empty\"><Sparkles size={34}/><strong>Tvoja prva nedelja još nije napravljena.</strong><span>Dodaj jela i fotografije, pa pokreni Autopilot sa Početne.</span><button className=\"dts-primary compact\" onClick={()=>setTab('dishes')}>Dodaj jela</button></div>}
    </section>}"""
    s=s[:start]+new_posts+s[end:]

p.write_text(s)

# ---------- Demo: make weekly plan the thing people see first ----------
p=Path('src/components/DemoScreen.tsx')
s=p.read_text()
s=s.replace("<button className={tab === 'content' ? 'nav-active' : ''} onClick={() => {setTab('content');setDemoMoreOpen(false)}}><CalendarDays size={18} /> Sadržaj</button>",
            "<button className={tab === 'content' ? 'nav-active' : ''} onClick={() => {setTab('content');setDemoMoreOpen(false)}}><CalendarDays size={18} /> Nedelja</button>")
s=s.replace("        {tab === 'content' && <DemoContent notify={notify} setTab={setTab} />}",
            "        {tab === 'content' && <DemoWeek approved={approved} setApproved={setApproved} notify={notify} setTab={setTab} />}")

insert_before="type DemoContentTemplate={id:RestaurantTemplateId;name:string;category:string;kicker:string;note:string;badge?:string}\n"
week_component="""function DemoWeek({approved,setApproved,notify,setTab}:{approved:string[];setApproved:(value:string[])=>void;notify:(value:string)=>void;setTab:(tab:DemoTab)=>void}){
  const approvedCount=demoPosts.filter(post=>approved.includes(post.title)).length
  return <div className=\"dts-week demo-autopilot-week\">
    <section className=\"dts-week-hero\"><div><span><Sparkles size={15}/> RESTORAPP AUTOPILOT</span><h2>Tvoja nedelja je spremna.</h2><p>4 gotove objave. Tekst, format i termin su već predloženi. Ti samo odobriš.</p></div><div className=\"dts-week-summary\"><b>4</b><span>objave</span><i>{approvedCount} odobreno</i></div></section>
    <div className=\"dts-week-list\">{demoPosts.map((post,index)=>{const ready=approved.includes(post.title);return <article className={`dts-week-card ${ready?'ready':''}`} key={post.title}>
      <div className=\"dts-week-time\"><strong>{post.day}</strong><span><Clock3 size={13}/>{post.time}</span><em>{post.type}</em></div>
      <div className=\"dts-week-demo-photo\" style={{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.18)),url(${post.image})`}}><span>{String(index+1).padStart(2,'0')}</span></div>
      <div className=\"dts-week-copy\"><div className=\"dts-week-copy-head\"><span className={`status ${ready?'approved':'draft'}`}>{ready?'Odobreno':'Čeka odobrenje'}</span><strong>{post.title}</strong></div><p>{post.caption}</p><small>Discovery score {post.score} · Instagram + Facebook</small></div>
      <div className=\"dts-week-actions\">{!ready?<button className=\"dts-week-approve\" onClick={()=>{setApproved([...approved,post.title]);notify(`${post.title} je odobrena.`)}}><CheckCircle2 size={16}/> Odobri</button>:<button className=\"dts-week-approved\" onClick={()=>notify(`${post.title} je već odobrena.`)}><Check size={15}/> Spremno</button>}<button onClick={()=>notify('Demo: ručna dorada je opcionalna — Autopilot ostaje glavni tok.')}><Pencil size={14}/> Uredi</button><button onClick={()=>setTab('publish')}><CalendarClock size={14}/> Termin</button></div>
    </article>})}</div>
    <div className=\"dts-week-bottom\"><div><strong>{approvedCount===demoPosts.length?'Cela nedelja je odobrena.':'Još malo i gotovo.'}</strong><span>{approvedCount}/{demoPosts.length} objava spremno za zakazivanje.</span></div><button className=\"dts-primary\" onClick={()=>setTab('publish')}><Send size={16}/> Otvori Objave</button></div>
  </div>
}

"""
if insert_before in s and 'function DemoWeek(' not in s:
    s=s.replace(insert_before,week_component+insert_before,1)
p.write_text(s)

# ---------- CSS ----------
p=Path('src/simple-content-studio.css')
s=p.read_text()
css="""

/* Weekly Autopilot — outcome-first customer experience */
.dts-autopilot-tabs button:first-child{min-width:170px}
.dts-week{display:grid;gap:18px}
.dts-week-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:28px 30px;border-radius:24px;background:linear-gradient(135deg,#0c241c,#153d2d);color:#fff;box-shadow:0 20px 55px rgba(8,30,22,.14)}
.dts-week-hero>div:first-child{max-width:720px}.dts-week-hero span{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.13em;opacity:.78}.dts-week-hero h2{margin:8px 0 7px;font-size:clamp(28px,3.2vw,46px);letter-spacing:-.045em}.dts-week-hero p{margin:0;max-width:620px;color:rgba(255,255,255,.72);font-size:14px;line-height:1.55}
.dts-week-summary{min-width:132px;display:grid;justify-items:center;padding:17px 20px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(255,255,255,.07)}.dts-week-summary b{font-size:34px;line-height:1}.dts-week-summary span{margin-top:5px;font-size:10px!important;letter-spacing:.12em}.dts-week-summary i{margin-top:8px;font-size:11px;font-style:normal;color:#a9e4c1}
.dts-week-list{display:grid;gap:12px}.dts-week-card{display:grid;grid-template-columns:125px 132px minmax(0,1fr) auto;align-items:center;gap:16px;padding:13px;border:1px solid #e5e8e6;border-radius:20px;background:#fff;box-shadow:0 9px 28px rgba(18,34,27,.045);transition:.2s ease}.dts-week-card:hover{transform:translateY(-2px);box-shadow:0 15px 38px rgba(18,34,27,.085);border-color:#ccd8d1}.dts-week-card.ready{border-color:#cce6d5;background:linear-gradient(90deg,#fbfefc,#fff)}
.dts-week-time{align-self:stretch;display:flex;flex-direction:column;justify-content:center;padding:10px 8px 10px 12px;border-right:1px solid #edf0ee}.dts-week-time strong{font-size:13px;text-transform:capitalize}.dts-week-time span{display:flex;align-items:center;gap:5px;margin-top:7px;color:#69756f;font-size:12px}.dts-week-time em{width:max-content;margin-top:9px;padding:5px 7px;border-radius:7px;background:#f0f4f1;color:#436051;font-size:9px;font-weight:900;font-style:normal;letter-spacing:.08em}
.dts-week-art{width:132px;overflow:hidden;border-radius:14px;background:#eef1ef}.dts-week-art .restaurant-template-canvas{width:100%!important;height:auto!important}.dts-week-art .restaurant-template-canvas.story{aspect-ratio:1/1!important}
.dts-week-demo-photo{position:relative;width:132px;aspect-ratio:1;border-radius:14px;background-position:center;background-size:cover;overflow:hidden}.dts-week-demo-photo span{position:absolute;left:9px;top:9px;display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:rgba(13,29,22,.78);color:#fff;font-size:10px!important;letter-spacing:0!important;opacity:1!important}
.dts-week-copy{min-width:0}.dts-week-copy-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.dts-week-copy-head strong{font-size:17px;letter-spacing:-.02em}.dts-week-copy p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:8px 0 6px;color:#637069;font-size:12px;line-height:1.5}.dts-week-copy>small{color:#8b9690;font-size:10px}
.dts-week-actions{display:grid;gap:6px;min-width:116px}.dts-week-actions button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 11px;border:1px solid #e0e5e2;border-radius:10px;background:#fff;color:#445048;font-size:11px;font-weight:750;cursor:pointer}.dts-week-actions .dts-week-approve{border-color:#153d2d;background:#153d2d;color:#fff}.dts-week-actions .dts-week-approved{border-color:#cbe5d4;background:#edf8f1;color:#267145}.dts-week-actions .icon-only{min-width:34px}
.dts-week-bottom{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 22px;border:1px solid #e3e8e5;border-radius:18px;background:#fbfcfb}.dts-week-bottom div{display:grid;gap:3px}.dts-week-bottom strong{font-size:15px}.dts-week-bottom span{font-size:11px;color:#748078}.dts-week-empty{display:grid;justify-items:center;gap:10px;padding:48px 20px;border:1px dashed #d3dad6;border-radius:22px;background:#fff;text-align:center}.dts-week-empty svg{color:#2f7f55}.dts-week-empty strong{font-size:18px}.dts-week-empty span{max-width:440px;color:#6e7a73;font-size:12px}
@media(max-width:900px){.dts-week-hero{padding:22px;align-items:flex-start}.dts-week-card{grid-template-columns:86px 96px minmax(0,1fr)}.dts-week-actions{grid-column:1/-1;grid-template-columns:repeat(3,1fr);min-width:0}.dts-week-art,.dts-week-demo-photo{width:96px}.dts-week-time{padding-left:4px}.dts-week-copy p{-webkit-line-clamp:3}}
@media(max-width:620px){.dts-week-hero{display:grid;grid-template-columns:1fr auto;gap:14px;padding:20px 18px}.dts-week-hero h2{font-size:28px}.dts-week-hero p{grid-column:1/-1}.dts-week-summary{min-width:92px;padding:13px}.dts-week-card{grid-template-columns:74px 1fr;gap:11px;padding:10px}.dts-week-time{grid-column:1/-1;display:grid;grid-template-columns:1fr auto auto;align-items:center;border-right:0;border-bottom:1px solid #edf0ee;padding:3px 2px 10px}.dts-week-time span,.dts-week-time em{margin-top:0}.dts-week-art,.dts-week-demo-photo{width:74px}.dts-week-copy-head{gap:6px}.dts-week-copy-head strong{font-size:15px}.dts-week-actions{grid-template-columns:1fr 1fr auto}.dts-week-actions button:nth-child(3){display:none}.dts-week-bottom{align-items:stretch;flex-direction:column}.dts-week-bottom button{width:100%}}
"""
if '/* Weekly Autopilot — outcome-first customer experience */' not in s:
    s += css
p.write_text(s)

print('Weekly Autopilot experience patched')