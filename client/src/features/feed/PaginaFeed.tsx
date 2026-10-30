import { useEffect } from 'react'
import { SearchX, Radar } from 'lucide-react'
import { EstadoDaConsulta, Vazio } from '@/components/estado'
import { Skeleton } from '@/components/ui/skeleton'
import { Paginacao } from '@/components/Paginacao'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFeed } from './api'
import { BarraDeFiltros } from './BarraDeFiltros'
import { ItemDoFeed } from './ItemDoFeed'
import { TAMANHO_PAGINA, useFiltrosDaUrl } from './useFiltrosDaUrl'

/** Feed (issue #15): editais do PNCP ordenados por aderência ao perfil. */
export function PaginaFeed() {
  const { filtros, consulta, alterar, limpar, temFiltro } = useFiltrosDaUrl()
  const feed = useFeed(consulta)

  // Se a página pedida passou do fim (ex.: depois de filtrar), volta para a última que existe.
  const total = feed.data?.total
  useEffect(() => {
    if (total === undefined || feed.isPlaceholderData) return
    const ultima = Math.max(1, Math.ceil(total / TAMANHO_PAGINA))
    if (filtros.pagina > ultima) alterar({ pagina: ultima })
  }, [total, filtros.pagina, feed.isPlaceholderData, alterar])

  return (
    <section aria-labelledby="titulo-feed" className="space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-feed" className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
          Editais para você
        </h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {feed.data && feed.data.total > 0
            ? `${feed.data.total} ${feed.data.total === 1 ? 'edital combina' : 'editais combinam'} com o seu perfil, dos mais aderentes para os menos.`
            : 'Editais do PNCP ordenados pela aderência ao seu perfil.'}
        </p>
      </header>

      <BarraDeFiltros filtros={filtros} alterar={alterar} limpar={limpar} temFiltro={temFiltro} />

      <EstadoDaConsulta
        consulta={feed}
        tituloErro="Não foi possível carregar os editais"
        carregando={<EsqueletoDoFeed />}
        vazio={
          temFiltro ? (
            <Vazio
              icone={<SearchX aria-hidden />}
              titulo="Nenhum edital combina com esses filtros"
              descricao="Tente outro termo, outro estado ou todas as faixas de aderência."
              acao={
                <Button variant="outline" onClick={limpar}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <Vazio
              icone={<Radar aria-hidden />}
              titulo="Ainda não há editais para o seu perfil"
              descricao="Os editais do PNCP são buscados todos os dias. Assim que aparecer um que combine com o seu perfil, ele entra aqui. Se o perfil estiver muito restrito, ampliar termos ou estados traz mais resultados."
            />
          )
        }
      >
        {(pagina) => (
          <div aria-busy={feed.isPlaceholderData}>
            <div
              className={cn(
                'divide-y border-y transition-opacity',
                feed.isPlaceholderData && 'pointer-events-none opacity-60',
              )}
            >
              {pagina.itens.map((edital) => (
                <ItemDoFeed key={edital.id} edital={edital} />
              ))}
            </div>
            <Paginacao
              pagina={pagina.pagina}
              tamanho={pagina.tamanho}
              total={pagina.total}
              aoMudar={(nova) => {
                alterar({ pagina: nova })
                window.scrollTo?.({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        )}
      </EstadoDaConsulta>
    </section>
  )
}

/** Esqueleto no mesmo formato das linhas do feed, para a tela não pular quando os editais chegam. */
function EsqueletoDoFeed() {
  return (
    <div role="status" aria-label="Carregando editais" aria-busy="true" className="divide-y border-y">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-4 py-5">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="hidden w-40 space-y-2 sm:block">
            <Skeleton className="ml-auto h-4 w-28" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
