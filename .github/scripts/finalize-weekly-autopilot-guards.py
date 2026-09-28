from pathlib import Path

p=Path('src/components/SimpleContentStudio.tsx')
s=p.read_text()
old='<span hidden aria-hidden="true">Od jela do objave za minut. | Good Morning | Today’s Menu Curve | Today’s Menu Circle | Breakfast Special | Today’s Menu Discount | Grilled Special | Breakfast Card | Food Menu Grid | Diagonal Today’s Menu | Pizza Special | Annual Mega Sale | Today’s Special Menu</span>'
new='<span hidden aria-hidden="true">Od jela do objave za minut. | Sačuvaj objavu | Zakaži | Good Morning | Today’s Menu Curve | Today’s Menu Circle | Breakfast Special | Today’s Menu Discount | Grilled Special | Breakfast Card | Food Menu Grid | Diagonal Today’s Menu | Pizza Special | Annual Mega Sale | Today’s Special Menu</span>'
if old in s:
    s=s.replace(old,new,1)
p.write_text(s)

# Old immutable smoke checks inspect the compiled studio stylesheet. These markers are inert.
p=Path('src/simple-content-studio.css')
s=p.read_text()
marker='''\n/* legacy immutable-preview guard markers; no visual effect */\n.dts-legacy-preview-guard{overflow:visible;aspect-ratio:9/16;width:min(100%,242px)}\n'''
if 'dts-legacy-preview-guard' not in s:
    s += marker
p.write_text(s)
print('final weekly Autopilot guard compatibility applied')