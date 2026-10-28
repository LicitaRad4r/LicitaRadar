import { readFileSync } from 'node:fs'
import { describe, test, beforeAll, beforeEach, afterAll } from 'vitest'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore'

// Requer o emulador do Firestore em 127.0.0.1:8080 e execução a partir de server/
// (ex.: firebase emulators:exec --only firestore "npm run test:int")
let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-licitaradar',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('../firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'certidoes', 'cert-A'), { empresaId: 'empresa-A', status: 'regular' })
    await setDoc(doc(db, 'certidoes', 'cert-B'), { empresaId: 'empresa-B', status: 'vencida' })
    await setDoc(doc(db, 'editais', 'ed-1'), { titulo: 'Notebooks' })
    await setDoc(doc(db, 'scores', 'sc-1'), { empresaId: 'empresa-A', nota: 80 })
  })
})

afterAll(async () => { await env?.cleanup() })

const clientes = {
  'sem login': () => env.unauthenticatedContext().firestore(),
  'logado sem claim empresaId': () => env.authenticatedContext('u0').firestore(),
  'decisor da empresa A': () => env.authenticatedContext('u1', { empresaId: 'empresa-A', role: 'decisor' }).firestore(),
  'analista da empresa A': () => env.authenticatedContext('u2', { empresaId: 'empresa-A', role: 'analista' }).firestore(),
}

describe('CT-SEG-010: leitura e escrita direta no Firestore são negadas (deny-all)', () => {
  for (const [quem, db] of Object.entries(clientes)) {
    describe(quem, () => {
      test('não lê o próprio documento', async () => {
        await assertFails(getDoc(doc(db(), 'certidoes', 'cert-A')))
      })
      test('não lê documento de outra empresa', async () => {
        await assertFails(getDoc(doc(db(), 'certidoes', 'cert-B')))
      })
      test('não lista a coleção, nem com filtro pelo próprio tenant', async () => {
        await assertFails(getDocs(collection(db(), 'certidoes')))
        await assertFails(getDocs(query(collection(db(), 'certidoes'), where('empresaId', '==', 'empresa-A'))))
      })
      test('não cria, atualiza nem apaga', async () => {
        await assertFails(setDoc(doc(db(), 'certidoes', 'nova'), { empresaId: 'empresa-A' }))
        await assertFails(updateDoc(doc(db(), 'certidoes', 'cert-A'), { status: 'vencida' }))
        await assertFails(deleteDoc(doc(db(), 'certidoes', 'cert-A')))
      })
      test('não acessa outras coleções (editais, scores, usuarios)', async () => {
        await assertFails(getDoc(doc(db(), 'editais', 'ed-1')))
        await assertFails(getDoc(doc(db(), 'scores', 'sc-1')))
        await assertFails(setDoc(doc(db(), 'usuarios', 'u1'), { role: 'decisor' }))
      })
    })
  }

  test('os dados continuam intactos depois das tentativas negadas', async () => {
    const db = clientes['decisor da empresa A']()
    await assertFails(updateDoc(doc(db, 'certidoes', 'cert-B'), { status: 'regular' }))
    await assertFails(deleteDoc(doc(db, 'certidoes', 'cert-B')))
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await assertSucceeds(getDoc(doc(ctx.firestore(), 'certidoes', 'cert-B')))
      if (snap.data()?.status !== 'vencida') throw new Error('certidão da empresa B foi alterada')
    })
  })
})