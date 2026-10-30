import type { Criterio, Faixa } from '@/api/tipos'

export const ROTULO_FAIXA: Record<Faixa, string> = {
  alta: 'Alta aderência',
  media: 'Média aderência',
}

export const ROTULO_CRITERIO: Record<Criterio, string> = {
  termo: 'Termo-chave',
  uf: 'Estado',
  valor: 'Faixa de valor',
  prazo: 'Prazo',
  segmento: 'Segmento',
  modalidade: 'Modalidade',
}

const ROTULO_MODALIDADE: Record<string, string> = {
  pregao_eletronico: 'Pregão eletrônico',
  concorrencia: 'Concorrência',
  dispensa: 'Dispensa',
}

export function rotuloModalidade(modalidade?: string) {
  if (!modalidade) return undefined
  return ROTULO_MODALIDADE[modalidade] ?? modalidade
}
