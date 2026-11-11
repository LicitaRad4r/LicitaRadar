import type { FiltrosFeedDTO } from '@/services/dto'

/**
 * Chaves do cache do TanStack Query. Centralizadas para que invalidar
 * (por exemplo, o feed depois de salvar o perfil) use sempre o mesmo nome.
 */
export const chaves = {
  saude: ['saude'] as const,
  perfil: ['perfil'] as const,
  feed: {
    todos: ['feed'] as const,
    lista: (filtros: FiltrosFeedDTO) => ['feed', filtros] as const,
  },
  edital: (id: string) => ['edital', id] as const,
  certidoes: ['certidoes'] as const,
}
