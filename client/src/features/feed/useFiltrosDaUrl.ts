import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { escreverFiltros, etiquetas, lerFiltros, paraConsulta, type Filtros } from './filtros'

/**
 * Os filtros do feed moram na URL. Assim dá para recarregar, voltar no navegador
 * e mandar o link para alguém sem perder a busca (issue #16).
 */
export function useFiltrosDaUrl() {
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => lerFiltros(params), [params])

  // O setParams do React Router lê a URL da última renderização. Se duas mudanças chegarem antes
  // de a tela renderizar de novo (ex.: escolher estado e modalidade em sequência), a segunda apagaria
  // a primeira. Por isso a última URL escrita fica guardada aqui até a renderização alcançar.
  // Quando a tela renderiza com a URL nova, `base` deixa de ser igual a `params` e o guardado é ignorado.
  const pendente = useRef<{ base: URLSearchParams; proxima: URLSearchParams } | null>(null)

  const alterar = useCallback(
    (mudancas: Partial<Filtros>) => {
      const atuais = pendente.current?.base === params ? pendente.current.proxima : params
      const proximos = { ...lerFiltros(atuais), ...mudancas }
      // Mudou um filtro, a busca recomeça da primeira página.
      if (!('page' in mudancas)) proximos.page = 1
      const proxima = escreverFiltros(proximos)
      pendente.current = { base: params, proxima }
      // Trocar de página vira um passo no histórico (o "voltar" funciona); mexer em filtro não.
      setParams(proxima, { replace: !('page' in mudancas) })
    },
    [params, setParams],
  )

  const limpar = useCallback(() => {
    pendente.current = { base: params, proxima: new URLSearchParams() }
    setParams(new URLSearchParams())
  }, [params, setParams])

  const ativas = useMemo(() => etiquetas(filtros), [filtros])
  const consulta = useMemo(() => paraConsulta(filtros), [filtros])

  return { filtros, consulta, etiquetas: ativas, temFiltro: ativas.length > 0, alterar, limpar }
}
