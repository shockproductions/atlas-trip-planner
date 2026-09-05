import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/AppShell'
import { initNativeShell } from './platform/native'
import './styles/theme.css'
import './styles/app.css'

void initNativeShell()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
