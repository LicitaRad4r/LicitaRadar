import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { configurarToken } from '@/services/http'
import { API_MOCK } from '@/services/config'
import { Provedores } from '@/components/Provedores'
import { configurarSessao, sessao } from '@/lib/sessao'

async function iniciar() {
  if (API_MOCK) {
    // Carregados só quando o mock está ligado, para não irem no build de produção.
    const [{ worker }, { criarSessaoMock }] = await Promise.all([import('./mocks/browser'), import('./mocks/sessao')])
    await worker.start({ onUnhandledFrame: 'bypass' })
    configurarSessao(criarSessaoMock())
  } else {
    const { sessaoFirebase } = await import('@/lib/firebase')
    configurarSessao(sessaoFirebase)
  }
  configurarToken(sessao.token, sessao.renovar)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provedores>
        <App />
      </Provedores>
    </StrictMode>,
  )
}

void iniciar()
