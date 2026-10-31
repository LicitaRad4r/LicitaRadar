import type { Edital, Faixa } from '../dominio/edital.js'
import { contemParcial, normalizar } from '../dominio/normalizar.js'
import { diaBrasilia } from '../dominio/tempo.js'
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

export type MotivoVazio = 'sem_editais' | 'todos_descartados' | 'filtros'

export interface RespostaFeed {
  itens: ItemFeed[]
  page: number
  pageSize: number
  total: number
  totalIngeridos: number
  motivoVazio: MotivoVazio | null
}

function passaFiltros(e: Edital, c: Consulta): boolean {
  if (c.uf && c.uf.length > 0 && !c.uf.includes(e.uf)) return false
  if (c.municipio && normalizar(e.municipio ?? '').join(' ') !== normalizar(c.municipio).join(' ')) return false
  if (c.modalidade && e.modalidade !== c.modalidade) return false
  const pub = diaBrasilia(new Date(e.dataPublicacao))
  if (c.publicadoDe && pub < c.publicadoDe) return false
  if (c.publicadoAte && pub > c.publicadoAte) return false
  const lim = diaBrasilia(new Date(e.dataLimite))
  if (c.prazoDe && lim < c.prazoDe) return false
  if (c.prazoAte && lim > c.prazoAte) return false
  // Edital sem valor não satisfaz filtro de valor ativo.
  if (c.valorMin !== undefined && (e.valorEstimado === null || e.valorEstimado < c.valorMin)) return false
  if (c.valorMax !== undefined && (e.valorEstimado === null || e.valorEstimado > c.valorMax)) return false
  if (c.q) {
    const texto = normalizar(`${e.objeto} ${e.descricao}`)
    const q = normalizar(c.q)
    if (!q.every((p) => contemParcial(texto, [p]))) return false
  }
  return true
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

/** Só lê scores já calculados e filtra: filtros nunca recalculam nota nem recuperam descartados. */
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

  const filtrados = todos.filter((i) => passaFiltros(porId.get(i.id)!, c)).sort(comparar)
  const inicio = (c.page - 1) * c.pageSize
  const itens = filtrados.slice(inicio, inicio + c.pageSize)

  let motivoVazio: MotivoVazio | null = null
  if (itens.length === 0) {
    motivoVazio = editais.length === 0 ? 'sem_editais' : todos.length === 0 ? 'todos_descartados' : 'filtros'
  }
  return { itens, page: c.page, pageSize: c.pageSize, total: filtrados.length, totalIngeridos: editais.length, motivoVazio }
}
