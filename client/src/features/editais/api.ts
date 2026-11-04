import { useQuery } from '@tanstack/react-query'
import { chaves } from '@/lib/chaves'
import { obterEdital } from '@/services/editais'

/**
 * GET /v1/editais/{id} (fica para depois do Checkpoint 2 no contrato).
 * O id do PNCP pode ter "/"; o cliente HTTP codifica o parâmetro na URL.
 */
export function useEdital(editalId: string) {
  return useQuery({
    queryKey: chaves.edital(editalId),
    queryFn: () => obterEdital(editalId),
    enabled: editalId.length > 0,
  })
}
