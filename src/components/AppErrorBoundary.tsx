import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type State={error:Error|null}
export class AppErrorBoundary extends React.Component<React.PropsWithChildren,State>{
  state:State={error:null}
  static getDerivedStateFromError(error:Error){return{error}}
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error('Restaurant Autopilot UI crash',error,info)}
  render(){
    if(!this.state.error)return this.props.children
    return <div className="fatal-error-screen"><div className="fatal-error-card"><AlertTriangle size={34}/><p className="eyebrow">RESTAURANT AUTOPILOT</p><h1>Nešto je zapelo u interfejsu.</h1><p>Tvoji podaci nisu obrisani. Osveži aplikaciju i nastavi od poslednjeg sačuvanog koraka.</p><button className="primary" onClick={()=>window.location.reload()}><RefreshCw size={16}/> Osveži aplikaciju</button><button className="secondary" onClick={()=>{this.setState({error:null});window.history.replaceState({},'',window.location.pathname)}}>Vrati početni ekran</button></div></div>
  }
}
