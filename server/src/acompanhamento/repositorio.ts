import type { Edital } from '../dominio/edital.js'
import type { AcompanhamentoRegistro, Etapa } from './modelo.js'

export interface ConsultaLista {
  empresaId: string
  etapa?: Etapa
  /** Meia-noite de hoje em Brasília (ms). Separa os prazos passados dos que ainda valem. */
  hojeInicioMs: number
  offset: number
  limit: number
}

/**
 * Acompanhamentos de editais, por empresa. A listagem é sempre uma página: não existe método que leia tudo,
 * então a rota não tem como ler a coleção inteira.
 */
export interface AcompanhamentoRepo {
  obter(id: string): Promise<AcompanhamentoRegistro | null>
  /** Cria só se o id ainda não existe; senão devolve o que já existe (`criado: false`), sem duplicar. */
  criar(novo: AcompanhamentoRegistro): Promise<{ registro: AcompanhamentoRegistro; criado: boolean }>
  /**
   * Lê, aplica `mudar` e grava, de forma atômica. `mudar` pode lançar (regra de negócio, outra empresa) e nada é gravado.
   * Devolve `null` se o acompanhamento não existe.
   */
  atualizar(id: string, mudar: (atual: AcompanhamentoRegistro) => AcompanhamentoRegistro): Promise<AcompanhamentoRegistro | null>
  /** Lê, valida com `validar` (pode lançar) e remove, de forma atômica. Devolve `false` se não existe. */
  remover(id: string, validar: (atual: AcompanhamentoRegistro) => void): Promise<boolean>
  /** Uma página da lista, na ordem definida em `modelo.ts`, e o total que combina com o filtro. */
  listarPagina(consulta: ConsultaLista): Promise<{ itens: AcompanhamentoRegistro[]; total: number }>
}

/** Leitura de um edital pelo id, para criar o acompanhamento. Id inexistente ou inválido devolve `null`. */
export interface EditalLeitura {
  obter(id: string): Promise<Edital | null>
}

export interface DependenciasAcompanhamento {
  repo: AcompanhamentoRepo
  editais: EditalLeitura
}
