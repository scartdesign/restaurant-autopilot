import type { Entitlement, MenuItem, Post, Restaurant } from '../types'
import { Dashboard as DashboardCore } from './DashboardCore'
import { TrendExplainPanel } from './TrendExplainPanel'

export function Dashboard(props:{
  restaurant:Restaurant
  menuItems:MenuItem[]
  posts:Post[]
  entitlement?:Entitlement|null
  onChanged:()=>Promise<void>
  setNotice:(value:string)=>void
  onNavigate?:(tab:'menu'|'publish'|'settings'|'billing')=>void
}){
  return <>
    <DashboardCore {...props}/>
    <TrendExplainPanel restaurant={props.restaurant} setNotice={props.setNotice}/>
  </>
}
