import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import type { VerificarToken } from '../auth.js'
import type { DefinirClaims, PerfilRepo } from '../perfil/repositorio.js'
import type { PerfilDados } from '../perfil/schema.js'

/**
 * Com FIREBASE_AUTH_EMULATOR_HOST e FIRESTORE_EMULATOR_HOST definidos (docker compose),
 * o Admin SDK usa os emuladores sozinho, sem credenciais.
 */
export function iniciarFirebase() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.GCLOUD_PROJECT ?? 'demo-licitaradar',
      ...(process.env.FIREBASE_AUTH_EMULATOR_HOST ? {} : { credential: applicationDefault() }),
    })
  }
}

export const verificarTokenFirebase: VerificarToken = async (token) => {
  iniciarFirebase()
  const d = await getAuth().verifyIdToken(token)
  const role = d.role === 'decisor' || d.role === 'analista' ? d.role : undefined
  const empresaId = typeof d.empresaId === 'string' ? d.empresaId : undefined
  return { uid: d.uid, empresaId, role }
}

export const definirClaimsFirebase: DefinirClaims = async (uid, claims) => {
  iniciarFirebase()
  await getAuth().setCustomUserClaims(uid, claims)
}

export function perfilRepoFirestore(): PerfilRepo {
  iniciarFirebase()
  const empresas = getFirestore().collection('empresas')
  return {
    async ler(empresaId) {
      const doc = await empresas.doc(empresaId).get()
      return doc.exists ? ((doc.data()?.perfil as PerfilDados | undefined) ?? null) : null
    },
    async salvar(empresaId, perfil) {
      await empresas.doc(empresaId).set({ perfil }, { merge: true })
    },
    async criar(perfil) {
      const ref = empresas.doc()
      await ref.set({ perfil, criadaEm: new Date().toISOString() })
      return ref.id
    },
  }
}
