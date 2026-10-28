import type { Faixa } from '@/api/tipos'
import { cn } from '@/lib/utils'
import { ROTULO_FAIXA } from './rotulos'

const RAIO = 20
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

/**
 * Nota de aderência (0 a 100) desenhada como um anel que se completa.
 * Violeta para alta aderência, cinza para média.
 */
export function AnelDeScore({ score, faixa }: { score: number; faixa: Faixa }) {
  const preenchido = (Math.min(100, Math.max(0, score)) / 100) * CIRCUNFERENCIA
  return (
    <div
      className="relative grid size-14 shrink-0 place-items-center"
      role="img"
      aria-label={`Aderência ${score} de 100, ${ROTULO_FAIXA[faixa].toLowerCase()}`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={RAIO} fill="none" strokeWidth="4" className="stroke-border" />
        <circle
          cx="24"
          cy="24"
          r={RAIO}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${CIRCUNFERENCIA}`}
          className={faixa === 'alta' ? 'stroke-radar' : 'stroke-muted-foreground/60'}
        />
      </svg>
      <span
        className={cn(
          'text-base font-semibold tabular-nums',
          faixa === 'alta' ? 'text-radar' : 'text-muted-foreground',
        )}
      >
        {score}
      </span>
    </div>
  )
}
