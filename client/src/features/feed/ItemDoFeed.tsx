import type { Faixa, FeedItem } from '@/api/tipos'
import { Badge } from '@/components/ui/badge'
import { diaEmBrasilia, diasEntre, hojeEmBrasilia } from '@/lib/datas'
import { formatarDataCurta, formatarMoeda, textoPrazo } from '@/lib/formatar'
import { cn } from '@/lib/utils'
import { AnelDeScore } from './AnelDeScore'
import { ROTULO_FAIXA, ROTULO_MODALIDADE } from './rotulos'

const PRAZO_URGENTE = 3

const ESTILO_FAIXA: Record<Faixa, string> = {
  alta: 'bg-radar-suave text-radar',
  media: 'border border-radar/30 bg-transparent text-radar',
  baixa: 'border border-border bg-transparent text-muted-foreground',
}

export function ItemDoFeed({ edital }: { edital: FeedItem }) {
  // Dias até o prazo, contados em Brasília como no back.
  const dias = diasEntre(hojeEmBrasilia(), diaEmBrasilia(edital.prazo))
  const urgente = dias <= PRAZO_URGENTE
  // Evita "Prefeitura de Anápolis, Anápolis, GO" quando o órgão já diz a cidade.
  const municipio = edital.municipio && !edital.orgao.includes(edital.municipio) ? edital.municipio : null
  const local = [municipio, edital.uf].filter(Boolean).join(', ')
  const valor = edital.valorEstimado != null ? formatarMoeda(edital.valorEstimado) : 'Valor não informado'

  return (
    <article className="flex gap-4 py-5" aria-labelledby={`edital-${edital.id}`}>
      <AnelDeScore score={edital.score} faixa={edital.faixa} />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={ESTILO_FAIXA[edital.faixa]}>{ROTULO_FAIXA[edital.faixa]}</Badge>
          <span className="text-sm text-muted-foreground">
            {edital.orgao}
            {local && `, ${local}`}
          </span>
        </div>

        <h2 id={`edital-${edital.id}`} className="text-base leading-snug font-semibold text-foreground">
          {edital.titulo}
        </h2>

        {/* No celular, prazo e valor ficam abaixo do título (no computador, na coluna da direita). */}
        <p className="flex flex-wrap gap-x-3 text-sm sm:hidden">
          <span className={cn('font-medium', urgente ? 'text-urgente' : 'text-foreground')}>{textoPrazo(dias)}</span>
          <span className="tabular-nums text-muted-foreground">{valor}</span>
        </p>
      </div>

      <dl className="hidden w-40 shrink-0 space-y-2 text-right text-sm sm:block">
        <div>
          <dt className="sr-only">Prazo para proposta</dt>
          <dd className={cn('font-medium', urgente ? 'text-urgente' : 'text-foreground')}>{textoPrazo(dias)}</dd>
          <dd className="text-xs text-muted-foreground">até {formatarDataCurta(edital.prazo)}</dd>
        </div>
        <div>
          <dt className="sr-only">Valor estimado</dt>
          <dd className="tabular-nums">{valor}</dd>
          <dd className="text-xs text-muted-foreground">{ROTULO_MODALIDADE[edital.modalidade]}</dd>
        </div>
      </dl>
    </article>
  )
}
