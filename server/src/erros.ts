import type { FastifyError, FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

export type CodigoErro = 'VALIDACAO' | 'NAO_AUTENTICADO' | 'EMPRESA_NAO_CONFIGURADA' | 'NAO_ENCONTRADO' | 'ACESSO_NEGADO' | 'ERRO_INTERNO'

export interface DetalheErro {
  campo: string
  mensagem: string
}

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: CodigoErro,
    mensagem: string,
    readonly detalhes?: DetalheErro[],
  ) {
    super(mensagem)
  }
}

export const naoAutenticado = (mensagem = 'Token ausente ou inválido.') =>
  new ErroApi(401, 'NAO_AUTENTICADO', mensagem)
export const semEmpresa = () =>
  new ErroApi(403, 'EMPRESA_NAO_CONFIGURADA', 'Configure o perfil da empresa antes de usar esta rota.')
export const acessoNegado = (mensagem = 'Acesso negado.') => new ErroApi(403, 'ACESSO_NEGADO', mensagem)
export const naoEncontrado = (mensagem = 'Recurso não encontrado.') =>
  new ErroApi(404, 'NAO_ENCONTRADO', mensagem)

export function erroDeZod(e: ZodError): ErroApi {
  const detalhes = e.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message }))
  return new ErroApi(400, 'VALIDACAO', 'Dados inválidos.', detalhes)
}

/** Registra o tratamento de erros no formato `Erro` do contrato OpenAPI. */
export function registrarErros(app: FastifyInstance) {
  app.setNotFoundHandler((_req, reply) => {
    const e = naoEncontrado('Rota não encontrada.')
    reply.status(e.status).send({ codigo: e.codigo, mensagem: e.message })
  })

  app.setErrorHandler((erro: FastifyError | ErroApi | ZodError, req, reply) => {
    const e = erro instanceof ZodError ? erroDeZod(erro) : erro
    if (e instanceof ErroApi) {
      if (e.status === 401 || e.status === 403) {
        // Bloqueios: só requestId, rota e status. Nada do recurso nem do usuário.
        req.log.warn({ requestId: req.id, route: req.routeOptions.url, status: e.status }, 'acesso bloqueado')
      }
      return reply.status(e.status).send({ codigo: e.codigo, mensagem: e.message, detalhes: e.detalhes })
    }
    // JSON malformado e afins: o Fastify já marca como 4xx.
    if ('statusCode' in e && e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.status(400).send({ codigo: 'VALIDACAO', mensagem: 'Requisição inválida.' })
    }
    // Sem dados pessoais no log: só a mensagem e o id da requisição.
    req.log.error({ msg: e.message }, 'erro inesperado')
    return reply.status(500).send({ codigo: 'ERRO_INTERNO', mensagem: 'Erro interno.' })
  })
}
