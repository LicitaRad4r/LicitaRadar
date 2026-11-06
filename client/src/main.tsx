import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { configurarToken } from '@/services/http'
import { API_MOCK } from '@/services/config'
import { Provedores } from '@/components/Provedores'
import { configurarSessao, sessao } from '@/lib/sessao'
import { ErroDeConfiguracao } from '@/lib/configFirebase'
import { PaginaSemConfiguracao } from '@/features/acesso/PaginaSemConfiguracao'

function desenhar(conteudo: ReactNode) {
  createRoot(document.getElementById('root')!).render(<StrictMode>{conteudo}</StrictMode>)
}

async function iniciar() {
  if (API_MOCK) {
    // Carregados só quando o mock está ligado, para não irem no build de produção.
    const [{ worker }, { criarSessaoMock }] = await Promise.all([import('./mocks/browser'), import('./mocks/sessao')])
    await worker.start({ onUnhandledFrame: 'bypass' })
    configurarSessao(criarSessaoMock())
  } else {
    try {
      const { sessaoFirebase } = await import('@/lib/firebase')
      configurarSessao(sessaoFirebase)
    } catch (erro) {
      if (!(erro instanceof ErroDeConfiguracao)) throw erro
      desenhar(<PaginaSemConfiguracao faltando={erro.faltando} />)
      return
    }
  }
  configurarToken(sessao.token, sessao.renovar)

  desenhar(
    <Provedores>
      <App />
    </Provedores>,
  )
}

void iniciar()
