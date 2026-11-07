type EnvFirebase = Pick<
  ImportMetaEnv,
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_AUTH_EMULATOR_URL'
>

const OBRIGATORIAS = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID'] as const

/** Falta variável do Firebase neste ambiente: sem elas ninguém consegue entrar. */
export class ErroDeConfiguracao extends Error {
  readonly faltando: string[]

  constructor(faltando: string[]) {
    super(`Configuração do Firebase incompleta: ${faltando.join(', ')}`)
    this.name = 'ErroDeConfiguracao'
    this.faltando = faltando
  }
}

/** Os valores de demonstração só valem no emulador. Fora dele, as variáveis são obrigatórias. */
export function lerConfigFirebase(env: EnvFirebase) {
  if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY || 'demo-api-key',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || undefined,
      projectId: env.VITE_FIREBASE_PROJECT_ID || 'demo-licitaradar',
    }
  }

  const faltando = OBRIGATORIAS.filter((nome) => !env[nome])
  if (faltando.length > 0) throw new ErroDeConfiguracao(faltando)

  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
  }
}
