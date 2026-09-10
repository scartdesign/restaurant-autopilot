import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { DemoCreative } from './components/DemoCreative'
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
import './mobile-final.css'

function CreativePreview() {
  const [message, setMessage] = React.useState('')
  function notify(value: string) {
    setMessage(value)
    window.setTimeout(() => setMessage(''), 2600)
  }
  return <div className="creative-public-preview"><div className="demo-banner creative-preview-banner"><strong>CREATIVE AI · INTERAKTIVNI PREVIEW</strong><span>Izaberi preporuku, menjaj template i probaj AI fotografiju.</span><a href={window.location.pathname}>Nazad na program</a></div><main className="creative-public-main"><DemoCreative notify={notify} /></main>{message && <div className="app-toast">{message}</div>}</div>
}

const creativePreview = new URLSearchParams(window.location.search).get('creative') === 'demo'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {creativePreview ? <CreativePreview /> : <App />}
  </React.StrictMode>,
)
