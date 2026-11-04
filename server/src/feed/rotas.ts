import type { FastifyInstance } from 'fastify'
import { empresaDe } from '../auth.js'
import { erroDeZod } from '../erros.js'
import { ConsultaFeed } from './consulta.js'
import type { FeedRepo } from './repositorio.js'
import { montarFeed } from './servico.js'

export function rotasFeed(app: FastifyInstance, repo: FeedRepo) {
  app.get('/feed', async (req) => {
    const empresaId = empresaDe(req)
    const consulta = ConsultaFeed.safeParse(req.query)
    if (!consulta.success) throw erroDeZod(consulta.error)
    return montarFeed(repo, empresaId, consulta.data)
  })
}
