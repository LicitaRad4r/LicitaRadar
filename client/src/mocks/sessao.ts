import { ErroDeLogin, type Papel, type ProvedorSessao, type Usuario } from '@/lib/sessao'

/** Mesmos usuários e senha do seed do back (server/src/seed/seed.ts), para o login simulado. */
export const USUARIOS_DEMO: Array<Usuario & { papel: Papel }> = [
  { email: 'decisor.a@licitaradar.local', papel: 'decisor', empresaId: 'emp-a' },
  { email: 'analista.a@licitaradar.local', papel: 'analista', empresaId: 'emp-a' },
  { email: 'decisor.b@licitaradar.local', papel: 'decisor', empresaId: 'emp-b' },
]
export const SENHA_DEMO = 'senha-local-123'

/**
 * Sessão simulada para a API simulada. O token é `mock:<papel>`, e o mock da API usa o papel
 * para responder 403 ao analista nas certidões. Começa logada como o decisor, para abrir direto no feed.
 */
export function criarSessaoMock(inicial: Usuario | null = USUARIOS_DEMO[0]): ProvedorSessao {
  let usuario = inicial
  const ouvintes = new Set<(u: Usuario | null) => void>()
  const avisar = () => ouvintes.forEach((ouvinte) => ouvinte(usuario))

  return {
    observar(aoMudar) {
      ouvintes.add(aoMudar)
      aoMudar(usuario)
      return () => ouvintes.delete(aoMudar)
    },
    async entrar(email, senha) {
      const encontrado = USUARIOS_DEMO.find((u) => u.email === email.trim().toLowerCase())
      if (!encontrado || senha !== SENHA_DEMO) throw new ErroDeLogin('E-mail ou senha incorretos.')
      usuario = encontrado
      avisar()
      return encontrado
    },
    async sair() {
      usuario = null
      avisar()
    },
    token: async () => (usuario ? `mock:${usuario.papel ?? 'sem-papel'}` : null),
    renovar: async () => {},
  }
}
