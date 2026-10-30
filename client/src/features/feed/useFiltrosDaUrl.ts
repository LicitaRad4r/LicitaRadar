import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { Faixa, FiltrosFeed, Uf } from '@/api/tipos'

export const TAMANHO_PAGINA = 10

export type FiltrosDaTela = {
  termo: string
  uf: Uf | ''
  faixa: Faixa | ''
  pagina: number
}

/**
 * Os filtros do feed ficam na URL (?termo=&uf=&faixa=&pagina=).
 * Assim dá para recarregar, voltar e compartilhar o link sem perder a busca.
 */
export function useFiltrosDaUrl() {
  const [params, setParams] = useSearchParams()

  const filtros: FiltrosDaTela = useMemo(
    () => ({
      termo: params.get('termo') ?? '',
      uf: (params.get('uf') ?? '') as Uf | '',
      faixa: (['alta', 'media'].includes(params.get('faixa') ?? '') ? params.get('faixa') : '') as Faixa | '',
      pagina: Math.max(1, Number(params.get('pagina')) || 1),
    }),
    [params],
  )

  const alterar = useCallback(
    (mudancas: Partial<FiltrosDaTela>) => {
      setParams(
        (atuais) => {
          const proximos = new URLSearchParams(atuais)
          for (const [chave, valor] of Object.entries(mudancas)) {
            if (valor === '' || valor === undefined || (chave === 'pagina' && valor === 1)) {
              proximos.delete(chave)
            } else {
              proximos.set(chave, String(valor))
            }
          }
          // Mudou o filtro, a busca recomeça da primeira página.
          if (!('pagina' in mudancas)) proximos.delete('pagina')
          return proximos
        },
        { replace: !('pagina' in mudancas) },
      )
    },
    [setParams],
  )

  const limpar = useCallback(() => setParams({}), [setParams])

  const temFiltro = filtros.termo !== '' || filtros.uf !== '' || filtros.faixa !== ''

  /** Os filtros no formato da API. */
  const consulta: FiltrosFeed = useMemo(
    () => ({
      ...(filtros.termo.length >= 2 && { termo: filtros.termo }),
      ...(filtros.uf && { uf: [filtros.uf] }),
      ...(filtros.faixa && { faixa: filtros.faixa }),
      pagina: filtros.pagina,
      tamanho: TAMANHO_PAGINA,
    }),
    [filtros],
  )

  return { filtros, consulta, alterar, limpar, temFiltro }
}
