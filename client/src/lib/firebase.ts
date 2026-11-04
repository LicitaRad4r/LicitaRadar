import { FirebaseError, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { ErroDeLogin, type Papel, type ProvedorSessao, type Usuario } from './sessao'

/**
 * Firebase no front: só Auth. Os dados vêm sempre da API
 * (as regras do Firestore bloqueiam leitura direta pelo navegador).
 */
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-licitaradar',
})

const auth = getAuth(app)

const emulador = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL
if (emulador) {
  connectAuthEmulator(auth, emulador, { disableWarnings: true })
}

/** Empresa e papel vêm dos claims do token. O back aceita `empresaId` ou `orgId` (CT-SEG-004). */
async function paraUsuario(user: User): Promise<Usuario> {
  const { claims } = await user.getIdTokenResult()
  const papel = claims.role === 'decisor' || claims.role === 'analista' ? (claims.role as Papel) : null
  const empresa = claims.empresaId ?? claims.orgId
  return { email: user.email ?? '', papel, empresaId: typeof empresa === 'string' ? empresa : null }
}

function mensagemDeLogin(erro: unknown) {
  const codigo = erro instanceof FirebaseError ? erro.code : ''
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(codigo)) {
    return 'E-mail ou senha incorretos.'
  }
  if (codigo === 'auth/too-many-requests') return 'Muitas tentativas seguidas. Espere um pouco e tente novamente.'
  if (codigo === 'auth/network-request-failed') return 'Sem conexão com o serviço de login. Verifique a internet.'
  return 'Não foi possível entrar agora. Tente novamente.'
}

export const sessaoFirebase: ProvedorSessao = {
  // onIdTokenChanged também avisa quando o token é renovado, e assim empresa e papel novos aparecem na tela.
  observar: (aoMudar) =>
    onIdTokenChanged(auth, (user) => {
      if (!user) return aoMudar(null)
      void paraUsuario(user).then(aoMudar)
    }),
  async entrar(email, senha) {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, senha)
      return paraUsuario(user)
    } catch (erro) {
      throw new ErroDeLogin(mensagemDeLogin(erro))
    }
  },
  sair: () => signOut(auth),
  async token() {
    await auth.authStateReady()
    // O SDK renova o token sozinho quando expira.
    return auth.currentUser ? auth.currentUser.getIdToken() : null
  },
  async renovar() {
    await auth.authStateReady()
    await auth.currentUser?.getIdToken(true)
  },
}
