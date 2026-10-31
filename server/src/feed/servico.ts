import type { Faixa } from '../dominio/edital.js'
import type { Consulta } from './consulta.js'
import type { FeedRepo } from './repositorio.js'

export interface ItemFeed {
  id: string
  titulo: string
  orgao: string
  uf: string
  municipio: string | null
  modalidade: string
  prazo: string
  dataPublicacao: string
  valorEstimado: number | null
  score: number
  faixa: Faixa
}

export type MotivoVazio = 'sem_editais' | 'todos_descartados' | 'filtros' // 'filtros' vem na Jornada 2

export interface RespostaFeed {
  itens: ItemFeed[]
  page: number
  pageSize: number
  total: number
  totalIngeridos: number
  motivoVazio: MotivoVazio | null
}

/** Desempate: score desc, prazo mais próximo, publicação mais recente, id. */
function comparar(a: ItemFeed, b: ItemFeed): number {
  return (
    b.score - a.score ||
    new Date(a.prazo).getTime() - new Date(b.prazo).getTime() ||
    new Date(b.dataPublicacao).getTime() - new Date(a.dataPublicacao).getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/** Só lê os scores já calculados (descartados não têm registro) e pagina. */
export async function montarFeed(repo: FeedRepo, empresaId: string, c: Consulta): Promise<RespostaFeed> {
  const [editais, scores] = await Promise.all([repo.editais(), repo.scores(empresaId)])
  const porId = new Map(editais.map((e) => [e.id, e]))

  const todos: ItemFeed[] = []
  for (const s of scores) {
    const e = porId.get(s.editalId)
    if (!e || s.empresaId !== empresaId) continue
    todos.push({
      id: e.id,
      titulo: e.objeto,
      orgao: e.orgao,
      uf: e.uf,
      municipio: e.municipio,
      modalidade: e.modalidade,
      prazo: e.dataLimite,
      dataPublicacao: e.dataPublicacao,
      valorEstimado: e.valorEstimado,
      score: s.nota,
      faixa: s.faixa,
    })
  }

  const filtrados = todos.sort(comparar)
  const inicio = (c.page - 1) * c.pageSize
  const itens = filtrados.slice(inicio, inicio + c.pageSize)

  let motivoVazio: MotivoVazio | null = null
  if (itens.length === 0) {
    motivoVazio = editais.length === 0 ? 'sem_editais' : 'todos_descartados'
  }
  return { itens, page: c.page, pageSize: c.pageSize, total: filtrados.length, totalIngeridos: editais.length, motivoVazio }
}
