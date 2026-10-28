import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/api/chaves'
import { api, desembrulhar } from '@/api/client'
import type { Alerta, AlertasPagina, FiltrosAlertas } from '@/api/tipos'

/**
 * Como o front não lê o Firestore direto, os alertas não chegam em tempo real:
 * a lista é consultada de novo a cada minuto.
 */
const INTERVALO_ALERTAS = 60_000

/** Jornada 5. GET /v1/alertas, mais recentes primeiro. */
export function useAlertas(filtros: FiltrosAlertas = {}) {
  return useQuery({
    queryKey: chaves.alertas.lista(filtros),
    queryFn: () => desembrulhar(api.GET('/v1/alertas', { params: { query: filtros } })),
    refetchInterval: INTERVALO_ALERTAS,
  })
}

/** Número para o sininho: busca só 1 item e usa o `total`. */
export function useContagemAlertasNaoLidos() {
  return useQuery({
    queryKey: chaves.alertas.lista({ lido: false, tamanho: 1 }),
    queryFn: () =>
      desembrulhar(api.GET('/v1/alertas', { params: { query: { lido: false, tamanho: 1 } } })),
    refetchInterval: INTERVALO_ALERTAS,
    select: (pagina) => pagina.total,
  })
}

/** PATCH /v1/alertas/{id}. Atualiza a tela na hora e desfaz se a API falhar. */
export function useMarcarAlerta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ alertaId, lido }: { alertaId: string; lido: boolean }) =>
      desembrulhar(
        api.PATCH('/v1/alertas/{alertaId}', { params: { path: { alertaId } }, body: { lido } }),
      ),
    onMutate: async ({ alertaId, lido }) => {
      await queryClient.cancelQueries({ queryKey: chaves.alertas.todos })
      const fotografia = queryClient.getQueriesData<AlertasPagina>({ queryKey: chaves.alertas.todos })
      queryClient.setQueriesData<AlertasPagina>({ queryKey: chaves.alertas.todos }, (pagina) =>
        pagina && {
          ...pagina,
          itens: pagina.itens.map((a: Alerta) => (a.id === alertaId ? { ...a, lido } : a)),
        },
      )
      return fotografia
    },
    onError: (_erro, _variaveis, fotografia) =>
      fotografia?.forEach(([chave, dados]) => queryClient.setQueryData(chave, dados)),
    // A contagem do sininho depende do filtro `lido`, então recarrega no fim.
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.alertas.todos }),
  })
}
