import { armazenamentoMemoria, certidaoRepoMemoria } from './memoria.js'
import { buildApp } from '../../src/app.js'
import type { Usuario } from '../../src/auth.js'
import type { PerfilRepo } from '../../src/perfil/repositorio.js'
import type { PerfilDados } from '../../src/perfil/schema.js'

/** Tokens de teste: o próprio texto do token é a chave em `usuarios`. */
export function criarApp(usuarios: Record<string, Usuario>) {
  const empresas = new Map<string, PerfilDados>()
  const claims: Array<{ uid: string; empresaId: string; role: string }> = []
  let seq = 0
  const perfis: PerfilRepo = {
    async ler(id) {
      return empresas.get(id) ?? null
    },
    async salvar(id, p) {
      empresas.set(id, p)
    },
    async criar(p) {
      const id = `emp-${++seq}`
      empresas.set(id, p)
      return id
    },
  }
  const app = buildApp({
    logger: false,
    feed: { editais: async () => [], scores: async () => [] },
    perfis,
    certidoes: certidaoRepoMemoria([]),
    arquivos: armazenamentoMemoria().armazenamento,
    verificarToken: async (t) => {
      const u = usuarios[t]
      if (!u) throw new Error('token inválido')
      return u
    },
    definirClaims: async (uid, c) => {
      claims.push({ uid, ...c })
    },
  })
  return { app, empresas, claims }
}

export const auth = (t: string) => ({ authorization: `Bearer ${t}` })
