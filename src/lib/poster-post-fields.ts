import type { MenuItem, Post } from '../types'

/** Resolve old slot metadata and Autopilot visual copy without changing the saved record. */
export function posterPostFields(post:Post,menuItems:MenuItem[]=[]){
 const design=post.generation_meta?.visual_design,slots=design?.text_slots||{}
 const manual=(post.generation_meta?.manual_fields||{}) as Record<string,unknown>
 const item=menuItems.find(item=>item.id===post.menu_item_id)
 return {
  headline:slots.overlayTitle||design?.headline||post.title||'Objava',
  description:slots.smallDesc||slots.whiteCardText||slots.footerText||design?.subline||post.caption||'',
  cta:slots.smallCta||slots.buttonText||design?.cta||post.cta||'Svrati danas',
  price:typeof manual.price==='string'?manual.price:design?.item_slots?.[0]?.price||(item?.price!==null&&item?.price!==undefined?`${item.price} ${item.currency||'RSD'}`:''),
  badge:typeof manual.badge==='string'?manual.badge:slots.kicker||'',
 }
}
