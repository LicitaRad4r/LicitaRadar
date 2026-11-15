import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O Firestore e a inicialização do Admin SDK são simulados: o teste cobre a lógica de `verificarFirestore`
// (resposta, falha, timeout e credencial ausente), sem emulador e sem rede.
const get = vi.fn()
const limit = vi.fn(() => ({ get }))
const collection = vi.fn(() => ({ limit }))
const iniciarFirebase = vi.fn()

vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection }) }))
vi.mock('../../src/infra/firebase.js', () => ({ iniciarFirebase: () => iniciarFirebase() }))

const { verificarFirestore } = await import('../../src/infra/prontidao.js')
const { buildApp } = await import('../../src/app.js')

beforeEach(() => {
  vi.clearAllMocks()
  iniciarFirebase.mockReturnValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('verificarFirestore (base do /readyz)', () => {
  it('resolve quando o Firestore responde e lê no máximo 1 documento de `editais`', async () => {
    get.mockResolvedValue({ docs: [] })
    await expect(verificarFirestore()).resolves.toBeUndefined()
    expect(collection).toHaveBeenCalledWith('editais')
    expect(limit).toHaveBeenCalledWith(1)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('rejeita quando o Firestore falha (ex.: emulador fora do ar)', async () => {
    get.mockRejectedValue(new Error('14 UNAVAILABLE: connect ECONNREFUSED'))
    await expect(verificarFirestore()).rejects.toThrow('UNAVAILABLE')
  })

  it('rejeita com "timeout" quando o Firestore não responde em 3 s', async () => {
    vi.useFakeTimers()
    get.mockReturnValue(new Promise(() => {})) // nunca responde
    const resultado = verificarFirestore()
    const falha = expect(resultado).rejects.toThrow('timeout')
    await vi.advanceTimersByTimeAsync(2_999)
    // Ainda dentro do prazo: continua pendente.
    let encerrou = false
    resultado.catch(() => (encerrou = true))
    await vi.advanceTimersByTimeAsync(0)
    expect(encerrou).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await falha
  })

  it('rejeita sem consultar o Firestore quando a credencial não é válida (iniciarFirebase lança)', async () => {
    iniciarFirebase.mockImplementation(() => {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválida: use o JSON completo da conta de serviço.')
    })
    await expect(verificarFirestore()).rejects.toThrow('inválida')
    expect(get).not.toHaveBeenCalled()
  })
})

describe('/readyz com o verificarFirestore real', () => {
  const base = {
    logger: false as const,
    feed: { editais: async () => [], scores: async () => [] },
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    certidoes: { listar: async () => [], obter: async () => null, salvar: async () => {} },
    arquivos: { salvar: async () => {} },
    verificarToken: async () => {
      throw new Error('invalido')
    },
    prontidao: verificarFirestore,
  }

  it('200 {"status":"ready"} quando o Firestore responde', async () => {
    get.mockResolvedValue({ docs: [] })
    const r = await buildApp(base).inject({ method: 'GET', url: '/readyz' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ status: 'ready' })
  })

  it('503 {"status":"unavailable"} quando o Firestore falha, sem vazar o motivo; /healthz segue 200', async () => {
    get.mockRejectedValue(new Error('14 UNAVAILABLE: connect ECONNREFUSED firebase:8080'))
    const app = buildApp(base)
    const r = await app.inject({ method: 'GET', url: '/readyz' })
    expect(r.statusCode).toBe(503)
    expect(r.json()).toEqual({ status: 'unavailable' })
    expect(r.body).not.toMatch(/ECONNREFUSED|firebase:8080|UNAVAILABLE: /)
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200)
  })

  it('503 sem vazar nada quando a credencial é inválida', async () => {
    iniciarFirebase.mockImplementation(() => {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválida: ...')
    })
    const r = await buildApp(base).inject({ method: 'GET', url: '/readyz' })
    expect(r.statusCode).toBe(503)
    expect(r.json()).toEqual({ status: 'unavailable' })
    expect(r.body).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON')
  })
})
