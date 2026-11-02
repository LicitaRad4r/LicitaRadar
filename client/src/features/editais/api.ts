import { useQuery } from '@tanstack/react-query'
import { chaves } from '@/api/chaves'
import { api, desembrulhar } from '@/api/client'

/**
 * GET /v1/editais/{id} (fica para depois do Checkpoint 2 no contrato).
 * O id do PNCP pode ter "/"; o cliente HTTP codifica o parâmetro na URL.
 */
export function useEdital(editalId: string) {
  return useQuery({
    queryKey: chaves.edital(editalId),
    queryFn: () =>
      desembrulhar(api.GET('/v1/editais/{editalId}', { params: { path: { editalId } } })),
    enabled: editalId.length > 0,
  })
}
