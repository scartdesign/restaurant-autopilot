from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# 1) Persist font scale in the visual design metadata.
replace_once(
    "src/types.ts",
    "  script_font?: string\n  price_visible?: boolean",
    "  script_font?: string\n  font_scale?: number\n  price_visible?: boolean",
)

# 2) Let every template canvas own its font scale instead of relying on a global DOM override.
replace_once(
    "src/components/RestaurantTemplateCanvas.tsx",
    "  scriptFont?:string\n}",
    "  scriptFont?:string\n  fontScale?:number\n}",
)
replace_once(
    "src/components/RestaurantTemplateCanvas.tsx",
    "  template,image,headline,text,price='',badge='',cta='BUY',primary,accent,logoUrl,format='feed',className='',textSlots={},itemSlots=[],baseFont='modern-sans',scriptFont='signature',\n}:Props){",
    "  template,image,headline,text,price='',badge='',cta='BUY',primary,accent,logoUrl,format='feed',className='',textSlots={},itemSlots=[],baseFont='modern-sans',scriptFont='signature',fontScale=1,\n}:Props){",
)
replace_once(
    "src/components/RestaurantTemplateCanvas.tsx",
    "    '--rt-script-font':scriptFontStack(scriptFont),\n    ...formatStyle,",
    "    '--rt-script-font':scriptFontStack(scriptFont),\n    '--rt-user-font-scale':Math.min(1.15,Math.max(.85,fontScale)),\n    ...formatStyle,",
)

# 3) Make production Content Studio keep the font size per saved post.
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "function overlayFor(template:TemplateId){\n  if(template==='minimal'||template==='hero-menu'||template==='family')return .42\n  if(template==='luxe'||template==='editorial'||template==='premium-grid')return .58\n  return .7\n}\n",
    "function overlayFor(template:TemplateId){\n  if(template==='minimal'||template==='hero-menu'||template==='family')return .42\n  if(template==='luxe'||template==='editorial'||template==='premium-grid')return .58\n  return .7\n}\nfunction normalizeFontScale(value:unknown){\n  const parsed=Number(value)\n  return Number.isFinite(parsed)?Math.min(1.15,Math.max(.85,parsed)):1\n}\n",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "  const[scriptFont,setScriptFont]=useState<ScriptFontId>('signature')\n  const[textSlots,setTextSlots]",
    "  const[scriptFont,setScriptFont]=useState<ScriptFontId>('signature')\n  const[fontScale,setFontScale]=useState(1)\n  const[textSlots,setTextSlots]",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "    setBaseFont(defaultBaseFont(nextTemplate));setScriptFont('signature')\n    setEditingPostId('');",
    "    setBaseFont(defaultBaseFont(nextTemplate));setScriptFont('signature');setFontScale(1)\n    setEditingPostId('');",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "    setScriptFont((design?.script_font as ScriptFontId)||'signature')\n    setEditorPanel('text');",
    "    setScriptFont((design?.script_font as ScriptFontId)||'signature')\n    setFontScale(normalizeFontScale(design?.font_scale))\n    setEditorPanel('text');",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "        primary_color:primaryColor,accent_color:accentColor,base_font:baseFont,script_font:scriptFont,text_slots:{...textSlots},item_slots:itemSlots.map(item=>({...item})),",
    "        primary_color:primaryColor,accent_color:accentColor,base_font:baseFont,script_font:scriptFont,font_scale:fontScale,text_slots:{...textSlots},item_slots:itemSlots.map(item=>({...item})),",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "        manual_fields:{price:priceText.trim(),badge:badgeText.trim(),template_name:selectedTemplate.name,primary_color:primaryColor,accent_color:accentColor,base_font:baseFont,script_font:scriptFont},",
    "        manual_fields:{price:priceText.trim(),badge:badgeText.trim(),template_name:selectedTemplate.name,primary_color:primaryColor,accent_color:accentColor,base_font:baseFont,script_font:scriptFont,font_scale:fontScale},",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "scriptFont={item.id===template?scriptFont:'signature'}/></div>",
    "scriptFont={item.id===template?scriptFont:'signature'} fontScale={item.id===template?fontScale:1}/></div>",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "itemSlots={itemSlots} baseFont={baseFont} scriptFont={scriptFont}/>",
    "itemSlots={itemSlots} baseFont={baseFont} scriptFont={scriptFont} fontScale={fontScale}/>",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "            <div className=\"dts-font-title\"><span>TIPOGRAFIJA</span><small>Probrane kombinacije koje rade u restoran dizajnu.</small></div>\n            <div className=\"dts-font-group\"><strong>Osnovni font</strong>",
    "            <div className=\"dts-font-title\"><span>TIPOGRAFIJA</span><small>Probrane kombinacije koje rade u restoran dizajnu.</small></div>\n            <div className=\"dts-font-scale-control\"><div className=\"dts-font-scale-copy\"><strong>Veličina teksta</strong><small>Čuva se posebno za svaku objavu.</small></div><div className=\"dts-font-scale-tools\"><button type=\"button\" onClick={()=>setFontScale(current=>Math.max(.85,Math.round((current-.05)*100)/100))} aria-label=\"Smanji tekst\">−</button><input type=\"range\" min=\"85\" max=\"115\" step=\"1\" value={Math.round(fontScale*100)} onChange={e=>setFontScale(Number(e.target.value)/100)} aria-label=\"Veličina teksta\"/><button type=\"button\" onClick={()=>setFontScale(current=>Math.min(1.15,Math.round((current+.05)*100)/100))} aria-label=\"Povećaj tekst\">+</button><b>{Math.round(fontScale*100)}%</b></div></div>\n            <div className=\"dts-font-group\"><strong>Osnovni font</strong>",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "const postScriptFont=(design?.script_font as ScriptFontId)||'signature';return <article key={post.id}>",
    "const postScriptFont=(design?.script_font as ScriptFontId)||'signature';const postFontScale=normalizeFontScale(design?.font_scale);return <article key={post.id}>",
)
replace_once(
    "src/components/SimpleContentStudio.tsx",
    "itemSlots={design?.item_slots||[]} baseFont={postBaseFont} scriptFont={postScriptFont}/></div>",
    "itemSlots={design?.item_slots||[]} baseFont={postBaseFont} scriptFont={postScriptFont} fontScale={postFontScale}/></div>",
)

# 4) Keep the existing DOM-injected slider only for the public demo. Production now uses React state.
replace_once(
    "src/studio-download.ts",
    "  document.querySelectorAll<HTMLElement>('.restaurant-template-canvas').forEach(canvas=>{",
    "  document.querySelectorAll<HTMLElement>('.demo-shell .restaurant-template-canvas').forEach(canvas=>{",
)
replace_once(
    "src/studio-download.ts",
    "  document.querySelectorAll<HTMLElement>(`.${FONT_SCALE_CLASS}`).forEach(control=>{",
    "  document.querySelectorAll<HTMLElement>(`.demo-shell .${FONT_SCALE_CLASS}`).forEach(control=>{",
)
replace_once(
    "src/studio-download.ts",
    "  document.querySelectorAll<HTMLElement>('.dts-font-editor').forEach(editor=>{",
    "  document.querySelectorAll<HTMLElement>('.demo-shell .dts-font-editor').forEach(editor=>{",
)

print('Font scale persistence patch applied successfully.')
