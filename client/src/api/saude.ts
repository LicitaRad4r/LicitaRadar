import { useQuery } from '@tanstack/react-query'
import { chaves } from './chaves'
import { api, desembrulhar } from './client'

/** GET /health: indica se a API está no ar. */
export function useSaudeApi() {
  return useQuery({
    queryKey: chaves.saude,
    queryFn: () => desembrulhar(api.GET('/health')),
    refetchInterval: 60_000,
    retry: false,
  })
}
