/**
 * CT-SEG-010 — Cliente do Firebase: leitura e escrita direta no Firestore
 * devem ser negadas pelas Security Rules (deny-all).
 *
 * O acesso legítimo aos dados é só pela API (Admin SDK), que ignora as rules.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'demo-licitaradar'
const RULES_PATH = resolve(__dirname, '../../firestore.rules')

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const [host, portText] = emulatorHost.split(':')
const port = Number(portText ?? 8080)

// Garante que o SDK do cliente aponte ao emulador, nunca à nuvem.
process.env.FIRESTORE_EMULATOR_HOST = emulatorHost

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host,
      port,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('CT-SEG-010 — Security Rules deny-all', () => {
  it('nega leitura sem autenticação', async () => {
    const ctx = testEnv.unauthenticatedContext()
    await assertFails(getDoc(doc(ctx.firestore(), 'editais/edital-a')))
  })

  it('nega escrita sem autenticação', async () => {
    const ctx = testEnv.unauthenticatedContext()
    await assertFails(
      setDoc(doc(ctx.firestore(), 'editais/edital-a'), { titulo: 'x' }),
    )
  })

  it('nega leitura mesmo autenticado (cliente não lê direto)', async () => {
    const ctx = testEnv.authenticatedContext('user-analista', {
      orgId: 'empresa-a',
      role: 'analista',
    })
    await assertFails(getDoc(doc(ctx.firestore(), 'editais/edital-a')))
  })

  it('nega escrita mesmo autenticado (cliente não grava direto)', async () => {
    const ctx = testEnv.authenticatedContext('user-decisor', {
      orgId: 'empresa-a',
      role: 'decisor',
    })
    await assertFails(
      setDoc(doc(ctx.firestore(), 'certidoes/cert-1'), { nome: 'FGTS' }),
    )
  })
})
