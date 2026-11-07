import type { FastifyInstance } from 'fastify'
import { ROTA_JOB } from '../auth.js'
import { descreverErro, ErroApi } from '../erros.js'
import type { ResultadoIngestao } from './servico.js'

/**
 * `POST /jobs/ingestao-pncp`: chamada pelo workflow `ingestao-pncp.yml` com `Authorization: Bearer <INGEST_JOB_TOKEN>`.
 * A autenticação (token do job, não o do Firebase) é feita no hook único de `auth.ts`.
 * Rota interna: fica fora do contrato OpenAPI do front.
 */
export function rotasIngestao(app: FastifyInstance, executar: () => Promise<ResultadoIngestao>) {
  app.post(ROTA_JOB, async (req) => {
    try {
      return await executar()
    } catch (e) {
      // Log sem a mensagem do erro (pode trazer caminho de documento); o corpo da resposta também não expõe detalhes.
      req.log.error({ route: ROTA_JOB, status: 502, ...descreverErro(e) }, 'ingestao falhou')
      throw new ErroApi(502, 'ERRO_INTERNO', 'Falha ao consultar o PNCP. Tente novamente mais tarde.')
    }
  })
}
