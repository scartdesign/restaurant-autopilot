import { Clock3 } from 'lucide-react'

export type DayKey='mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'
export type DayHours={enabled:boolean;open:string;close:string}
export type OpeningHours=Record<DayKey,DayHours>

const days:[DayKey,string][]=[
  ['mon','Ponedeljak'],['tue','Utorak'],['wed','Sreda'],['thu','Četvrtak'],
  ['fri','Petak'],['sat','Subota'],['sun','Nedelja'],
]

export function defaultOpeningHours():OpeningHours{
  return {
    mon:{enabled:true,open:'09:00',close:'23:00'},
    tue:{enabled:true,open:'09:00',close:'23:00'},
    wed:{enabled:true,open:'09:00',close:'23:00'},
    thu:{enabled:true,open:'09:00',close:'23:00'},
    fri:{enabled:true,open:'09:00',close:'23:59'},
    sat:{enabled:true,open:'09:00',close:'23:59'},
    sun:{enabled:true,open:'09:00',close:'23:00'},
  }
}

export function normalizeOpeningHours(input:unknown):OpeningHours{
  const base=defaultOpeningHours()
  if(!input||typeof input!=='object')return base
  const source=input as Record<string,unknown>
  for(const [key] of days){
    const raw=source[key]
    if(raw&&typeof raw==='object'){
      const row=raw as Record<string,unknown>
      base[key]={
        enabled:typeof row.enabled==='boolean'?row.enabled:true,
        open:validTime(row.open)?String(row.open):'09:00',
        close:validTime(row.close)?String(row.close):'23:00',
      }
    }
  }
  return base
}

export function OpeningHoursEditor({value,onChange}:{value:OpeningHours;onChange:(next:OpeningHours)=>void}){
  function patch(day:DayKey,update:Partial<DayHours>){onChange({...value,[day]:{...value[day],...update}})}
  return <div className="opening-hours-editor">
    <div className="opening-hours-head"><Clock3 size={17}/><div><strong>Radno vreme</strong><span>Autopilot koristi ovo da ne predlaže dolazak kada je restoran zatvoren.</span></div></div>
    <div className="opening-hours-grid">{days.map(([key,label])=>{const row=value[key];return <div className={'opening-row '+(!row.enabled?'closed':'')} key={key}>
      <button type="button" className={row.enabled?'day-toggle active':'day-toggle'} onClick={()=>patch(key,{enabled:!row.enabled})}><span>{label.slice(0,3)}</span><small>{row.enabled?'radi':'zatvoreno'}</small></button>
      <strong>{label}</strong>
      {row.enabled?<><label>od<input type="time" step="900" value={row.open} onChange={e=>patch(key,{open:e.target.value})}/></label><label>do<input type="time" step="900" value={row.close} onChange={e=>patch(key,{close:e.target.value})}/></label></>:<span className="closed-label">Restoran ne radi</span>}
    </div>})}</div>
  </div>
}
function validTime(v:unknown){return typeof v==='string'&&/^\d{2}:\d{2}$/.test(v)}
