import { useEffect } from 'react'
import { SearchX, Radar } from 'lucide-react'
import { EstadoDaConsulta, Vazio } from '@/components/estado'
import { Skeleton } from '@/components/ui/skeleton'
import { Paginacao } from '@/components/Paginacao'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MotivoVazio } from '@/api/tipos'
import { useFeed } from './api'
import { BarraDeFiltros } from './BarraDeFiltros'
import { ItemDoFeed } from './ItemDoFeed'
import { TAMANHO_PAGINA } from './filtros'
import { useFiltrosDaUrl } from './useFiltrosDaUrl'

/**
 * Feed (issue #15) com a barra de filtros (issue #16):
 * editais do PNCP ordenados por aderência ao perfil.
 */
export function PaginaFeed() {
  const { filtros, consulta, etiquetas, temFiltro, alterar, limpar } = useFiltrosDaUrl()
  const feed = useFeed(consulta)

  // Se a página pedida passou do fim (ex.: depois de filtrar), volta para a última que existe.
  const total = feed.data?.total
  useEffect(() => {
    if (total === undefined || feed.isPlaceholderData) return
    const ultima = Math.max(1, Math.ceil(total / TAMANHO_PAGINA))
    if (filtros.page > ultima) alterar({ page: ultima })
  }, [total, filtros.page, feed.isPlaceholderData, alterar])

  return (
    <section aria-labelledby="titulo-feed" className="space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-feed" className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
          Editais para você
        </h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {resumo(feed.data?.total, temFiltro)}
        </p>
      </header>

      <BarraDeFiltros filtros={filtros} etiquetas={etiquetas} alterar={alterar} limpar={limpar} />

      <EstadoDaConsulta
        consulta={feed}
        tituloErro="Não foi possível carregar os editais"
        carregando={<EsqueletoDoFeed />}
        vazio={<VazioDoFeed motivo={feed.data?.motivoVazio ?? null} temFiltro={temFiltro} limpar={limpar} />}
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
              pagina={pagina.page}
              tamanho={pagina.pageSize}
              total={pagina.total}
              aoMudar={(nova) => {
                alterar({ page: nova })
                window.scrollTo?.({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        )}
      </EstadoDaConsulta>
    </section>
  )
}

function resumo(total: number | undefined, temFiltro: boolean) {
  if (!total) return 'Editais do PNCP ordenados pela aderência ao seu perfil.'
  const quantos = total === 1 ? '1 edital combina' : `${total} editais combinam`
  return temFiltro
    ? `${quantos} com o seu perfil e os filtros, dos mais aderentes para os menos.`
    : `${quantos} com o seu perfil, dos mais aderentes para os menos.`
}

/**
 * Mensagens de lista vazia conforme o motivo informado pelo back (`motivoVazio`):
 * nada ingerido do PNCP, perfil descartou tudo, ou os filtros eliminaram tudo.
 */
function VazioDoFeed({
  motivo,
  temFiltro,
  limpar,
}: {
  motivo: MotivoVazio | null
  temFiltro: boolean
  limpar: () => void
}) {
  if (motivo === 'sem_editais') {
    return (
      <Vazio
        icone={<Radar aria-hidden />}
        titulo="Ainda não há editais ingeridos"
        descricao="Os editais do PNCP são buscados todos os dias. Assim que a primeira busca terminar, os que combinam com o seu perfil aparecem aqui."
      />
    )
  }
  if (motivo === 'filtros' || (motivo === null && temFiltro)) {
    return (
      <Vazio
        icone={<SearchX aria-hidden />}
        titulo="Nenhum edital combina com esses filtros"
        descricao="Remova algum filtro ou limpe todos para ver os editais do seu perfil."
        acao={
          <Button variant="outline" onClick={limpar}>
            Limpar filtros
          </Button>
        }
      />
    )
  }
  return (
    <Vazio
      icone={<SearchX aria-hidden />}
      titulo="Nenhum edital combina com o seu perfil"
      descricao="Há editais no radar, mas nenhum passou pelos critérios do seu perfil. Ampliar os termos, os estados ou a faixa de valor traz mais resultados."
    />
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
