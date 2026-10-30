import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { servidor } from '@/mocks/servidor'
import { reiniciarBanco } from '@/mocks/dados'

// Toda chamada à API nos testes é respondida pelo mock. Chamada sem rota no mock quebra o teste.
beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  servidor.resetHandlers()
  reiniciarBanco()
})
afterAll(() => servidor.close())
