import createClient, { type Middleware } from 'openapi-fetch'
import { API_URL } from './config'
import { ApiError, erroDeConexao } from './erros'
import type { paths } from './schema'

type ObterToken = () => Promise<string | null>

let obterToken: ObterToken = async () => null
let renovarToken: () => Promise<void> = async () => {}

/**
 * Define de onde vem o token enviado em `Authorization: Bearer`, e como forçar um token novo.
 * Chamado uma vez no main.tsx com a sessão (Firebase Auth ou simulada); nos testes pode ser trocado.
 */
export function configurarToken(obter: ObterToken, renovar: () => Promise<void> = async () => {}) {
  obterToken = obter
  renovarToken = renovar
}

/**
 * Pede um token novo à sessão. Necessário depois do primeiro PUT /v1/perfil,
 * quando o back grava os claims `empresaId` e `role` no usuário.
 */
export function renovarTokenAgora() {
  return renovarToken()
}

/** Erros de acesso tratados num lugar só, para a aplicação inteira (Jornada 4). */
export type ErroDeAcesso = 'NAO_AUTENTICADO' | 'ACESSO_NEGADO'

const ouvintesDeAcesso = new Set<(erro: ErroDeAcesso) => void>()

/**
 * Avisa sobre todo 401 e todo 403 de acesso negado que voltar da API, venha de qual tela vier.
 * Quem decide o que fazer (ir para o login, abrir "Acesso Negado") é o `TratamentoDeAcesso`, nas rotas.
 */
export function aoErroDeAcesso(ouvinte: (erro: ErroDeAcesso) => void) {
  ouvintesDeAcesso.add(ouvinte)
  return () => {
    ouvintesDeAcesso.delete(ouvinte)
  }
}

const avisarAcesso = (erro: ErroDeAcesso) => ouvintesDeAcesso.forEach((ouvinte) => ouvinte(erro))

const tratamentoCentral: Middleware = {
  async onResponse({ response }) {
    if (response.status === 401) avisarAcesso('NAO_AUTENTICADO')
    if (response.status === 403) {
      // 403 também pode ser EMPRESA_NAO_CONFIGURADA, que não é falta de permissão: lê o código para separar.
      const corpo = (await response
        .clone()
        .json()
        .catch(() => null)) as { codigo?: string } | null
      if (corpo?.codigo === 'ACESSO_NEGADO') avisarAcesso('ACESSO_NEGADO')
    }
    return undefined
  },
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

api.use(autenticacao, tratamentoCentral)

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
