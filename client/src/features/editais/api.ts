import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { chaves } from '@/api/chaves'
import { api, desembrulhar } from '@/api/client'
import type { EditalDetalhe, Etapa, Feedback, FeedPagina } from '@/api/tipos'

/** GET /v1/editais/{id}. 404 se não existe ou é de outra empresa. */
export function useEdital(editalId: string) {
  return useQuery({
    queryKey: chaves.edital(editalId),
    queryFn: () =>
      desembrulhar(api.GET('/v1/editais/{editalId}', { params: { path: { editalId } } })),
    enabled: editalId.length > 0,
  })
}

type CamposEdital = { feedback?: Feedback | null; acompanhando?: boolean }

/** Atualiza o edital em todas as páginas do feed e no detalhe que estiverem no cache. */
function atualizarEditalNoCache(queryClient: QueryClient, editalId: string, campos: CamposEdital) {
  queryClient.setQueriesData<FeedPagina>({ queryKey: chaves.feed.todos }, (pagina) =>
    pagina && {
      ...pagina,
      itens: pagina.itens.map((item) => (item.id === editalId ? { ...item, ...campos } : item)),
    },
  )
  queryClient.setQueryData<EditalDetalhe>(chaves.edital(editalId), (edital) =>
    edital && { ...edital, ...campos },
  )
}

/** Guarda o estado do cache antes de uma atualização otimista, para desfazer se a API falhar. */
function fotografarCache(queryClient: QueryClient, editalId: string) {
  return [
    ...queryClient.getQueriesData({ queryKey: chaves.feed.todos }),
    [chaves.edital(editalId), queryClient.getQueryData(chaves.edital(editalId))] as const,
  ]
}

type Fotografia = ReturnType<typeof fotografarCache>

function restaurarCache(queryClient: QueryClient, fotografia: Fotografia | undefined) {
  fotografia?.forEach(([chave, dados]) => queryClient.setQueryData(chave, dados))
}

/**
 * Botão "relevante / não relevante" do feed (métrica da demo).
 * Envie `valor: null` para remover a marcação. A tela muda na hora e volta atrás se a API falhar.
 */
export function useFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ editalId, valor }: { editalId: string; valor: Feedback | null }) => {
      const path = { editalId }
      return valor === null
        ? desembrulhar(api.DELETE('/v1/editais/{editalId}/feedback', { params: { path } }))
        : desembrulhar(
            api.PUT('/v1/editais/{editalId}/feedback', { params: { path }, body: { valor } }),
          )
    },
    onMutate: async ({ editalId, valor }) => {
      await queryClient.cancelQueries({ queryKey: chaves.feed.todos })
      const fotografia = fotografarCache(queryClient, editalId)
      atualizarEditalNoCache(queryClient, editalId, { feedback: valor })
      return fotografia
    },
    onError: (_erro, _variaveis, fotografia) => restaurarCache(queryClient, fotografia),
  })
}

/** Jornada 3. GET /v1/acompanhamentos, ordenado pelo prazo mais próximo. */
export function useAcompanhamentos(pagina = 1, tamanho = 20) {
  return useQuery({
    queryKey: chaves.acompanhamentos.lista(pagina, tamanho),
    queryFn: () =>
      desembrulhar(api.GET('/v1/acompanhamentos', { params: { query: { pagina, tamanho } } })),
  })
}

/**
 * PUT /v1/editais/{id}/acompanhamento.
 * Sem `etapas`: passa a acompanhar e o back cria as etapas padrão. Com `etapas`: substitui a lista.
 */
export function useAcompanhar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ editalId, etapas }: { editalId: string; etapas?: Etapa[] }) =>
      desembrulhar(
        api.PUT('/v1/editais/{editalId}/acompanhamento', {
          params: { path: { editalId } },
          body: etapas ? { etapas } : {},
        }),
      ),
    onSuccess: (_acompanhamento, { editalId }) => {
      atualizarEditalNoCache(queryClient, editalId, { acompanhando: true })
      return queryClient.invalidateQueries({ queryKey: chaves.acompanhamentos.todos })
    },
  })
}

/** DELETE /v1/editais/{id}/acompanhamento. */
export function useDeixarDeAcompanhar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (editalId: string) =>
      desembrulhar(
        api.DELETE('/v1/editais/{editalId}/acompanhamento', { params: { path: { editalId } } }),
      ),
    meta: { sucesso: 'Você deixou de acompanhar este edital.' },
    onSuccess: (_dados, editalId) => {
      atualizarEditalNoCache(queryClient, editalId, { acompanhando: false })
      return queryClient.invalidateQueries({ queryKey: chaves.acompanhamentos.todos })
    },
  })
}
