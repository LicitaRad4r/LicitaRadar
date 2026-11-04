import type { ArmazenamentoArquivos, CertidaoRegistro, CertidaoRepo } from '../../src/certidoes/repositorio.js'

export function certidaoRepoMemoria(inicial: CertidaoRegistro[]) {
  const mapa = new Map(inicial.map((c) => [c.id, structuredClone(c)]))
  const repo: CertidaoRepo = {
    async listar(empresaId) {
      return [...mapa.values()].filter((c) => c.empresaId === empresaId).map((c) => structuredClone(c))
    },
    async obter(id) {
      const c = mapa.get(id)
      return c ? structuredClone(c) : null
    },
    async salvar(c) {
      mapa.set(c.id, structuredClone(c))
    },
  }
  return { repo, mapa }
}

export function armazenamentoMemoria() {
  const gravados = new Map<string, Buffer>()
  const armazenamento: ArmazenamentoArquivos = {
    async salvar(chave, conteudo) {
      gravados.set(chave, conteudo)
    },
  }
  return { armazenamento, gravados }
}
