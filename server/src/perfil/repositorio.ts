import type { PerfilDados } from './schema.js'

/** Acesso ao perfil das empresas. A implementação real usa o Firestore (Admin SDK). */
export interface PerfilRepo {
  ler(empresaId: string): Promise<PerfilDados | null>
  salvar(empresaId: string, perfil: PerfilDados): Promise<void>
  /** Cria a empresa com o perfil e devolve o empresaId. */
  criar(perfil: PerfilDados): Promise<string>
}

/** Claims gravados no usuário (Firebase Auth). */
export type DefinirClaims = (uid: string, claims: { empresaId: string; role: 'decisor' | 'analista' }) => Promise<void>
