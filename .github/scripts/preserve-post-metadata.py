from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))

path = "src/components/SimpleContentStudio.tsx"
replace_once(
    path,
    "      const imageUrl=composerFile?await upload(composerFile,'content'):composerImage\n      const caption=text.trim()||headline.trim()\n      const visualDesign:VisualDesignMeta={",
    "      const imageUrl=composerFile?await upload(composerFile,'content'):composerImage\n      const caption=text.trim()||headline.trim()\n      const existingPost=editingPostId?posts.find(post=>post.id===editingPostId)||null:null\n      const existingManual=((existingPost?.generation_meta?.manual_fields||{}) as Record<string,unknown>)\n      const visualDesign:VisualDesignMeta={",
)
replace_once(
    path,
    "      const generationMeta={\n        image_url:imageUrl,generation_source:'manual_composer',visual_design:visualDesign,\n        manual_fields:{price:priceText.trim(),badge:badgeText.trim(),template_name:selectedTemplate.name,primary_color:primaryColor,accent_color:accentColor,base_font:baseFont,script_font:scriptFont,font_scale:fontScale},\n      }\n      const payload={\n        menu_item_id:selectedDishId||null,post_type:format,title:headline.trim(),caption,\n        cta:cta.trim()||'Svrati danas',generation_meta:generationMeta,\n        platform_content:{instagram:{caption,hashtags:[]},facebook:{caption,hashtags:[]}},status:'draft' as const,\n      }",
    "      const generationMeta={\n        ...(existingPost?.generation_meta||{}),\n        image_url:imageUrl,generation_source:'manual_composer',visual_design:visualDesign,\n        manual_fields:{...existingManual,price:priceText.trim(),badge:badgeText.trim(),template_name:selectedTemplate.name,primary_color:primaryColor,accent_color:accentColor,base_font:baseFont,script_font:scriptFont,font_scale:fontScale},\n      }\n      const platformContent={\n        instagram:{...(existingPost?.platform_content?.instagram||{}),caption,hashtags:existingPost?.platform_content?.instagram?.hashtags||[]},\n        facebook:{...(existingPost?.platform_content?.facebook||{}),caption,hashtags:existingPost?.platform_content?.facebook?.hashtags||[]},\n      }\n      const payload={\n        menu_item_id:selectedDishId||null,post_type:format,title:headline.trim(),caption,\n        cta:cta.trim()||'Svrati danas',generation_meta:generationMeta,\n        platform_content:platformContent,status:'draft' as const,\n      }",
)

print("Safe post edit metadata patch applied successfully.")
