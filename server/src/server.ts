import { buildApp } from './app.js'
import { definirClaimsFirebase, perfilRepoFirestore, verificarTokenFirebase } from './infra/firebase.js'
import { feedRepoFirestore } from './infra/firestore-feed.js'

const port = Number(process.env.PORT ?? 3333)

const app = buildApp({
  verificarToken: verificarTokenFirebase,
  definirClaims: definirClaimsFirebase,
  perfis: perfilRepoFirestore(),
  feed: feedRepoFirestore(),
})

try {
  await app.listen({ port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
