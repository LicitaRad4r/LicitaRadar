import createClient, { type Middleware } from 'openapi-fetch'
import { API_URL } from './config'
import { ApiError, erroDeConexao } from './erros'
import type { paths } from './schema'

type ObterToken = () => Promise<string | null>

let obterToken: ObterToken = async () => null
let renovarToken: () => Promise<void> = async () => {}

/**
 * Define de onde vem o token enviado em `Authorization: Bearer`, e como forçar um token novo.
 * Chamado uma vez no main.tsx com o Firebase Auth; nos testes pode ser trocado.
 */
export function configurarToken(obter: ObterToken, renovar: () => Promise<void> = async () => {}) {
  obterToken = obter
  renovarToken = renovar
}

/**
 * Pede um token novo ao Firebase. Necessário depois do primeiro PUT /v1/perfil,
 * quando o back grava os claims `empresaId` e `role` no usuário.
 */
export function renovarTokenAgora() {
  return renovarToken()
}

const autenticacao: Middleware = {
  async onRequest({ request }) {
    const token = await obterToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onError({ error }) {
    // fetch só lança quando não há resposta (rede fora, CORS, servidor desligado).
    return erroDeConexao(error)
  },
}

/** Cliente HTTP tipado pelo contrato. Prefira os hooks de cada feature a chamar isto direto. */
export const api = createClient<paths>({
  baseUrl: API_URL,
  // Resolve o fetch na hora da chamada, para o mock dos testes conseguir interceptar.
  fetch: (request) => globalThis.fetch(request),
})

api.use(autenticacao)

type Resultado<T> = { data?: T; error?: unknown; response: Response }

/**
 * Devolve `data` ou lança `ApiError`. Assim os hooks do TanStack Query
 * recebem o erro padronizado em `error`.
 */
export async function desembrulhar<T>(chamada: Promise<Resultado<T>>): Promise<T> {
  const { data, error, response } = await chamada
  if (!response.ok) {
    throw new ApiError(response.status, (error ?? undefined) as ConstructorParameters<typeof ApiError>[1])
  }
  return data as T
}
