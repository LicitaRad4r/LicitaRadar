import { useState, type DragEvent, type ReactNode } from 'react'
import { KanbanSquare, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { Erro, Vazio } from '@/components/estado'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { AcompanhamentoDTO, Etapa } from '@/services/dto'
import { useAcompanhamentosDaEtapa, useDeixarDeAcompanhar, useMudarEtapa } from './api'
import { CartaoDoAcompanhamento } from './CartaoDoAcompanhamento'
import { DialogoDeResultado } from './DialogoDeResultado'
import { ETAPAS_EM_ORDEM, podeMover, ROTULO_DA_ETAPA } from './etapas'

type ConsultaDaColuna = ReturnType<typeof useAcompanhamentosDaEtapa>

export function PaginaAcompanhamento() {
  const colunas: Record<Etapa, ConsultaDaColuna> = {
    interessado: useAcompanhamentosDaEtapa('interessado'),
    preparando: useAcompanhamentosDaEtapa('preparando'),
    enviado: useAcompanhamentosDaEtapa('enviado'),
    resultado: useAcompanhamentosDaEtapa('resultado'),
  }
  const consultas = Object.values(colunas)

  return (
    <section aria-labelledby="titulo-acompanhamento" className="space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-acompanhamento" className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
          Acompanhamento
        </h1>
        <p className="text-sm text-muted-foreground">
          Leve cada edital de Interessado até Resultado. Arraste o cartão ou use os botões dele.
        </p>
      </header>

      {consultas.some((consulta) => consulta.isPending) ? (
        <QuadroCarregando />
      ) : consultas.some((consulta) => consulta.isError && !consulta.data) ? (
        <Erro
          titulo="Não foi possível carregar o acompanhamento"
          erro={consultas.find((consulta) => consulta.isError)?.error}
          aoTentarDeNovo={() => consultas.forEach((consulta) => consulta.isError && consulta.refetch())}
        />
      ) : consultas.every((consulta) => totalDaColuna(consulta) === 0) ? (
        <Vazio
          icone={<KanbanSquare aria-hidden />}
          titulo="Você ainda não acompanha nenhum edital"
          descricao='No feed ou no detalhe de um edital, clique em "Acompanhar" para trazê-lo para cá.'
          acao={
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              Ver editais
            </Link>
          }
        />
      ) : (
        <Quadro colunas={colunas} />
      )}
    </section>
  )
}

const totalDaColuna = (consulta: ConsultaDaColuna) => consulta.data?.pages[0]?.total ?? 0

function Quadro({ colunas }: { colunas: Record<Etapa, ConsultaDaColuna> }) {
  const mudarEtapa = useMudarEtapa()
  const deixarDeAcompanhar = useDeixarDeAcompanhar()
  const [arrastado, setArrastado] = useState<AcompanhamentoDTO | null>(null)
  const [aguardandoResultado, setAguardandoResultado] = useState<AcompanhamentoDTO | null>(null)

  function pedirMudanca(acompanhamento: AcompanhamentoDTO, destino: Etapa) {
    if (!podeMover(acompanhamento.etapa, destino)) return
    if (destino === 'resultado') {
      setAguardandoResultado(acompanhamento)
      return
    }
    mudarEtapa.mutate({ acompanhamentoId: acompanhamento.id, etapa: destino })
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ETAPAS_EM_ORDEM.map((etapa) => (
          <ColunaDoQuadro
            key={etapa}
            etapa={etapa}
            consulta={colunas[etapa]}
            arrastado={arrastado}
            aoSoltar={(acompanhamento) => pedirMudanca(acompanhamento, etapa)}
          >
            {(acompanhamento) => (
              <CartaoDoAcompanhamento
                key={acompanhamento.id}
                acompanhamento={acompanhamento}
                aoPedirMudanca={pedirMudanca}
                aoDeixarDeAcompanhar={(escolhido) => deixarDeAcompanhar.mutate({ acompanhamento: escolhido })}
                aoComecarArrastar={setArrastado}
                aoTerminarArrastar={() => setArrastado(null)}
              />
            )}
          </ColunaDoQuadro>
        ))}
      </div>

      {aguardandoResultado && (
        <DialogoDeResultado
          acompanhamento={aguardandoResultado}
          aoCancelar={() => setAguardandoResultado(null)}
          aoConfirmar={(resultado) => {
            mudarEtapa.mutate({ acompanhamentoId: aguardandoResultado.id, etapa: 'resultado', resultado })
            setAguardandoResultado(null)
          }}
        />
      )}
    </>
  )
}

function ColunaDoQuadro({
  etapa,
  consulta,
  arrastado,
  aoSoltar,
  children,
}: {
  etapa: Etapa
  consulta: ConsultaDaColuna
  arrastado: AcompanhamentoDTO | null
  aoSoltar: (acompanhamento: AcompanhamentoDTO) => void
  children: (acompanhamento: AcompanhamentoDTO) => ReactNode
}) {
  const [cartaoPorCima, setCartaoPorCima] = useState(false)
  const acompanhamentos = consulta.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const ehOrigemDoArraste = arrastado?.etapa === etapa
  const aceitaOArrastado = arrastado !== null && podeMover(arrastado.etapa, etapa)
  const desabilitadaNoArraste = arrastado !== null && !aceitaOArrastado && !ehOrigemDoArraste
  const idDoTitulo = `coluna-${etapa}`

  function permitirSoltar(evento: DragEvent) {
    if (!aceitaOArrastado) return
    evento.preventDefault()
    evento.dataTransfer.dropEffect = 'move'
    setCartaoPorCima(true)
  }

  return (
    <section
      aria-labelledby={idDoTitulo}
      aria-disabled={desabilitadaNoArraste || undefined}
      onDragOver={permitirSoltar}
      onDragEnter={permitirSoltar}
      onDragLeave={() => setCartaoPorCima(false)}
      onDrop={(evento) => {
        evento.preventDefault()
        setCartaoPorCima(false)
        if (arrastado && aceitaOArrastado) aoSoltar(arrastado)
      }}
      className={cn(
        'flex min-h-40 flex-col gap-3 rounded-xl border bg-muted/40 p-3 transition-[opacity,background-color]',
        desabilitadaNoArraste && 'opacity-40',
        aceitaOArrastado && 'border-dashed border-radar',
        cartaoPorCima && 'bg-radar-suave',
      )}
    >
      <h2 id={idDoTitulo} className="flex items-center justify-between text-sm font-semibold">
        {ROTULO_DA_ETAPA[etapa]}
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          <span className="sr-only">Total: </span>
          {totalDaColuna(consulta)}
        </span>
      </h2>

      {acompanhamentos.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Nenhum edital nesta etapa.</p>
      ) : (
        <div className="space-y-2.5">{acompanhamentos.map(children)}</div>
      )}

      {consulta.hasNextPage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={consulta.isFetchingNextPage}
          onClick={() => consulta.fetchNextPage()}
        >
          {consulta.isFetchingNextPage ? 'Carregando' : `Carregar mais em ${ROTULO_DA_ETAPA[etapa]}`}
        </Button>
      )}
    </section>
  )
}

function QuadroCarregando() {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
        Carregando acompanhamento
      </p>
      <div aria-hidden className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ETAPAS_EM_ORDEM.map((etapa) => (
          <div key={etapa} className="space-y-2.5 rounded-xl border p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
