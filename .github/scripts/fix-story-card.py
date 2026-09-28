from pathlib import Path

path=Path('src/components/SimpleContentStudio.tsx')
text=path.read_text()
old="baseFont={postBaseFont} scriptFont={postScriptFont} fontScale={postFontScale} photoPosition={postPhotoPosition}/>"
new="baseFont={postBaseFont} scriptFont={postScriptFont} fontScale={postFontScale} photoPosition={postPhotoPosition} format={post.post_type==='story'?'story':'feed'}/>"
if old not in text:
    raise SystemExit('Saved post canvas marker not found')
path.write_text(text.replace(old,new,1))
print('Story saved-card preview fix applied.')
