import type { Faixa } from '@/services/dto'
import { cn } from '@/lib/utils'
import { ROTULO_FAIXA } from './rotulos'

const ESTILO: Record<Faixa, { selo: string; nota: string }> = {
  alta: { selo: 'border-radar bg-radar-suave text-radar', nota: 'bg-radar text-white' },
  media: { selo: 'border-radar/40 bg-background text-radar', nota: 'bg-radar/15 text-radar' },
  baixa: { selo: 'border-border bg-background text-muted-foreground', nota: 'bg-muted text-muted-foreground' },
}

/**
 * Selo de aderência: a nota (0 a 100) e o texto da faixa juntos, para a faixa nunca depender só da cor.
 * Faixas do contrato v0.3: Alta de 80 a 100, Média de 50 a 79, Baixa de 0 a 49.
 */
export function SeloDeScore({ score, faixa }: { score: number; faixa: Faixa }) {
  const estilo = ESTILO[faixa]
  return (
    <span
      className={cn('inline-flex items-stretch overflow-hidden rounded-full border text-sm leading-none', estilo.selo)}
      aria-label={`Nota ${score} de 100, aderência ${ROTULO_FAIXA[faixa].toLowerCase()}`}
      role="img"
    >
      <span aria-hidden className={cn('flex items-center px-2.5 py-1.5 font-semibold tabular-nums', estilo.nota)}>
        {score}
      </span>
      <span aria-hidden className="flex items-center px-2.5 font-medium">
        {ROTULO_FAIXA[faixa]}
      </span>
    </span>
  )
}
