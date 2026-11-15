import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { chaves } from '@/lib/chaves'
import {
  acompanharEdital,
  deixarDeAcompanhar,
  listarAcompanhamentosDaEtapa,
  mudarEtapaDoAcompanhamento,
  type MudancaDeEtapaDTO,
} from '@/services/acompanhamentos'
import type { AcompanhamentoDTO, AcompanhamentoPaginaDTO, Etapa } from '@/services/dto'
import { ETAPAS_EM_ORDEM, ordenarComoNoServidor, prazoEncerradoNaEtapa } from './etapas'

export const TAMANHO_DA_PAGINA = 20

type PaginasDaEtapa = InfiniteData<AcompanhamentoPaginaDTO, number>
type ColunasAntesDaMudanca = Array<[Etapa, PaginasDaEtapa | undefined]>

export function useAcompanhamentosDaEtapa(etapa: Etapa) {
  return useInfiniteQuery({
    queryKey: chaves.acompanhamentos.daEtapa(etapa),
    queryFn: ({ pageParam }) => listarAcompanhamentosDaEtapa(etapa, pageParam, TAMANHO_DA_PAGINA),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.page * ultima.pageSize < ultima.total ? ultima.page + 1 : undefined),
  })
}

export function useAcompanharEdital() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acompanharEdital,
    meta: { sucesso: 'Edital adicionado ao acompanhamento.' },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.acompanhamentos.todos }),
  })
}

export function useMudarEtapa() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: mudarEtapaDoAcompanhamento,
    onMutate: async (mudanca: MudancaDeEtapaDTO) => {
      const colunasAntes = await guardarColunas(queryClient)
      const movido = colunasAntes
        .flatMap(([, paginas]) => paginas?.pages.flatMap((pagina) => pagina.itens) ?? [])
        .find((acompanhamento) => acompanhamento.id === mudanca.acompanhamentoId)
      if (movido) {
        tirarDaColuna(queryClient, movido.etapa, movido.id)
        colocarNaColuna(queryClient, {
          ...movido,
          etapa: mudanca.etapa,
          resultado: mudanca.resultado ?? null,
          encerrado: prazoEncerradoNaEtapa(mudanca.etapa, movido.diasRestantes),
        })
      }
      return { colunasAntes }
    },
    onError: (_erro, _mudanca, contexto) => restaurarColunas(queryClient, contexto?.colunasAntes),
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.acompanhamentos.todos }),
  })
}

export function useDeixarDeAcompanhar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ acompanhamento }: { acompanhamento: AcompanhamentoDTO }) => deixarDeAcompanhar(acompanhamento.id),
    meta: { sucesso: 'Você deixou de acompanhar o edital.' },
    onMutate: async ({ acompanhamento }) => {
      const colunasAntes = await guardarColunas(queryClient)
      tirarDaColuna(queryClient, acompanhamento.etapa, acompanhamento.id)
      return { colunasAntes }
    },
    onError: (_erro, _variaveis, contexto) => restaurarColunas(queryClient, contexto?.colunasAntes),
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.acompanhamentos.todos }),
  })
}

async function guardarColunas(queryClient: QueryClient): Promise<ColunasAntesDaMudanca> {
  await queryClient.cancelQueries({ queryKey: chaves.acompanhamentos.todos })
  return ETAPAS_EM_ORDEM.map((etapa) => [etapa, queryClient.getQueryData<PaginasDaEtapa>(chaves.acompanhamentos.daEtapa(etapa))])
}

function restaurarColunas(queryClient: QueryClient, colunasAntes: ColunasAntesDaMudanca | undefined) {
  for (const [etapa, paginas] of colunasAntes ?? []) {
    queryClient.setQueryData(chaves.acompanhamentos.daEtapa(etapa), paginas)
  }
}

function tirarDaColuna(queryClient: QueryClient, etapa: Etapa, acompanhamentoId: string) {
  queryClient.setQueryData<PaginasDaEtapa>(chaves.acompanhamentos.daEtapa(etapa), (paginas) =>
    paginas && {
      ...paginas,
      pages: paginas.pages.map((pagina) => ({
        ...pagina,
        itens: pagina.itens.filter((item) => item.id !== acompanhamentoId),
        total: pagina.total - 1,
      })),
    },
  )
}

function colocarNaColuna(queryClient: QueryClient, acompanhamento: AcompanhamentoDTO) {
  queryClient.setQueryData<PaginasDaEtapa>(chaves.acompanhamentos.daEtapa(acompanhamento.etapa), (paginas) =>
    paginas && {
      ...paginas,
      pages: paginas.pages.map((pagina, indice) => ({
        ...pagina,
        itens: indice === 0 ? ordenarComoNoServidor([...pagina.itens, acompanhamento]) : pagina.itens,
        total: pagina.total + 1,
      })),
    },
  )
}
