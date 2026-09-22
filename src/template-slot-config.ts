import type { RestaurantTemplateId } from './components/RestaurantTemplateCanvas'

export type TemplateTextSlotDef={
  key:string
  label:string
  defaultValue:string
  multiline?:boolean
  maxLength?:number
}

export type TemplateItemSlot={
  title:string
  price:string
}

export type TemplateSlotConfig={
  textSlots:TemplateTextSlotDef[]
  itemSlots?:TemplateItemSlot[]
}

export const templateSlotConfig:Record<RestaurantTemplateId,TemplateSlotConfig>={
  luxe:{
    textSlots:[
      {key:'scriptTop',label:'Script naslov',defaultValue:'Good Morning',maxLength:24},
      {key:'smallDesc',label:'Mali opis',defaultValue:'Your morning breakfast is ready',multiline:true},
      {key:'buttonText',label:'Tekst dugmeta',defaultValue:'BUY'},
    ],
  },
  editorial:{
    textSlots:[
      {key:'scriptTop',label:'Gornji script tekst',defaultValue:'Today’s\nMenu',maxLength:24},
      {key:'overlayTitle',label:'Naziv preko slike',defaultValue:'Pizza Capricciosa'},
      {key:'smallDesc',label:'Mali opis',defaultValue:'Pelat, mozzarella, šunka i pečurke.',multiline:true},
    ],
  },
  'hero-menu':{
    textSlots:[
      {key:'scriptRight',label:'Desni script tekst',defaultValue:'Today’s\nMenu',maxLength:24},
      {key:'smallDesc',label:'Opis',defaultValue:'Pelat, mozzarella, šunka i pečurke.',multiline:true},
      {key:'smallCta',label:'Mali CTA',defaultValue:'Rezerviši sto'},
    ],
  },
  minimal:{
    textSlots:[
      {key:'verticalText',label:'Vertikalni tekst',defaultValue:'SPECIAL DISCOUNT',maxLength:22},
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'Breakfast',maxLength:24},
      {key:'smallDesc',label:'Opis',defaultValue:'Pelat, mozzarella, šunka i pečurke.',multiline:true},
      {key:'smallCta',label:'Mali CTA',defaultValue:'Rezerviši sto'},
    ],
  },
  bold:{
    textSlots:[
      {key:'hugeOffer',label:'Veliki gornji tekst',defaultValue:'70% OFF',maxLength:16},
      {key:'scriptBottom',label:'Donji script tekst',defaultValue:'Today’s Menu',maxLength:24},
      {key:'smallDesc',label:'Mali opis',defaultValue:'Lorem ipsum dolor sit amet.',multiline:true},
    ],
  },
  poster:{
    textSlots:[
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'Grilled steak',maxLength:28},
      {key:'smallDesc',label:'Opis',defaultValue:'Pelat, mozzarella, šunka i pečurke.',multiline:true},
    ],
  },
  split:{
    textSlots:[
      {key:'topLabel',label:'Gornja labela',defaultValue:'Breakfast',maxLength:18},
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'Get Delicious\nWith us',maxLength:28},
      {key:'whiteCardText',label:'Tekst bele kartice',defaultValue:'A classic waffle recipe includes basic ingredients you probably already have on hand.',multiline:true},
    ],
  },
  'promo-badge':{
    textSlots:[
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'Breakfast'},
      {key:'footerText',label:'Donji tekst',defaultValue:'your text here your text here your text',multiline:true},
    ],
    itemSlots:[
      {title:'Food Name',price:'$7'},
      {title:'Food Name',price:'$7'},
      {title:'Food Name',price:'$7'},
    ],
  },
  'premium-grid':{
    textSlots:[
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'Today’s\nMenu',maxLength:24},
      {key:'smallDesc',label:'Opis',defaultValue:'Lorem ipsum dolor sit amet.',multiline:true},
      {key:'smallCta',label:'Mali CTA',defaultValue:'BUY'},
    ],
  },
  'bold-offer':{
    textSlots:[
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'Today’s\nMenu'},
      {key:'smallDesc',label:'Opis',defaultValue:'Lorem ipsum dolor sit amet.',multiline:true},
    ],
  },
  'lunch-time':{
    textSlots:[
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'ANNUAL MEGA\nSALE',maxLength:26},
      {key:'smallDesc',label:'Opis',defaultValue:'ENJOY UP TO 50% OFF WHEN YOU SHOP. LIMITED TIME!',multiline:true},
    ],
  },
  family:{
    textSlots:[
      {key:'scriptMain',label:'Glavni script tekst',defaultValue:'Today’s\nSpecial menu',maxLength:28},
      {key:'smallDesc',label:'Opis',defaultValue:'Lorem ipsum dolor sit amet.',multiline:true},
      {key:'smallCta',label:'Mali CTA',defaultValue:'BUY'},
    ],
  },
}

export function defaultTextSlots(template:RestaurantTemplateId){
  return Object.fromEntries(templateSlotConfig[template].textSlots.map(slot=>[slot.key,slot.defaultValue])) as Record<string,string>
}

export function defaultItemSlots(template:RestaurantTemplateId){
  return (templateSlotConfig[template].itemSlots||[]).map(item=>({...item}))
}
