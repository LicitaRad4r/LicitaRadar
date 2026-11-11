import type { Modalidade, Segmento } from '../perfil/schema.js'

export interface Edital {
  id: string
  objeto: string
  descricao: string
  orgao: string
  uf: string
  municipio: string | null
  modalidade: Modalidade
  segmento: Segmento | null
  valorEstimado: number | null
  /** ISO 8601 com fuso. */
  dataPublicacao: string
  /** Prazo para envio de propostas, ISO 8601 com fuso. */
  dataLimite: string
}

export type Faixa = 'alta' | 'media' | 'baixa'

export interface RegistroScore {
  empresaId: string
  editalId: string
  nota: number
  faixa: Faixa
}
