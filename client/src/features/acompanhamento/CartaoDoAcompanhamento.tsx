import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { diaEmBrasilia } from '@/lib/datas'
import { formatarDia, textoPrazo } from '@/lib/formatar'
import { cn } from '@/lib/utils'
import type { AcompanhamentoDTO, Etapa } from '@/services/dto'
import { destinosPermitidos, ETAPAS_EM_ORDEM, podeDeixarDeAcompanhar, ROTULO_DA_ETAPA, ROTULO_DO_RESULTADO } from './etapas'

type Props = {
  acompanhamento: AcompanhamentoDTO
  aoPedirMudanca: (acompanhamento: AcompanhamentoDTO, destino: Etapa) => void
  aoDeixarDeAcompanhar: (acompanhamento: AcompanhamentoDTO) => void
  aoComecarArrastar: (acompanhamento: AcompanhamentoDTO) => void
  aoTerminarArrastar: () => void
}

const ehVolta = (de: Etapa, para: Etapa) => ETAPAS_EM_ORDEM.indexOf(para) < ETAPAS_EM_ORDEM.indexOf(de)

export function CartaoDoAcompanhamento({
  acompanhamento,
  aoPedirMudanca,
  aoDeixarDeAcompanhar,
  aoComecarArrastar,
  aoTerminarArrastar,
}: Props) {
  const destinos = destinosPermitidos(acompanhamento.etapa)
  const idDoTitulo = `acompanhamento-${acompanhamento.id}`

  return (
    <article
      aria-labelledby={idDoTitulo}
      draggable={destinos.length > 0}
      onDragStart={(evento) => {
        evento.dataTransfer.effectAllowed = 'move'
        evento.dataTransfer.setData('text/plain', acompanhamento.id)
        aoComecarArrastar(acompanhamento)
      }}
      onDragEnd={aoTerminarArrastar}
      className={cn(
        'space-y-2.5 rounded-lg border bg-card p-3.5 text-sm shadow-xs',
        destinos.length > 0 && 'cursor-grab active:cursor-grabbing',
        acompanhamento.encerrado && 'bg-muted/40',
      )}
    >
      <h3 id={idDoTitulo} className="leading-snug font-medium">
        <Link
          to={`/editais/${encodeURIComponent(acompanhamento.editalId)}`}
          className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {acompanhamento.titulo}
        </Link>
      </h3>
      <p className="text-xs text-muted-foreground">
        {acompanhamento.orgao}, {acompanhamento.uf}
      </p>

      <SituacaoDoPrazo acompanhamento={acompanhamento} />

      {acompanhamento.resultado && (
        <Badge variant={acompanhamento.resultado === 'venceu' ? 'default' : 'secondary'}>
          {ROTULO_DO_RESULTADO[acompanhamento.resultado]}
        </Badge>
      )}

      {(destinos.length > 0 || podeDeixarDeAcompanhar(acompanhamento.etapa)) && (
        <div className="flex flex-wrap gap-1.5 border-t pt-2.5">
          {destinos.map((destino) => {
            const verbo = ehVolta(acompanhamento.etapa, destino) ? 'Voltar para' : 'Mover para'
            return (
              <Button
                key={destino}
                type="button"
                variant="outline"
                size="sm"
                aria-label={`${verbo} ${ROTULO_DA_ETAPA[destino]}: ${acompanhamento.titulo}`}
                onClick={() => aoPedirMudanca(acompanhamento, destino)}
              >
                {verbo} {ROTULO_DA_ETAPA[destino]}
              </Button>
            )
          })}
          {podeDeixarDeAcompanhar(acompanhamento.etapa) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Deixar de acompanhar: ${acompanhamento.titulo}`}
              onClick={() => aoDeixarDeAcompanhar(acompanhamento)}
              className="text-muted-foreground"
            >
              Deixar de acompanhar
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

function SituacaoDoPrazo({ acompanhamento }: { acompanhamento: AcompanhamentoDTO }) {
  const dataDoPrazo = formatarDia(diaEmBrasilia(acompanhamento.prazo))

  if (acompanhamento.encerrado) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          Prazo encerrado
        </Badge>
        <span className="text-muted-foreground">em {dataDoPrazo}</span>
      </p>
    )
  }

  return (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      {acompanhamento.destaque && <Badge className="bg-urgente text-background">Prazo próximo</Badge>}
      <span className={cn(acompanhamento.destaque ? 'font-medium text-urgente' : 'text-muted-foreground')}>
        {acompanhamento.diasRestantes >= 0 ? `${textoPrazo(acompanhamento.diasRestantes)} (${dataDoPrazo})` : `Prazo foi em ${dataDoPrazo}`}
      </span>
    </p>
  )
}
