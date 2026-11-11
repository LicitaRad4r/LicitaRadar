import { buildApp } from './app.js'
import { definirClaimsFirebase, perfilRepoFirestore, verificarTokenFirebase } from './infra/firebase.js'
import { armazenamentoLocal } from './infra/armazenamento-local.js'
import { certidaoRepoFirestore } from './infra/firestore-certidoes.js'
import { feedRepoFirestore } from './infra/firestore-feed.js'
import { ingestaoRepoFirestore } from './infra/firestore-ingestao.js'
import { verificarFirestore } from './infra/prontidao.js'
import { criarFontePncp, opcoesPncpDoAmbiente } from './ingestao/cliente-pncp.js'
import { fonteFixture } from './ingestao/fixtures.js'
import { executarIngestao } from './ingestao/servico.js'

const port = Number(process.env.PORT ?? 3333)

/**
 * Fonte da ingestão: `pncp` (padrão, API real) ou `fixtures` (demonstração, sem internet).
 * Fixtures só gravam no emulador, a menos que INGEST_PERMITIR_FIXTURES=true (demo em ambiente real, de propósito).
 */
const fonte = process.env.INGEST_FONTE ?? 'pncp'
if (fonte !== 'pncp' && fonte !== 'fixtures') throw new Error(`INGEST_FONTE inválida: ${fonte} (use pncp ou fixtures).`)
if (fonte === 'fixtures' && !process.env.FIRESTORE_EMULATOR_HOST && process.env.INGEST_PERMITIR_FIXTURES !== 'true') {
  throw new Error('INGEST_FONTE=fixtures fora do emulador exige INGEST_PERMITIR_FIXTURES=true.')
}

const corsOrigens = (process.env.CORS_ORIGENS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const app = buildApp({
  corsOrigens,
  verificarToken: verificarTokenFirebase,
  definirClaims: definirClaimsFirebase,
  perfis: perfilRepoFirestore(),
  feed: feedRepoFirestore(),
  certidoes: certidaoRepoFirestore(),
  arquivos: armazenamentoLocal(),
  tokenJob: process.env.INGEST_JOB_TOKEN,
  prontidao: verificarFirestore,
  ingestao: () =>
    executarIngestao({
      repo: ingestaoRepoFirestore(),
      fonte:
        fonte === 'fixtures'
          ? fonteFixture
          : criarFontePncp(opcoesPncpDoAmbiente()),
    }),
})

try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
