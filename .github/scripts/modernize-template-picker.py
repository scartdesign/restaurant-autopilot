from pathlib import Path

p=Path('src/components/SimpleContentStudio.tsx')
text=p.read_text()
old="""const templates:TemplateOption[]=[
  {id:'luxe',name:'Good Morning',category:'Premium',kicker:\"TODAY'S MENU\",note:'Tamni premium dizajn za večeru i fine dining.',badge:'TOP'},
  {id:'editorial',name:'Today’s Menu Curve',category:'Breakfast',kicker:'GOOD MORNING',note:'Elegantna fotografija sa potpisnim naslovom.',badge:'TOP'},
  {id:'hero-menu',name:'Today’s Menu Circle',category:'Signature',kicker:'GRILLED SPECIAL',note:'Velika fotografija i jedan jak signature naslov.',badge:'TOP'},
  {id:'minimal',name:'Breakfast Special',category:'Modern',kicker:'FRESH TODAY',note:'Čist i moderan layout za novo jelo.'},
  {id:'bold',name:'Today’s Menu Discount',category:'Promo',kicker:'SPECIAL OFFER',note:'Jak discount badge i prodajni CTA.'},
  {id:'poster',name:'Grilled Special',category:'Story',kicker:\"CHEF'S CHOICE\",note:'Poster stil za događaj, story i večernju ponudu.'},
  {id:'split',name:'Breakfast Card',category:'Menu',kicker:\"TODAY'S MENU\",note:'Fotografija + uredna tekst zona za cenu i opis.'},
  {id:'promo-badge',name:'Food Menu Grid',category:'Promo',kicker:'WEEKEND SPECIAL',note:'Veliki promo krug i premium food fotografija.'},
  {id:'premium-grid',name:'Diagonal Today’s Menu',category:'Menu',kicker:'FOOD MENU',note:'Meni kartica za više ponuda i setove.'},
  {id:'bold-offer',name:'Pizza Special',category:'Campaign',kicker:'LIMITED OFFER',note:'Velika tipografija za akcije i popuste.'},
  {id:'lunch-time',name:'Annual Mega Sale',category:'Lunch',kicker:'LUNCH TIME',note:'Dnevni meni i poslovni ručak.'},
  {id:'family',name:'Today’s Special Menu',category:'Restaurant',kicker:'TODAY SPECIAL',note:'Topao layout za porodični restoran i zajednički sto.'},
]"""
new="""const templates:TemplateOption[]=[
  {id:'luxe',name:'Editorial Luxe',category:'Premium',kicker:'CHEF’S PICK',note:'Fotografija preko celog vizuala, elegantan naslov i diskretna cena.',badge:'TOP'},
  {id:'hero-menu',name:'Full Bleed',category:'Modern',kicker:'SIGNATURE',note:'Maksimalan fokus na hranu sa velikom modernom tipografijom.',badge:'TOP'},
  {id:'editorial',name:'Clean Editorial',category:'Editorial',kicker:'TODAY’S SELECTION',note:'Čist magazinski layout sa mnogo vazduha i premium fotografijom.',badge:'TOP'},
  {id:'minimal',name:'Minimal Product',category:'Minimal',kicker:'FRESH TODAY',note:'Moderan svetli layout za jedno jelo bez vizuelnog šuma.'},
  {id:'bold',name:'Bold Campaign',category:'Campaign',kicker:'SPECIAL DROP',note:'Snažan prodajni vizual za akcije, novo jelo i specijalnu ponudu.'},
  {id:'split',name:'Modern Split',category:'Menu',kicker:'TODAY’S SELECTION',note:'Premium podela fotografije i teksta za jelovnik i dnevnu ponudu.'},
]"""
if old not in text:
    raise SystemExit('template list marker not found')
p.write_text(text.replace(old,new,1))
print('Modern template picker applied')
