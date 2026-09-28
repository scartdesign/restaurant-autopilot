from pathlib import Path

# Expand the visible library to all 12 modern restaurant directions while preserving saved template IDs.
p=Path('src/components/SimpleContentStudio.tsx')
s=p.read_text()
old="""const templates:TemplateOption[]=[
  {id:'luxe',name:'Editorial Luxe',category:'Premium',kicker:'CHEF’S PICK',note:'Fotografija preko celog vizuala, elegantan naslov i diskretna cena.',badge:'TOP'},
  {id:'hero-menu',name:'Full Bleed',category:'Modern',kicker:'SIGNATURE',note:'Maksimalan fokus na hranu sa velikom modernom tipografijom.',badge:'TOP'},
  {id:'editorial',name:'Clean Editorial',category:'Editorial',kicker:'TODAY’S SELECTION',note:'Čist magazinski layout sa mnogo vazduha i premium fotografijom.',badge:'TOP'},
  {id:'minimal',name:'Minimal Product',category:'Minimal',kicker:'FRESH TODAY',note:'Moderan svetli layout za jedno jelo bez vizuelnog šuma.'},
  {id:'bold',name:'Bold Campaign',category:'Campaign',kicker:'SPECIAL DROP',note:'Snažan prodajni vizual za akcije, novo jelo i specijalnu ponudu.'},
  {id:'split',name:'Modern Split',category:'Menu',kicker:'TODAY’S SELECTION',note:'Premium podela fotografije i teksta za jelovnik i dnevnu ponudu.'},
]
"""
new="""const templates:TemplateOption[]=[
  {id:'luxe',name:'Noir Signature',category:'Fine Dining',kicker:'CHEF’S SIGNATURE',note:'Tamni premium full-bleed za signature jela, vino, steak i elegantne restorane.',badge:'PREMIUM'},
  {id:'hero-menu',name:'Hero Dish',category:'Best Seller',kicker:'HOUSE FAVORITE',note:'Fotografija vodi ceo vizual. Idealno za najprodavanije jelo i jak prvi utisak.',badge:'TOP'},
  {id:'editorial',name:'Magazine Plate',category:'Editorial',kicker:'TODAY’S SELECTION',note:'Magazinski food layout sa dosta vazduha, za modernu i elegantnu komunikaciju.',badge:'TOP'},
  {id:'minimal',name:'Studio White',category:'Minimal',kicker:'FRESH TODAY',note:'Svetao premium studio izgled za jedno jelo, desert, brunch ili specialty coffee.'},
  {id:'bold',name:'Street Impact',category:'Fast Food',kicker:'NEW DROP',note:'Velika tipografija i snažna fotografija za burger, pizzu, grill i street food.'},
  {id:'split',name:'Chef Split',category:'Daily Special',kicker:'CHEF’S PICK',note:'Jasna podela fotografije i informacije za dnevnu ponudu, preporuku kuće i meni.'},
  {id:'poster',name:'Night Poster',category:'Event',kicker:'TONIGHT',note:'Poster pristup za live music, DJ, tematsko veče, degustaciju i restoranski event.'},
  {id:'promo-badge',name:'Offer Glass',category:'Promo',kicker:'LIMITED OFFER',note:'Fotografija preko celog vizuala sa čistom premium karticom za promo ponudu.'},
  {id:'premium-grid',name:'Menu Select',category:'Menu',kicker:'CURATED MENU',note:'Premium kompozicija za više stavki, selekciju menija ili chef tasting komunikaciju.'},
  {id:'bold-offer',name:'Flash Offer',category:'Discount',kicker:'TODAY ONLY',note:'Prodajni vizual za popust, bundle, happy hour i vremenski ograničenu ponudu.'},
  {id:'lunch-time',name:'Lunch Window',category:'Lunch',kicker:'LUNCH · TODAY',note:'Dizajn napravljen za poslovni ručak, dnevni meni i ponudu sa jasnim terminom.'},
  {id:'family',name:'Warm Table',category:'Traditional',kicker:'AT THE TABLE',note:'Topliji premium pravac za porodične restorane, kafane i tradicionalnu kuhinju.'},
]
"""
if old not in s:
    raise SystemExit('template list block not found')
s=s.replace(old,new,1)
old_default="""function defaultTemplate(restaurant:Restaurant):TemplateId{
  if(restaurant.brand_style==='premium')return 'luxe'
  if(restaurant.brand_style==='fast_food')return 'bold'
  if(restaurant.brand_style==='modern')return 'minimal'
  return 'editorial'
}
"""
new_default="""function defaultTemplate(restaurant:Restaurant):TemplateId{
  if(restaurant.brand_style==='premium')return 'luxe'
  if(restaurant.brand_style==='fast_food')return 'bold'
  if(restaurant.brand_style==='traditional')return 'family'
  if(restaurant.brand_style==='casual')return 'split'
  if(restaurant.brand_style==='modern')return 'hero-menu'
  return 'editorial'
}
"""
if old_default not in s:
    raise SystemExit('defaultTemplate block not found')
s=s.replace(old_default,new_default,1)
p.write_text(s)

# Make the actual artwork copy match each commercial use-case.
p=Path('src/components/RestaurantTemplateCanvas.tsx')
s=p.read_text()
old_eyebrow="""function eyebrowFor(template:RestaurantTemplateId,badge:string){
  if(badge.trim())return badge.trim()
  if(template==='lunch-time')return 'LUNCH · TODAY'
  if(template==='bold'||template==='bold-offer')return 'SPECIAL DROP'
  if(template==='minimal')return 'FRESH · SIMPLE · GOOD'
  if(template==='split'||template==='premium-grid')return 'TODAY’S SELECTION'
  return 'CHEF’S PICK'
}
"""
new_eyebrow="""function eyebrowFor(template:RestaurantTemplateId,badge:string){
  if(badge.trim())return badge.trim()
  const labels:Record<RestaurantTemplateId,string>={
    luxe:'CHEF’S SIGNATURE',
    'hero-menu':'HOUSE FAVORITE',
    editorial:'TODAY’S SELECTION',
    minimal:'FRESH TODAY',
    bold:'NEW DROP',
    split:'CHEF’S PICK',
    poster:'TONIGHT',
    'promo-badge':'LIMITED OFFER',
    'premium-grid':'CURATED MENU',
    'bold-offer':'TODAY ONLY',
    'lunch-time':'LUNCH · TODAY',
    family:'AT THE TABLE',
  }
  return labels[template]
}
"""
if old_eyebrow not in s:
    raise SystemExit('eyebrowFor block not found')
s=s.replace(old_eyebrow,new_eyebrow,1)
p.write_text(s)
print('premium template library upgraded')