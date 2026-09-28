from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

canvas = Path("src/components/RestaurantTemplateCanvas.tsx")
text = canvas.read_text()
text = text.replace("  scriptFont?:string\n  fontScale?:number\n}", "  scriptFont?:string\n  fontScale?:number\n  photoPosition?:'left'|'center'|'right'\n}", 1)
text = text.replace("function photoStyle(image:string):CSSProperties{\n  return image?{backgroundImage:`url(\\\"${image.replace(/\\\"/g,'\\\\\\\"')}\\\")`}:{}\n}", "function photoStyle(image:string,position:'left'|'center'|'right'='center'):CSSProperties{\n  return image?{backgroundImage:`url(\\\"${image.replace(/\\\"/g,'\\\\\\\"')}\\\")`,backgroundPosition:position}:{}\n}", 1)
text = text.replace("scriptFont='signature',fontScale=1,\n}:Props){", "scriptFont='signature',fontScale=1,photoPosition='center',\n}:Props){", 1)
text = text.replace("photoStyle(image)", "photoStyle(image,photoPosition)")
canvas.write_text(text)

studio = "src/components/SimpleContentStudio.tsx"
replace_once(
    studio,
    "  const[fontScale,setFontScale]=useState(1)\n  const[textSlots,setTextSlots]",
    "  const[fontScale,setFontScale]=useState(1)\n  const[photoPosition,setPhotoPosition]=useState<'left'|'center'|'right'>('center')\n  const[textSlots,setTextSlots]",
)
replace_once(
    studio,
    "    setBaseFont(defaultBaseFont(nextTemplate));setScriptFont('signature');setFontScale(1)\n    setEditingPostId('');",
    "    setBaseFont(defaultBaseFont(nextTemplate));setScriptFont('signature');setFontScale(1);setPhotoPosition('center')\n    setEditingPostId('');",
)
replace_once(
    studio,
    "    setFontScale(normalizeFontScale(design?.font_scale))\n    setEditorPanel('text');",
    "    setFontScale(normalizeFontScale(design?.font_scale))\n    setPhotoPosition(design?.photo_position==='left'||design?.photo_position==='right'?design.photo_position:'center')\n    setEditorPanel('text');",
)
replace_once(
    studio,
    "        image_url:imageUrl,photo_position:'center',overlay:overlayFor(template),",
    "        image_url:imageUrl,photo_position:photoPosition,overlay:overlayFor(template),",
)
replace_once(
    studio,
    "fontScale={item.id===template?fontScale:1}/></div>",
    "fontScale={item.id===template?fontScale:1} photoPosition={item.id===template?photoPosition:'center'}/></div>",
)
replace_once(
    studio,
    "scriptFont={scriptFont} fontScale={fontScale}/>",
    "scriptFont={scriptFont} fontScale={fontScale} photoPosition={photoPosition}/>",
)
replace_once(
    studio,
    "            <div className=\"dts-color-pickers\"><label>Glavna<input type=\"color\" value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)}/><span>{primaryColor}</span></label><label>Akcent<input type=\"color\" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/><span>{accentColor}</span></label></div>\n          </div>",
    "            <div className=\"dts-color-pickers\"><label>Glavna<input type=\"color\" value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)}/><span>{primaryColor}</span></label><label>Akcent<input type=\"color\" value={accentColor} onChange={e=>setAccentColor(e.target.value)}/><span>{accentColor}</span></label></div>\n            <div className=\"dts-photo-position\"><div><strong>Pozicija fotografije</strong><small>Pomeri fokus bez komplikovanog crop editora.</small></div><div className=\"dts-format compact\"><button type=\"button\" className={photoPosition==='left'?'active':''} onClick={()=>setPhotoPosition('left')}>Levo</button><button type=\"button\" className={photoPosition==='center'?'active':''} onClick={()=>setPhotoPosition('center')}>Centar</button><button type=\"button\" className={photoPosition==='right'?'active':''} onClick={()=>setPhotoPosition('right')}>Desno</button></div></div>\n          </div>",
)
replace_once(
    studio,
    "const postFontScale=normalizeFontScale(design?.font_scale);return <article key={post.id}>",
    "const postFontScale=normalizeFontScale(design?.font_scale);const postPhotoPosition=design?.photo_position==='left'||design?.photo_position==='right'?design.photo_position:'center';return <article key={post.id}>",
)
replace_once(
    studio,
    "fontScale={postFontScale}/></div>",
    "fontScale={postFontScale} photoPosition={postPhotoPosition}/></div>",
)

css = Path("src/studio-download.css")
css_text = css.read_text()
needle = ".dts-font-scale-tools{display:flex;align-items:center;gap:7px}"
insert = ".dts-photo-position{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px;padding-top:12px;border-top:1px solid #e3e9e5}.dts-photo-position>div:first-child{display:grid;gap:2px}.dts-photo-position strong{font-size:10px;color:#173d35}.dts-photo-position small{font-size:8px;color:#78857f}.dts-photo-position .dts-format{flex:0 0 auto}\n" + needle
if needle not in css_text:
    raise SystemExit("studio-download.css insertion point not found")
css.write_text(css_text.replace(needle, insert, 1))

print('Photo position patch applied successfully.')
