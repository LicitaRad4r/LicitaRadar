import type { FeedItemDTO } from '@/services/dto'
import { diaEmBrasilia, diasEntre, hojeEmBrasilia } from '@/lib/datas'
import { formatarDataCurta, formatarMoeda, textoPrazo } from '@/lib/formatar'
import { cn } from '@/lib/utils'
import { ROTULO_MODALIDADE } from './rotulos'
import { SeloDeScore } from './SeloDeScore'

const PRAZO_URGENTE = 3

/** Card de um edital do feed: nota e faixa, órgão e local, objeto, prazo, valor, modalidade e publicação. */
export function ItemDoFeed({ edital }: { edital: FeedItemDTO }) {
  // Dias até o prazo, contados em Brasília como no back.
  const dias = diasEntre(hojeEmBrasilia(), diaEmBrasilia(edital.prazo))
  const urgente = dias <= PRAZO_URGENTE
  // Evita "Prefeitura de Anápolis, Anápolis, GO" quando o órgão já diz a cidade.
  const municipio = edital.municipio && !edital.orgao.includes(edital.municipio) ? edital.municipio : null
  const local = [municipio, edital.uf].filter(Boolean).join(', ')
  const valor = edital.valorEstimado != null ? formatarMoeda(edital.valorEstimado) : 'Valor não informado'

  return (
    <article
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-start"
      aria-labelledby={`edital-${edital.id}`}
    >
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SeloDeScore score={edital.score} faixa={edital.faixa} />
          <span className="text-sm text-muted-foreground">
            {edital.orgao}
            {local && `, ${local}`}
          </span>
        </div>

        <h2 id={`edital-${edital.id}`} className="text-base leading-snug font-semibold text-foreground">
          {edital.titulo}
        </h2>

        <p className="text-xs text-muted-foreground">
          {ROTULO_MODALIDADE[edital.modalidade]}, publicado em {formatarDataCurta(edital.dataPublicacao)}
        </p>
      </div>

      <dl className="flex shrink-0 justify-between gap-6 border-t pt-3 text-sm sm:block sm:w-44 sm:space-y-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5 sm:text-right">
        <div>
          <dt className="text-xs text-muted-foreground">Prazo para proposta</dt>
          <dd className={cn('font-medium', urgente ? 'text-urgente' : 'text-foreground')}>{textoPrazo(dias)}</dd>
          <dd className="text-xs text-muted-foreground">até {formatarDataCurta(edital.prazo)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-muted-foreground">Valor estimado</dt>
          <dd className="font-medium tabular-nums">{valor}</dd>
        </div>
      </dl>
    </article>
  )
}
