import type { FeedPaginaDTO, FiltrosFeedDTO } from './dto'
import { api, desembrulhar } from './http'

/** GET /v1/feed: editais já ordenados pelo back (score, prazo, publicação, id), com filtros e paginação. */
export function listarFeed(filtros: FiltrosFeedDTO = {}): Promise<FeedPaginaDTO> {
  return desembrulhar(api.GET('/v1/feed', { params: { query: filtros } }))
}
