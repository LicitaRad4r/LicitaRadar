import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

/**
 * Firebase no front: só Auth. Os dados vêm sempre da API
 * (as regras do Firestore bloqueiam leitura direta pelo navegador).
 */
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-licitaradar',
})

export const auth = getAuth(app)

const emulador = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL
if (emulador) {
  connectAuthEmulator(auth, emulador, { disableWarnings: true })
}

/** ID token do usuário logado, ou null se ninguém entrou ainda. O SDK renova sozinho quando expira. */
export async function obterTokenFirebase() {
  await auth.authStateReady()
  return auth.currentUser ? auth.currentUser.getIdToken() : null
}
