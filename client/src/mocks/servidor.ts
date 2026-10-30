import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Mock da API para os testes do Vitest (roda no Node, sem navegador). */
export const servidor = setupServer(...handlers)
