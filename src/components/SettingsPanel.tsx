import type { Restaurant } from '../types'
import { SettingsPanel as SettingsPanelCore } from './SettingsPanelCore'
import { RestaurantTrendAutoPreview } from './RestaurantTrendAutoPreview'

export function SettingsPanel({restaurant,onSaved,setNotice}:{
  restaurant:Restaurant
  onSaved:()=>Promise<void>
  setNotice:(value:string)=>void
}){
  return <>
    <SettingsPanelCore restaurant={restaurant} onSaved={onSaved} setNotice={setNotice}/>
    <RestaurantTrendAutoPreview restaurant={restaurant} setNotice={setNotice}/>
  </>
}
