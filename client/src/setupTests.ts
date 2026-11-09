import '@testing-library/jest-dom/vitest'
import './testes/formDataCompativel'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { servidor } from '@/mocks/servidor'
import { reiniciarBanco } from '@/mocks/dados'
import { criarSessaoMock } from '@/mocks/sessao'
import { configurarSessao, sessao } from '@/lib/sessao'
import { configurarToken } from '@/services/http'

// No CI o jsdom às vezes passa de 1s até a lista aparecer. A espera maior não muda a tela.
configure({ asyncUtilTimeout: 3_000 })

// Toda chamada à API nos testes é respondida pelo mock. Chamada sem rota no mock quebra o teste.
beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
// Cada teste começa com o decisor da empresa A logado (sessão simulada, sem Firebase).
beforeEach(() => {
  configurarSessao(criarSessaoMock())
  configurarToken(sessao.token, sessao.renovar)
})
afterEach(() => {
  cleanup()
  servidor.resetHandlers()
  reiniciarBanco()
})
afterAll(() => servidor.close())
