from pathlib import Path

p=Path('src/components/DemoScreen.tsx')
text=p.read_text()
old="""const demoContentTemplates:DemoContentTemplate[]=[
  {id:'luxe',name:'Good Morning',category:'Premium',kicker:\"TODAY'S MENU\",note:'Tamni premium dizajn.',badge:'TOP'},
  {id:'editorial',name:'Today’s Menu Curve',category:'Breakfast',kicker:'GOOD MORNING',note:'Elegantni food layout.',badge:'TOP'},
  {id:'hero-menu',name:'Today’s Menu Circle',category:'Signature',kicker:'GRILLED SPECIAL',note:'Jedno jelo u prvom planu.',badge:'TOP'},
  {id:'minimal',name:'Breakfast Special',category:'Modern',kicker:'FRESH TODAY',note:'Čisto i moderno.'},
  {id:'bold',name:'Today’s Menu Discount',category:'Promo',kicker:'SPECIAL OFFER',note:'Jak promo layout.'},
  {id:'poster',name:'Grilled Special',category:'Story',kicker:\"CHEF'S CHOICE\",note:'Poster za story i event.'},
  {id:'split',name:'Breakfast Card',category:'Menu',kicker:\"TODAY'S MENU\",note:'Slika + tekst zona.'},
  {id:'promo-badge',name:'Food Menu Grid',category:'Promo',kicker:'WEEKEND SPECIAL',note:'Veliki promo badge.'},
  {id:'premium-grid',name:'Diagonal Today’s Menu',category:'Menu',kicker:'FOOD MENU',note:'Setovi i tasting meni.'},
  {id:'bold-offer',name:'Pizza Special',category:'Campaign',kicker:'LIMITED OFFER',note:'Velika tipografija.'},
  {id:'lunch-time',name:'Annual Mega Sale',category:'Lunch',kicker:'LUNCH TIME',note:'Dnevni meni i ručak.'},
  {id:'family',name:'Today’s Special Menu',category:'Restaurant',kicker:'TODAY SPECIAL',note:'Topao restoran layout.'},
] as const"""
new="""const demoContentTemplates:DemoContentTemplate[]=[
  {id:'luxe',name:'Editorial Luxe',category:'Premium',kicker:'CHEF’S PICK',note:'Fotografija vodi dizajn, tekst ostaje elegantan i čist.',badge:'TOP'},
  {id:'hero-menu',name:'Full Bleed',category:'Modern',kicker:'SIGNATURE',note:'Velika food fotografija i snažna moderna tipografija.',badge:'TOP'},
  {id:'editorial',name:'Clean Editorial',category:'Editorial',kicker:'TODAY’S SELECTION',note:'Magazinski premium layout sa mnogo vazduha.',badge:'TOP'},
  {id:'minimal',name:'Minimal Product',category:'Minimal',kicker:'FRESH TODAY',note:'Čist svetli layout bez vizuelnog šuma.'},
  {id:'bold',name:'Bold Campaign',category:'Campaign',kicker:'SPECIAL DROP',note:'Prodajni vizual sa velikim naslovom i jakom fotografijom.'},
  {id:'split',name:'Modern Split',category:'Menu',kicker:'TODAY’S SELECTION',note:'Fotografija i tekst u modernoj premium podeli.'},
] as const"""
if old not in text:
    raise SystemExit('demo template list marker not found')
p.write_text(text.replace(old,new,1))
print('Demo premium template picker applied')
