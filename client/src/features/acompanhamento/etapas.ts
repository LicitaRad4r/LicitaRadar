import type { AcompanhamentoDTO, Etapa, ResultadoAcompanhamento } from '@/services/dto'

export const ETAPAS_EM_ORDEM: Etapa[] = ['interessado', 'preparando', 'enviado', 'resultado']

export const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  interessado: 'Interessado',
  preparando: 'Preparando',
  enviado: 'Enviado',
  resultado: 'Resultado',
}

export const ROTULO_DO_RESULTADO: Record<ResultadoAcompanhamento, string> = {
  venceu: 'Venceu',
  nao_venceu: 'Não venceu',
}

const DESTINOS_PERMITIDOS: Record<Etapa, Etapa[]> = {
  interessado: ['preparando'],
  preparando: ['enviado', 'interessado'],
  enviado: ['resultado'],
  resultado: [],
}

export const destinosPermitidos = (etapa: Etapa) => DESTINOS_PERMITIDOS[etapa]

export const podeMover = (de: Etapa, para: Etapa) => DESTINOS_PERMITIDOS[de].includes(para)

const PROPOSTA_AINDA_NAO_ENVIADA: Etapa[] = ['interessado', 'preparando']

export const podeDeixarDeAcompanhar = (etapa: Etapa) => PROPOSTA_AINDA_NAO_ENVIADA.includes(etapa)

export const prazoEncerradoNaEtapa = (etapa: Etapa, diasRestantes: number) =>
  diasRestantes < 0 && PROPOSTA_AINDA_NAO_ENVIADA.includes(etapa)

export function ordenarComoNoServidor(acompanhamentos: AcompanhamentoDTO[]) {
  return [...acompanhamentos].sort(
    (a, b) =>
      Number(a.encerrado) - Number(b.encerrado) ||
      Date.parse(a.prazo) - Date.parse(b.prazo) ||
      a.id.localeCompare(b.id),
  )
}
