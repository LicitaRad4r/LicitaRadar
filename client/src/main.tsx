import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { configurarToken } from '@/api/client'
import { API_MOCK } from '@/api/config'
import { Provedores } from '@/components/Provedores'
import { obterTokenFirebase } from '@/lib/firebase'

async function iniciar() {
  configurarToken(obterTokenFirebase)

  if (API_MOCK) {
    // Carregado só quando o mock está ligado, para não ir no build de produção.
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledFrame: 'bypass' })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provedores>
        <App />
      </Provedores>
    </StrictMode>,
  )
}

void iniciar()
