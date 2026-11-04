import { buildApp } from './app.js'
import { definirClaimsFirebase, perfilRepoFirestore, verificarTokenFirebase } from './infra/firebase.js'
import { armazenamentoLocal } from './infra/armazenamento-local.js'
import { certidaoRepoFirestore } from './infra/firestore-certidoes.js'
import { feedRepoFirestore } from './infra/firestore-feed.js'

const port = Number(process.env.PORT ?? 3333)

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
})

try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
