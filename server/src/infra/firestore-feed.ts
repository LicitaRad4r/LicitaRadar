import { getFirestore } from 'firebase-admin/firestore'
import type { Edital, RegistroScore } from '../dominio/edital.js'
import type { FeedRepo } from '../feed/repositorio.js'
import { iniciarFirebase } from './firebase.js'

/** Editais são globais (`editais`); scores são por empresa (`scores`, campo `empresaId`). */
export function feedRepoFirestore(): FeedRepo {
  iniciarFirebase()
  const db = getFirestore()
  return {
    async editais() {
      const snap = await db.collection('editais').get()
      return snap.docs.map((d) => ({ ...(d.data() as Omit<Edital, 'id'>), id: d.id }))
    },
    async scores(empresaId) {
      const snap = await db.collection('scores').where('empresaId', '==', empresaId).get()
      return snap.docs.map((d) => d.data() as RegistroScore)
    },
  }
}
