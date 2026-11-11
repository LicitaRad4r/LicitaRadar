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

/**
 * Descreve um erro para o log SEM a mensagem: erros do Firestore trazem caminho de documento e ids
 * (`projects/.../certidoes/cert-a-1`). Mantém o tipo, o código (ou status) e só as linhas "at ..." da pilha,
 * o bastante para achar o ponto da falha sem expor dados.
 */
export function descreverErro(e: unknown): { erro: string; codigo?: string | number; pilha: string[] } {
  const erro = e instanceof Error ? e : new Error('valor lançado não é um Error')
  const { code, status } = erro as { code?: unknown; status?: unknown }
  const codigo = [code, status].find((v): v is string | number => typeof v === 'string' || typeof v === 'number')
  const pilha = (erro.stack ?? '')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.startsWith('at '))
    .slice(0, 8)
  return { erro: erro.name, ...(codigo === undefined ? {} : { codigo }), pilha }
}

/** Registra o tratamento de erros no formato `Erro` do contrato OpenAPI. */
export function registrarErros(app: FastifyInstance) {
  app.setNotFoundHandler((req, reply) => {
    const e = naoEncontrado('Rota não encontrada.')
    reply.status(e.status).send({ codigo: e.codigo, mensagem: e.message, requestId: req.id })
  })

  app.setErrorHandler((erro: FastifyError | ErroApi | ZodError, req, reply) => {
    const e = erro instanceof ZodError ? erroDeZod(erro) : erro
    if (e instanceof ErroApi) {
      if (e.status === 401 || e.status === 403) {
        // Bloqueios: só requestId, rota e status. Nada do recurso nem do usuário.
        req.log.warn({ route: req.routeOptions.url, status: e.status }, 'acesso bloqueado')
      }
      return reply.status(e.status).send({ codigo: e.codigo, mensagem: e.message, requestId: req.id, detalhes: e.detalhes })
    }
    // JSON malformado, corpo grande demais (413), tipo de conteúdo não aceito (415) e afins: o Fastify marca como 4xx.
    // O contrato só documenta `400` (inclusive para arquivo grande demais, "sem 413"), então todos saem como VALIDACAO 400.
    if ('statusCode' in e && e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.status(400).send({ codigo: 'VALIDACAO', mensagem: 'Requisição inválida.', requestId: req.id })
    }
    // Sem dados no log: nada de e.message (pode trazer caminho de documento). Vão só rota, status, tipo, código e pilha.
    req.log.error({ route: req.routeOptions.url, status: 500, ...descreverErro(e) }, 'erro inesperado')
    return reply.status(500).send({ codigo: 'ERRO_INTERNO', mensagem: 'Erro interno.', requestId: req.id })
  })
}
