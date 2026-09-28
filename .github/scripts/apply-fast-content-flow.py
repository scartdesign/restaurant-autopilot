from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))

studio = "src/components/SimpleContentStudio.tsx"
replace_once(
    studio,
    "        </div>\n\n        <div className=\"dts-editor-tabs\">",
    "        </div>\n\n        <div className=\"dts-quick-save\"><button className=\"dts-primary\" disabled={postWorking} onClick={()=>void savePost()}><CheckCircle2 size={17}/>{postWorking?'Čuvam…':editingPostId?'Sačuvaj izmene':'Sačuvaj odmah'}</button><small>Preview ti odgovara? Ne moraš ništa više da podešavaš.</small></div>\n\n        <div className=\"dts-editor-tabs\">",
)

css = Path("src/studio-download.css")
css_text = css.read_text()
append = r'''

/* Faster customer flow: save from the preview and swipe templates on mobile */
.dts-quick-save{display:grid;gap:5px;margin:10px 0 2px}.dts-quick-save .dts-primary{width:100%;min-height:43px}.dts-quick-save small{text-align:center;color:#849089;font-size:7px;line-height:1.35}
@media(max-width:820px){
  .dts-template-gallery{display:flex!important;grid-template-columns:none!important;overflow-x:auto;overscroll-behavior-inline:contain;scroll-snap-type:x mandatory;gap:10px;padding:2px 2px 10px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
  .dts-template-gallery article{flex:0 0 min(76vw,285px);scroll-snap-align:start}
  .dts-template-art{height:255px}
}
@media(max-width:540px){
  .dts-template-gallery article{flex-basis:min(84vw,300px)}
  .dts-template-art{height:285px}
}
'''
if "/* Faster customer flow: save from the preview and swipe templates on mobile */" not in css_text:
    css.write_text(css_text + append)

print("Fast Content Studio flow patch applied successfully.")
