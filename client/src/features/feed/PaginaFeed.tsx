import { useEffect } from 'react'
import { LoaderCircle, Radar, SearchX } from 'lucide-react'
import { EstadoDaConsulta, Vazio } from '@/components/estado'
import { Skeleton } from '@/components/ui/skeleton'
import { Paginacao } from '@/components/Paginacao'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MotivoVazio } from '@/services/dto'
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
        tituloErro="Não foi possível carregar as oportunidades"
        carregando={<EsqueletoDoFeed />}
        vazio={<VazioDoFeed motivo={feed.data?.motivoVazio ?? null} temFiltro={temFiltro} limpar={limpar} />}
      >
        {(pagina) => (
          <div aria-busy={feed.isPlaceholderData}>
            <div
              className={cn(
                'space-y-3 transition-opacity',
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
      titulo="Nenhum edital combina com o perfil da sua empresa"
      descricao="Há editais no radar, mas nenhum passou pelos critérios do perfil. Reveja os termos-chave e a faixa de valor: termos mais amplos e uma faixa maior trazem mais oportunidades."
    />
  )
}

/**
 * Carregando: aviso em texto (com o ícone girando) mais esqueletos no formato dos cards,
 * para a tela não pular quando os editais chegam.
 */
function EsqueletoDoFeed() {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
        Carregando oportunidades
      </p>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} aria-hidden className="flex gap-4 rounded-xl border p-5">
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
          <div className="hidden w-44 space-y-2 border-l pl-5 sm:block">
            <Skeleton className="ml-auto h-4 w-28" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
