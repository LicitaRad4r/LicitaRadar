import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { contextoDe, exigirMesmaEmpresa } from '../auth.js'
import { diaBrasilia } from '../dominio/tempo.js'
import { erroDeZod, naoEncontrado } from '../erros.js'
import { aplicarTransicao, ETAPAS, novoAcompanhamento, paraResposta, RESULTADOS, validarRemocao } from './modelo.js'
import type { DependenciasAcompanhamento } from './repositorio.js'

const IdEdital = z.string().min(1).max(200).regex(/^[^/]+$/, 'Id de edital inválido.')
const CorpoCriar = z.strictObject({ editalId: IdEdital })
const CorpoMudar = z
  .strictObject({ etapa: z.enum(ETAPAS), resultado: z.enum(RESULTADOS).optional() })
  .superRefine((c, ctx) => {
    if (c.etapa === 'resultado' && !c.resultado) {
      ctx.addIssue({ code: 'custom', path: ['resultado'], message: 'Informe o resultado: venceu ou nao_venceu.' })
    }
    if (c.etapa !== 'resultado' && c.resultado) {
      ctx.addIssue({ code: 'custom', path: ['resultado'], message: 'O resultado só vale na etapa resultado.' })
    }
  })
const ConsultaListar = z.object({
  etapa: z.enum(ETAPAS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Meia-noite de hoje em Brasília, em ms (Brasília não tem horário de verão desde 2019: UTC-3 fixo). */
export const inicioDoDiaBrasilia = (agora: Date): number => new Date(`${diaBrasilia(agora)}T00:00:00-03:00`).getTime()

/** Kanban de acompanhamento de editais (US20). Qualquer papel da empresa pode usar. */
export function rotasAcompanhamentos(app: FastifyInstance, deps: DependenciasAcompanhamento, agora: () => Date) {
  const { repo, editais } = deps

  app.post('/acompanhamentos', async (req, reply) => {
    const { empresaId } = contextoDe(req)
    const corpo = CorpoCriar.safeParse(req.body)
    if (!corpo.success) throw erroDeZod(corpo.error)
    const edital = await editais.obter(corpo.data.editalId)
    if (!edital) throw naoEncontrado('Edital não encontrado.')
    const hora = agora()
    const { registro, criado } = await repo.criar(novoAcompanhamento(empresaId, edital, hora))
    // 201 quando cria; 200 com o que já existia quando o edital já estava sendo acompanhado.
    return reply.status(criado ? 201 : 200).send(paraResposta(registro, hora))
  })

  app.get('/acompanhamentos', async (req) => {
    const { empresaId } = contextoDe(req)
    const consulta = ConsultaListar.safeParse(req.query)
    if (!consulta.success) throw erroDeZod(consulta.error)
    const { etapa, page, pageSize } = consulta.data
    const hora = agora()
    const { itens, total } = await repo.listarPagina({
      empresaId,
      etapa,
      hojeInicioMs: inicioDoDiaBrasilia(hora),
      offset: (page - 1) * pageSize,
      limit: pageSize,
    })
    return { itens: itens.map((r) => paraResposta(r, hora)), page, pageSize, total }
  })

  app.patch<{ Params: { acompanhamentoId: string } }>('/acompanhamentos/:acompanhamentoId', async (req) => {
    contextoDe(req)
    const corpo = CorpoMudar.safeParse(req.body)
    if (!corpo.success) throw erroDeZod(corpo.error)
    const hora = agora()
    // Dono e regra de transição dentro da gravação atômica: de outra empresa é 403 e nada muda; transição inválida é 422.
    const novo = await repo.atualizar(req.params.acompanhamentoId, (atual) => {
      exigirMesmaEmpresa(req, atual.empresaId)
      return aplicarTransicao(atual, corpo.data, hora)
    })
    if (!novo) throw naoEncontrado('Acompanhamento não encontrado.')
    return paraResposta(novo, hora)
  })

  app.delete<{ Params: { acompanhamentoId: string } }>('/acompanhamentos/:acompanhamentoId', async (req, reply) => {
    contextoDe(req)
    const existia = await repo.remover(req.params.acompanhamentoId, (atual) => {
      exigirMesmaEmpresa(req, atual.empresaId)
      validarRemocao(atual)
    })
    if (!existia) throw naoEncontrado('Acompanhamento não encontrado.')
    return reply.status(204).send()
  })
}
