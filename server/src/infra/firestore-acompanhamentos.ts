import { getFirestore } from 'firebase-admin/firestore'
import type { AcompanhamentoRegistro, Faixa } from '../acompanhamento/modelo.js'
import { faixasDaConsulta } from '../acompanhamento/modelo.js'
import type { AcompanhamentoRepo, ConsultaLista, EditalLeitura } from '../acompanhamento/repositorio.js'
import type { Edital } from '../dominio/edital.js'
import { iniciarFirebase } from './firebase.js'

type Consulta = FirebaseFirestore.Query

/**
 * Coleção `acompanhamentos` (doc id = hash de empresa + edital, ver `idDoAcompanhamento`), sempre filtrada por `empresaId`.
 *
 * A listagem corta a lista em faixas (ver `modelo.ts`) e cada faixa é uma consulta ordenada por `prazoEm`
 * (empate pelo id do documento, que o Firestore já usa). Índices compostos em `firestore.indexes.json`.
 * Lê só a página pedida: o total vem de `count()` (agregação, não lê os documentos) e as faixas antes da página
 * só entram como `offset`.
 */
export function acompanhamentoRepoFirestore(): AcompanhamentoRepo {
  iniciarFirebase()
  const db = getFirestore()
  const col = db.collection('acompanhamentos')
  const dePara = (id: string, d: FirebaseFirestore.DocumentData): AcompanhamentoRegistro => ({ ...(d as Omit<AcompanhamentoRegistro, 'id'>), id })

  const faixaConsulta = (faixa: Faixa, { empresaId, etapa, hojeInicioMs }: ConsultaLista): Consulta => {
    let q: Consulta = col.where('empresaId', '==', empresaId)
    if (etapa) q = q.where('etapa', '==', etapa)
    if (faixa === 'em_prazo') return q.where('prazoEm', '>=', hojeInicioMs).orderBy('prazoEm')
    if (!etapa) q = q.where('fase', '==', faixa === 'finais_vencidos' ? 'final' : 'inicial')
    return q.where('prazoEm', '<', hojeInicioMs).orderBy('prazoEm')
  }

  return {
    async obter(id) {
      const d = await col.doc(id).get()
      return d.exists ? dePara(d.id, d.data()!) : null
    },
    async criar(novo) {
      const ref = col.doc(novo.id)
      return db.runTransaction(async (tx) => {
        const atual = await tx.get(ref)
        if (atual.exists) return { registro: dePara(atual.id, atual.data()!), criado: false }
        const { id: _id, ...resto } = novo
        tx.set(ref, resto)
        return { registro: novo, criado: true }
      })
    },
    async atualizar(id, mudar) {
      const ref = col.doc(id)
      return db.runTransaction(async (tx) => {
        const atual = await tx.get(ref)
        if (!atual.exists) return null
        const novo = mudar(dePara(atual.id, atual.data()!))
        const { id: _id, ...resto } = novo
        tx.set(ref, resto)
        return novo
      })
    },
    async remover(id, validar) {
      const ref = col.doc(id)
      return db.runTransaction(async (tx) => {
        const atual = await tx.get(ref)
        if (!atual.exists) return false
        validar(dePara(atual.id, atual.data()!))
        tx.delete(ref)
        return true
      })
    },
    async listarPagina(consulta) {
      const faixas = faixasDaConsulta(consulta.etapa).map((f) => faixaConsulta(f, consulta))
      const totais = await Promise.all(faixas.map(async (q) => (await q.count().get()).data().count))
      const itens: AcompanhamentoRegistro[] = []
      let pular = consulta.offset
      let falta = consulta.limit
      for (const [i, q] of faixas.entries()) {
        const total = totais[i]!
        if (pular >= total) {
          pular -= total
          continue
        }
        const snap = await q.offset(pular).limit(falta).get()
        itens.push(...snap.docs.map((d) => dePara(d.id, d.data())))
        falta -= snap.size
        pular = 0
        if (falta <= 0) break
      }
      return { itens, total: totais.reduce((a, b) => a + b, 0) }
    },
  }
}

/** Leitura de um documento de `editais` (globais), só para copiar os dados ao criar o acompanhamento. */
export function editalLeituraFirestore(): EditalLeitura {
  iniciarFirebase()
  const col = getFirestore().collection('editais')
  return {
    async obter(id) {
      const d = await col.doc(id).get()
      return d.exists ? ({ ...(d.data() as Omit<Edital, 'id'>), id: d.id } as Edital) : null
    },
  }
}
