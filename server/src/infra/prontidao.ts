import { getFirestore } from 'firebase-admin/firestore'
import { iniciarFirebase } from './firebase.js'

const TIMEOUT_MS = 3_000

/** `/readyz`: a API só está pronta se o Firestore responde. Lança erro se não responder a tempo. */
export async function verificarFirestore(): Promise<void> {
  iniciarFirebase()
  await Promise.race([
    getFirestore().collection('editais').limit(1).get(),
    new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error('timeout')), TIMEOUT_MS).unref()),
  ])
}
