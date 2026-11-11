import { getFirestore, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore'
import type { Edital } from '../dominio/edital.js'
import type { PerfilDados } from '../perfil/schema.js'
import type { EmpresaComPerfil, IngestaoRepo } from '../ingestao/servico.js'
import { iniciarFirebase } from './firebase.js'

/** O Firestore aceita até 500 operações por lote. */
const LOTE = 400

type Operacao = (lote: WriteBatch) => void

/**
 * Editais são globais (`editais/{id}`); scores são `scores/{empresaId}_{editalId}` (mesmo formato do seed).
 * As empresas e seus perfis vêm de `empresas/{id}.perfil`.
 */
export function ingestaoRepoFirestore(): IngestaoRepo {
  iniciarFirebase()
  const db = getFirestore()

  async function emLotes<T>(itens: T[], operacao: (item: T) => Operacao) {
    for (let i = 0; i < itens.length; i += LOTE) {
      const lote = db.batch()
      for (const item of itens.slice(i, i + LOTE)) operacao(item)(lote)
      await lote.commit()
    }
  }
  const ref = (colecao: string, id: string): DocumentReference => db.collection(colecao).doc(id)

  return {
    async empresas(): Promise<EmpresaComPerfil[]> {
      const snap = await db.collection('empresas').get()
      return snap.docs.flatMap((d) => {
        const perfil = d.data().perfil as PerfilDados | undefined
        return perfil ? [{ id: d.id, perfil }] : []
      })
    },
    async gravarEditais(editais) {
      await emLotes(editais, ({ id, ...resto }: Edital) => (lote) => lote.set(ref('editais', id), resto))
    },
    async gravarScores(scores) {
      await emLotes(scores, (s) => (lote) => lote.set(ref('scores', `${s.empresaId}_${s.editalId}`), s))
    },
    async removerScores(pares) {
      await emLotes(pares, (p) => (lote) => lote.delete(ref('scores', `${p.empresaId}_${p.editalId}`)))
    },
  }
}
