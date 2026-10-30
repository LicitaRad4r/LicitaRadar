import type { ErroApi } from './tipos'

/** Códigos que o front trata de forma especial. Os do back seguem o schema `Erro` do contrato. */
export type CodigoErro =
  | 'VALIDACAO'
  | 'NAO_AUTENTICADO'
  | 'NAO_ENCONTRADO'
  | 'SEM_CONEXAO'
  | 'ERRO_SERVIDOR'
  | (string & {})

/** Erro padronizado de qualquer chamada à API. É o que os hooks recebem em `error`. */
export class ApiError extends Error {
  readonly status: number
  readonly codigo: CodigoErro
  readonly detalhes: NonNullable<ErroApi['detalhes']>

  constructor(status: number, corpo: Partial<ErroApi> | undefined) {
    const codigo = corpo?.codigo ?? codigoPorStatus(status)
    super(corpo?.mensagem ?? `Erro ${status} ao chamar a API`)
    this.name = 'ApiError'
    this.status = status
    this.codigo = codigo
    this.detalhes = corpo?.detalhes ?? []
  }

  /** Erros 4xx dependem do que foi enviado, então repetir a chamada não resolve. */
  get ehDoCliente() {
    return this.status >= 400 && this.status < 500
  }
}

function codigoPorStatus(status: number): CodigoErro {
  if (status === 0) return 'SEM_CONEXAO'
  if (status === 400 || status === 422) return 'VALIDACAO'
  if (status === 401) return 'NAO_AUTENTICADO'
  if (status === 404) return 'NAO_ENCONTRADO'
  return 'ERRO_SERVIDOR'
}

export function erroDeConexao(causa: unknown) {
  const erro = new ApiError(0, { codigo: 'SEM_CONEXAO' })
  erro.cause = causa
  return erro
}

/** Texto para mostrar ao usuário. Nunca expõe detalhes técnicos. */
export function mensagemAmigavel(erro: unknown): string {
  if (!(erro instanceof ApiError)) {
    return 'Algo deu errado. Tente de novo.'
  }
  switch (erro.codigo) {
    case 'SEM_CONEXAO':
      return 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.'
    case 'NAO_AUTENTICADO':
      return 'Sua sessão expirou. Entre de novo para continuar.'
    case 'NAO_ENCONTRADO':
      return 'Não encontramos o que você procurava. Ele pode ter sido removido.'
    case 'VALIDACAO':
      return erro.detalhes.length > 0
        ? 'Confira os campos destacados.'
        : 'Confira os dados preenchidos e tente de novo.'
    default:
      return erro.status >= 500
        ? 'O servidor teve um problema. Tente de novo em instantes.'
        : 'Algo deu errado. Tente de novo.'
  }
}

/**
 * Converte os `detalhes` de um erro de validação em `{ campo: mensagem }`,
 * no formato que o `setError` do react-hook-form espera.
 */
export function errosPorCampo(erro: unknown): Record<string, string> {
  if (!(erro instanceof ApiError)) return {}
  return Object.fromEntries(erro.detalhes.map((d) => [d.campo, d.mensagem]))
}
