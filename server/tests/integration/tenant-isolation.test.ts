import {readFileSync} from 'node:fs'
import {describe, test, beforeAll, beforeEach, afterAll} from 'vitest'
import {
    initializeTestEnvironment,
    assertSucceeds,
    assertFails,
    RulesTestEnvironment
} from '@firebase/rules-unit-testing'
import {doc, getDoc, updateDoc, setDoc} from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'demo-licitaradar',
        firestore: {
            host: '127.0.0.1',
            port: 8080,
            rules: readFileSync('../firestore.rules', 'utf8')
        }
    })
})

beforeEach(async () => {
    await testEnv.clearFirestore()

    await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore()
    
    // Documento da Empresa A
    await setDoc(doc(adminDb, 'certidoes', 'cert-empresa-A'), {
      empresaId: 'empresa-A',
      status: 'regular'
    })

    // Documento da Empresa B
    await setDoc(doc(adminDb, 'certidoes', 'cert-empresa-B'), {
      empresaId: 'empresa-B',
      status: 'vencida'
    })
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('CT-AUTH-001 / CT-AUTH-002: Isolamento de Tenant (Multi-empresa)', () => {
  test('usuário autenticado da Empresa A consegue ler seus dados e é barrado ao ler dados da Empresa B', async () => {
    const userContextA = testEnv.authenticatedContext('user-a', {
      empresaId: 'empresa-A'
    }).firestore()

    // 1. Deve ter sucesso ao ler o documento da própria Empresa A
    await assertSucceeds(getDoc(doc(userContextA, 'certidoes', 'cert-empresa-A')))

    // 2. Deve falhar (ao tentar ler o documento da Empresa B
    await assertFails(getDoc(doc(userContextA, 'certidoes', 'cert-empresa-B')))
  })

  test('usuário da Empresa A NÃO pode alterar dados da Empresa B', async () => {
    const userContextA = testEnv.authenticatedContext('user-a', {
      empresaId: 'empresa-A'
    }).firestore()

    // Tenta atualizar a certidão da Empresa B logado como Empresa A -> Deve falhar
    await assertFails(
      updateDoc(doc(userContextA, 'certidoes', 'cert-empresa-B'), {
        status: 'regular'
      })
    )
  })
})




