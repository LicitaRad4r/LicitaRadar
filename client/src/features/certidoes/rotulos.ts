import type { CertidaoStatus } from '@/services/dto'

/** Faixas do contrato v0.3: vencida (menos de 0 dias), urgente (0 a 15), atenção (16 a 30), em dia (31 ou mais). */
export const ROTULO_STATUS: Record<CertidaoStatus, string> = {
  vencida: 'Vencida',
  urgente: 'Urgente',
  atencao: 'Atenção',
  em_dia: 'Em dia',
}

/** Cor do trilho lateral e do selo de cada status. */
export const COR_STATUS: Record<CertidaoStatus, { trilho: string; selo: string }> = {
  vencida: { trilho: 'bg-destructive', selo: 'bg-destructive/10 text-destructive' },
  urgente: { trilho: 'bg-urgente', selo: 'bg-urgente/10 text-urgente' },
  atencao: { trilho: 'bg-amber-500', selo: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  em_dia: { trilho: 'bg-emerald-600/60', selo: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300' },
}

/** "Venceu há 3 dias", "Vence hoje", "Vence em 22 dias". */
export function textoValidade(diasRestantes: number) {
  if (diasRestantes < -1) return `Venceu há ${-diasRestantes} dias`
  if (diasRestantes === -1) return 'Venceu ontem'
  if (diasRestantes === 0) return 'Vence hoje'
  if (diasRestantes === 1) return 'Vence amanhã'
  return `Vence em ${diasRestantes} dias`
}
