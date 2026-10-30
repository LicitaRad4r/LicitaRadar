import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { chaves } from '@/api/chaves'
import { api, desembrulhar } from '@/api/client'
import type { FiltrosFeed } from '@/api/tipos'

/**
 * Jornada 2. GET /v1/feed, já ordenado por score.
 * Ao trocar filtro ou página, mantém a lista anterior na tela enquanto a nova carrega
 * (use `isPlaceholderData` para deixar a lista mais clara nesse meio tempo).
 */
export function useFeed(filtros: FiltrosFeed = {}) {
  return useQuery({
    queryKey: chaves.feed.lista(filtros),
    queryFn: () => desembrulhar(api.GET('/v1/feed', { params: { query: filtros } })),
    placeholderData: keepPreviousData,
  })
}
