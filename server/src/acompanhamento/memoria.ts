import type { Edital } from '../dominio/edital.js'
import { faixaDe, faixasDaConsulta, type AcompanhamentoRegistro } from './modelo.js'
import type { AcompanhamentoRepo, EditalLeitura } from './repositorio.js'

/** Implementação em memória (testes). Segue a mesma ordem e a mesma paginação do Firestore. */
export function acompanhamentoRepoMemoria(inicial: AcompanhamentoRegistro[] = []): AcompanhamentoRepo & { todos(): AcompanhamentoRegistro[] } {
  const mapa = new Map(inicial.map((r) => [r.id, r]))
  return {
    todos: () => [...mapa.values()],
    async obter(id) {
      return mapa.get(id) ?? null
    },
    async criar(novo) {
      const existente = mapa.get(novo.id)
      if (existente) return { registro: existente, criado: false }
      mapa.set(novo.id, novo)
      return { registro: novo, criado: true }
    },
    async atualizar(id, mudar) {
      const atual = mapa.get(id)
      if (!atual) return null
      const novo = mudar(atual)
      mapa.set(id, novo)
      return novo
    },
    async remover(id, validar) {
      const atual = mapa.get(id)
      if (!atual) return false
      validar(atual)
      mapa.delete(id)
      return true
    },
    async listarPagina({ empresaId, etapa, hojeInicioMs, offset, limit }) {
      const doFiltro = [...mapa.values()].filter((r) => r.empresaId === empresaId && (!etapa || r.etapa === etapa))
      const faixas = faixasDaConsulta(etapa)
      const ordenados = doFiltro.sort(
        (a, b) =>
          faixas.indexOf(faixaDe(a, hojeInicioMs)) - faixas.indexOf(faixaDe(b, hojeInicioMs)) ||
          a.prazoEm - b.prazoEm ||
          a.id.localeCompare(b.id),
      )
      return { itens: ordenados.slice(offset, offset + limit), total: ordenados.length }
    },
  }
}

export const editaisEmMemoria = (editais: Edital[]): EditalLeitura => ({
  async obter(id) {
    return editais.find((e) => e.id === id) ?? null
  },
})
