import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { chaves } from '@/lib/chaves'
import type { FiltrosFeedDTO } from '@/services/dto'
import { listarFeed } from '@/services/feed'

/**
 * GET /v1/feed, já ordenado pelo back (score, prazo, publicação, id).
 * Ao trocar filtro ou página, mantém a lista anterior na tela enquanto a nova carrega
 * (use `isPlaceholderData` para deixar a lista mais clara nesse meio tempo).
 */
export function useFeed(filtros: FiltrosFeedDTO = {}) {
  return useQuery({
    queryKey: chaves.feed.lista(filtros),
    queryFn: () => listarFeed(filtros),
    placeholderData: keepPreviousData,
  })
}
