import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Usuario } from './sessao'

type Ouvinte = (user: unknown) => void

const firebase = vi.hoisted(() => ({
  ouvinte: null as ((user: unknown) => void) | null,
  parar: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  FirebaseError: class extends Error {},
  initializeApp: vi.fn(() => ({})),
}))

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({})),
  onIdTokenChanged: vi.fn((_auth: unknown, ouvinte: Ouvinte) => {
    firebase.ouvinte = ouvinte
    return firebase.parar
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

function adiado<T>() {
  let resolver!: (valor: T) => void
  let rejeitar!: (erro: unknown) => void
  const promessa = new Promise<T>((res, rej) => {
    resolver = res
    rejeitar = rej
  })
  return { promessa, resolver, rejeitar }
}

const tokenDe = (role: string) => ({ claims: { role, empresaId: 'empresa-a' } })

function usuarioFirebase(email: string, getIdTokenResult: () => Promise<unknown>) {
  return { email, getIdTokenResult }
}

const usuario = (email: string, papel: Usuario['papel']): Usuario => ({ email, papel, empresaId: 'empresa-a' })

/** Deixa as promessas já resolvidas terminarem. */
const esperarRespostas = () => new Promise((resolve) => setTimeout(resolve))

async function observar() {
  vi.stubEnv('VITE_FIREBASE_AUTH_EMULATOR_URL', 'http://localhost:9099')
  const { sessaoFirebase } = await import('./firebase')
  const aoMudar = vi.fn()
  const parar = sessaoFirebase.observar(aoMudar)
  return { aoMudar, parar, mudarToken: firebase.ouvinte! }
}

describe('sessaoFirebase.observar', () => {
  beforeEach(() => {
    vi.resetModules()
    firebase.parar.mockClear()
  })

  it('publica o usuário com papel e empresa do token', async () => {
    const { aoMudar, mudarToken } = await observar()

    mudarToken(usuarioFirebase('decisor@a.com', () => Promise.resolve(tokenDe('decisor'))))
    await esperarRespostas()

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith(usuario('decisor@a.com', 'decisor'))
  })

  it('se a leitura do token falha, publica sem sessão em vez de deixar a tela carregando', async () => {
    const { aoMudar, mudarToken } = await observar()

    mudarToken(usuarioFirebase('decisor@a.com', () => Promise.reject(new Error('falhou'))))
    await esperarRespostas()

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('resposta atrasada não traz de volta a sessão de quem já saiu', async () => {
    const { aoMudar, mudarToken } = await observar()
    const token = adiado<unknown>()

    mudarToken(usuarioFirebase('decisor@a.com', () => token.promessa))
    mudarToken(null)
    token.resolver(tokenDe('decisor'))
    await esperarRespostas()

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('resposta atrasada não sobrescreve a do token mais novo', async () => {
    const { aoMudar, mudarToken } = await observar()
    const antigo = adiado<unknown>()

    mudarToken(usuarioFirebase('decisor@a.com', () => antigo.promessa))
    mudarToken(usuarioFirebase('analista@a.com', () => Promise.resolve(tokenDe('analista'))))
    await esperarRespostas()
    antigo.resolver(tokenDe('decisor'))
    await esperarRespostas()

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith(usuario('analista@a.com', 'analista'))
  })

  it('falha atrasada não derruba a sessão do token mais novo', async () => {
    const { aoMudar, mudarToken } = await observar()
    const antigo = adiado<unknown>()

    mudarToken(usuarioFirebase('decisor@a.com', () => antigo.promessa))
    mudarToken(usuarioFirebase('analista@a.com', () => Promise.resolve(tokenDe('analista'))))
    await esperarRespostas()
    antigo.rejeitar(new Error('falhou'))
    await esperarRespostas()

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith(usuario('analista@a.com', 'analista'))
  })

  it('depois de parar de ouvir, ignora a resposta pendente', async () => {
    const { aoMudar, parar, mudarToken } = await observar()
    const token = adiado<unknown>()

    mudarToken(usuarioFirebase('decisor@a.com', () => token.promessa))
    parar()
    token.resolver(tokenDe('decisor'))
    await esperarRespostas()

    expect(firebase.parar).toHaveBeenCalledOnce()
    expect(aoMudar).not.toHaveBeenCalled()
  })
})
