import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'cesium/Build/Cesium/Widgets/widgets.css'

document.documentElement.style.margin = '0'
document.documentElement.style.width = '100%'
document.documentElement.style.height = '100%'

document.body.style.margin = '0'
document.body.style.width = '100%'
document.body.style.height = '100%'
document.body.style.overflow = 'hidden'

const rootEl = document.getElementById('root')
rootEl.style.width = '100%'
rootEl.style.height = '100%'

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)