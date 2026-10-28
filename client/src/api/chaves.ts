import type { FiltrosAlertas, FiltrosFeed } from './tipos'

/**
 * Chaves do cache do TanStack Query. Centralizadas para que invalidar
 * (por exemplo, o feed depois de salvar o perfil) use sempre o mesmo nome.
 */
export const chaves = {
  saude: ['saude'] as const,
  perfil: ['perfil'] as const,
  feed: {
    todos: ['feed'] as const,
    lista: (filtros: FiltrosFeed) => ['feed', filtros] as const,
  },
  edital: (id: string) => ['edital', id] as const,
  acompanhamentos: {
    todos: ['acompanhamentos'] as const,
    lista: (pagina: number, tamanho: number) => ['acompanhamentos', { pagina, tamanho }] as const,
  },
  certidoes: ['certidoes'] as const,
  alertas: {
    todos: ['alertas'] as const,
    lista: (filtros: FiltrosAlertas) => ['alertas', filtros] as const,
  },
}
