import { getFirestore } from 'firebase-admin/firestore'
import type { CertidaoRegistro, CertidaoRepo } from '../certidoes/repositorio.js'
import { iniciarFirebase } from './firebase.js'

/** Coleção `certidoes`, com o campo `empresaId` (nunca listamos sem filtrar por ele). */
export function certidaoRepoFirestore(): CertidaoRepo {
  iniciarFirebase()
  const col = getFirestore().collection('certidoes')
  const dePara = (id: string, d: FirebaseFirestore.DocumentData): CertidaoRegistro => ({ ...(d as Omit<CertidaoRegistro, 'id'>), id })
  return {
    async listar(empresaId) {
      const snap = await col.where('empresaId', '==', empresaId).get()
      return snap.docs.map((d) => dePara(d.id, d.data()))
    },
    async obter(id) {
      const d = await col.doc(id).get()
      return d.exists ? dePara(d.id, d.data()!) : null
    },
    async salvar({ id, ...resto }) {
      await col.doc(id).set(resto)
    },
  }
}
