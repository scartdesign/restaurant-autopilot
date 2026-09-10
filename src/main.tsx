import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DemoCreative } from './components/DemoCreative'
import { DemoOwner } from './components/DemoOwner'
import './styles.css'
import './premium.css'
import './final.css'
import './studio.css'
import './extras.css'
import './publish.css'
import './campaign.css'
import './wow.css'
import './design-cards.css'
import './brand-controls.css'
import './brand-kit.css'
import './onboarding-brand.css'
import './schedule-demo.css'
import './sales.css'
import './sales-v2.css'
import './account.css'
import './creative-hub.css'
import './menu-ai.css'
import './ai-provider.css'
import './demo-creative.css'
import './owner-control.css'
import './demo-owner.css'
import './app-control-ui.css'
import './mobile-final.css'
import './release-polish.css'
import './commerce-release.css'
import './email-admin.css'

function PreviewShell({kind}:{kind:'creative'|'owner'}) {
  const [message, setMessage] = React.useState('')
  function notify(value: string) {
    setMessage(value)
    window.setTimeout(() => setMessage(''), 2600)
  }
  return <div className="creative-public-preview"><div className="demo-banner creative-preview-banner"><strong>{kind==='owner'?'OWNER CONTROL · INTERAKTIVNI PREVIEW':'CREATIVE AI · INTERAKTIVNI PREVIEW'}</strong><span>{kind==='owner'?'Kupci, licence, paketi, prodaja, AI i sistemska kontrola.':'Izaberi preporuku, menjaj template i probaj AI fotografiju.'}</span><a href={window.location.pathname}>Nazad na program</a></div><main className={kind==='owner'?'':'creative-public-main'}>{kind==='owner'?<DemoOwner notify={notify}/>:<DemoCreative notify={notify}/>}</main>{message && <div className="app-toast">{message}</div>}</div>
}

const params = new URLSearchParams(window.location.search)
const creativePreview = params.get('creative') === 'demo'
const ownerPreview = params.get('owner') === 'demo'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {ownerPreview ? <PreviewShell kind="owner"/> : creativePreview ? <PreviewShell kind="creative"/> : <App />}
  </React.StrictMode>,
)
