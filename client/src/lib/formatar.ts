const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

/** R$ 1.250.000 */
export function formatarMoeda(valor: number) {
  return moeda.format(valor)
}

/** R$ 1,3 mi */
export function formatarMoedaCompacta(valor: number) {
  return moedaCompacta.format(valor)
}

/** 05 de nov. */
export function formatarDataCurta(iso: string) {
  return dataCurta.format(new Date(iso)).replace('.', '')
}

/** Texto do prazo restante para enviar a proposta. */
export function textoPrazo(dias: number) {
  if (dias <= 0) return 'Encerra hoje'
  if (dias === 1) return 'Encerra amanhã'
  return `Encerra em ${dias} dias`
}
