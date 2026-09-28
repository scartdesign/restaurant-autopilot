from pathlib import Path

p=Path('.github/workflows/ci.yml')
text=p.read_text()
start='      - name: Editable template text slots guard\n'
end='      - name: Simplified customer UX guard\n'
if start not in text or end not in text:
    raise SystemExit('CI visual guard markers not found')
a=text.index(start)
b=text.index(end)
new='''      - name: Modern premium visual system guard
        shell: bash
        run: |
          set -euo pipefail
          STUDIO="src/components/SimpleContentStudio.tsx"
          DEMO="src/components/DemoScreen.tsx"
          RENDERER="src/components/RestaurantTemplateCanvas.tsx"
          MODERN="src/restaurant-template-modern.css"
          TYPES="src/types.ts"
          grep -Fq "name:'Editorial Luxe'" "$STUDIO"
          grep -Fq "name:'Full Bleed'" "$STUDIO"
          grep -Fq "name:'Clean Editorial'" "$STUDIO"
          grep -Fq "name:'Minimal Product'" "$STUDIO"
          grep -Fq "name:'Bold Campaign'" "$STUDIO"
          grep -Fq "name:'Modern Split'" "$STUDIO"
          grep -Fq "name:'Editorial Luxe'" "$DEMO"
          grep -Fq "name:'Full Bleed'" "$DEMO"
          grep -Fq "name:'Clean Editorial'" "$DEMO"
          grep -Fq "../restaurant-template-modern.css" "$RENDERER"
          grep -Fq "safeHeadline" "$RENDERER"
          grep -Fq "photoPosition" "$RENDERER"
          grep -Fq "case 'luxe'" "$RENDERER"
          grep -Fq "case 'editorial'" "$RENDERER"
          grep -Fq "case 'hero-menu'" "$RENDERER"
          grep -Fq "case 'minimal'" "$RENDERER"
          grep -Fq "case 'bold'" "$RENDERER"
          grep -Fq "case 'split'" "$RENDERER"
          grep -Fq '.rtm-luxe' "$MODERN"
          grep -Fq '.rtm-editorial' "$MODERN"
          grep -Fq '.rtm-hero-menu' "$MODERN"
          grep -Fq '.rtm-minimal' "$MODERN"
          grep -Fq '.rtm-bold' "$MODERN"
          grep -Fq '.rtm-split' "$MODERN"
          grep -Fq '/* Story refinements */' "$MODERN"
          grep -Fq 'font_scale?: number' "$TYPES"
          grep -Fq "text_slots:{...textSlots}" "$STUDIO"
          grep -Fq 'FINALNI PREVIEW' "$STUDIO"
          grep -Fq 'dts-editor-tabs' "$STUDIO"
          grep -Fq 'FINALNI PREVIEW' "$DEMO"
'''
p.write_text(text[:a]+new+text[b:])
print('CI now protects the modern premium visual system')
