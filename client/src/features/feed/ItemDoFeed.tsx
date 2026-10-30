import { ExternalLink, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { Feedback, FeedItem } from '@/api/tipos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatarDataCurta, formatarMoeda, textoPrazo } from '@/lib/formatar'
import { cn } from '@/lib/utils'
import { useFeedback } from '@/features/editais/api'
import { AnelDeScore } from './AnelDeScore'
import { ROTULO_CRITERIO, ROTULO_FAIXA, rotuloModalidade } from './rotulos'

const PRAZO_URGENTE = 3

export function ItemDoFeed({ edital }: { edital: FeedItem }) {
  const feedback = useFeedback()
  const urgente = edital.diasParaEncerrar <= PRAZO_URGENTE
  // Evita "Prefeitura de Anápolis, Anápolis, GO" quando o órgão já diz a cidade.
  const municipio = edital.municipio && !edital.orgao.includes(edital.municipio) ? edital.municipio : null
  const local = [municipio, edital.uf].filter(Boolean).join(', ')
  const modalidade = rotuloModalidade(edital.modalidade)

  function marcar(valor: Feedback) {
    feedback.mutate({ editalId: edital.id, valor: edital.feedback === valor ? null : valor })
  }

  return (
    <article className="flex gap-4 py-5" aria-labelledby={`edital-${edital.id}`}>
      <AnelDeScore score={edital.score} faixa={edital.faixa} />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={edital.faixa === 'alta' ? 'default' : 'outline'}
            className={edital.faixa === 'alta' ? 'bg-radar-suave text-radar' : 'text-muted-foreground'}
          >
            {ROTULO_FAIXA[edital.faixa]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {edital.orgao}
            {local && `, ${local}`}
          </span>
        </div>

        <h2 id={`edital-${edital.id}`} className="text-base leading-snug font-semibold text-foreground">
          {edital.objeto}
        </h2>

        {/* No celular, prazo e valor ficam abaixo do título (no computador, na coluna da direita). */}
        <p className="flex flex-wrap gap-x-3 text-sm sm:hidden">
          <span className={cn('font-medium', urgente ? 'text-urgente' : 'text-foreground')}>
            {textoPrazo(edital.diasParaEncerrar)}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {edital.valorEstimado != null ? formatarMoeda(edital.valorEstimado) : 'Valor sigiloso'}
          </span>
        </p>

        {edital.criteriosAtendidos.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="O que combina com o seu perfil">
            {edital.criteriosAtendidos.map((criterio) => (
              <li key={criterio}>
                <Badge variant="secondary">{ROTULO_CRITERIO[criterio]}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="-ml-2 flex flex-wrap items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={edital.feedback === 'relevante'}
            onClick={() => marcar('relevante')}
            className={cn(edital.feedback === 'relevante' && 'bg-radar-suave text-radar hover:bg-radar-suave')}
          >
            <ThumbsUp aria-hidden />
            Relevante
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={edital.feedback === 'irrelevante'}
            onClick={() => marcar('irrelevante')}
            className={cn(edital.feedback === 'irrelevante' && 'bg-muted text-foreground')}
          >
            <ThumbsDown aria-hidden />
            Não relevante
          </Button>
          {edital.linkPncp && (
            <a
              href={edital.linkPncp}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Ver no PNCP
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          )}
        </div>
      </div>

      <dl className="hidden w-40 shrink-0 space-y-2 text-right text-sm sm:block">
        <div>
          <dt className="sr-only">Prazo para proposta</dt>
          <dd className={cn('font-medium', urgente ? 'text-urgente' : 'text-foreground')}>
            {textoPrazo(edital.diasParaEncerrar)}
          </dd>
          <dd className="text-xs text-muted-foreground">até {formatarDataCurta(edital.dataLimiteProposta)}</dd>
        </div>
        <div>
          <dt className="sr-only">Valor estimado</dt>
          <dd className="tabular-nums">
            {edital.valorEstimado != null ? formatarMoeda(edital.valorEstimado) : 'Valor sigiloso'}
          </dd>
          {modalidade && <dd className="text-xs text-muted-foreground">{modalidade}</dd>}
        </div>
      </dl>
    </article>
  )
}
