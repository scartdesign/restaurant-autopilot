export const commonTimeZones = [
  'Europe/Belgrade','Europe/Sarajevo','Europe/Podgorica','Europe/Skopje','Europe/Zagreb',
  'Europe/Ljubljana','Europe/Sofia','Europe/Vienna','Europe/Berlin','Europe/Rome','Europe/Paris',
  'Europe/London','Europe/Athens','Europe/Bucharest','Europe/Istanbul',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'Asia/Dubai','Asia/Tokyo','Australia/Sydney'
]

export function isValidTimeZone(value:string){
  const zone=value.trim()
  if(!zone)return false
  try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(new Date());return true}catch{return false}
}

export function browserTimeZone(){
  try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Belgrade'}catch{return'Europe/Belgrade'}
}
