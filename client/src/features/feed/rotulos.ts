import type { Faixa, Modalidade } from '@/services/dto'

/** Faixas do contrato v0.3: alta de 80 a 100, média de 50 a 79, baixa de 0 a 49. */
export const ROTULO_FAIXA: Record<Faixa, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}

export const ROTULO_MODALIDADE: Record<Modalidade, string> = {
  pregao_eletronico: 'Pregão eletrônico',
  concorrencia: 'Concorrência',
  dispensa: 'Dispensa',
}
