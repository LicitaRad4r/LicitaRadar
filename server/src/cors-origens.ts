/** Projeto do Hosting. O canal de preview muda a cada PR; a lista fixa não cobre isso. */
const PROJETO = 'licitaradar-13047'

/** https://licitaradar-13047--pr-12-abc123.web.app */
const PREVIEW = new RegExp(`^https://${PROJETO}--[a-z0-9-]+\\.web\\.app$`)

/** Lista do ambiente, mais o site publicado e os canais de preview deste projeto. */
export function origensCors(configuradas: readonly string[]): (string | RegExp)[] {
  return [
    ...configuradas,
    `https://${PROJETO}.web.app`,
    `https://${PROJETO}.firebaseapp.com`,
    PREVIEW,
  ]
}
