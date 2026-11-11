import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import { descreverErro } from '../../src/erros.js'

/** Revisão do QA: o log de erro 500 não pode vazar dado (mensagens do Firestore trazem o caminho do documento). */
const CAMINHO = 'projects/licitaradar/databases/(default)/documents/certidoes/cert-a-1'

function criar(linhas: string[]) {
  const logStream = new Writable({
    write(chunk, _e, cb) {
      linhas.push(String(chunk))
      cb()
    },
  })
  return buildApp({
    logger: false,
    logStream,
    feed: { editais: async () => [], scores: async () => [] },
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    certidoes: {
      listar: async () => {
        throw Object.assign(new Error(`5 NOT_FOUND: No document to update: ${CAMINHO}`), { name: 'FirebaseError', code: 5 })
      },
      obter: async () => null,
      salvar: async () => {},
    },
    arquivos: { salvar: async () => {} },
    verificarToken: async () => ({ uid: 'u-dec-a', empresaId: 'emp-a', role: 'decisor' as const }),
  })
}

describe('log de erro inesperado (500)', () => {
  it('responde 500 genérico e loga tipo, código e pilha, sem a mensagem do erro', async () => {
    const linhas: string[] = []
    const r = await criar(linhas).inject({ method: 'GET', url: '/v1/certidoes', headers: { authorization: 'Bearer t' } })
    expect(r.statusCode).toBe(500)
    expect(r.json()).toEqual({ codigo: 'ERRO_INTERNO', mensagem: 'Erro interno.', requestId: expect.any(String) })
    expect(r.body).not.toContain('cert-a-1')

    expect(linhas.join('')).not.toContain(CAMINHO)
    expect(linhas.join('')).not.toContain('cert-a-1')
    expect(linhas.join('')).not.toContain('NOT_FOUND')
    const registro = linhas.map((l) => JSON.parse(l)).find((l) => l.msg === 'erro inesperado')
    expect(registro).toMatchObject({ route: '/v1/certidoes', status: 500, erro: 'FirebaseError', codigo: 5, requestId: expect.any(String) })
    expect(registro.pilha.length).toBeGreaterThan(0)
    expect(registro.pilha.every((l: string) => l.startsWith('at '))).toBe(true)
  })

  it('descreverErro: aceita valor que não é Error e usa status quando não há código', () => {
    expect(descreverErro('texto solto com segredo')).toMatchObject({ erro: 'Error' })
    expect(JSON.stringify(descreverErro('texto solto com segredo'))).not.toContain('segredo')
    expect(descreverErro(Object.assign(new Error('x'), { status: 503 }))).toMatchObject({ codigo: 503 })
  })
})

describe('erros 4xx do Fastify (413, 415, 429)', () => {
  it('saem como VALIDACAO 400, como o contrato documenta (só 400, "sem 413")', async () => {
    const app = criar([])
    const h = { authorization: 'Bearer t' }
    const tipo = await app.inject({ method: 'PUT', url: '/v1/perfil', headers: { ...h, 'content-type': 'text/plain' }, payload: 'x' })
    expect(tipo.statusCode).toBe(400) // 415 do Fastify
    expect(tipo.json().codigo).toBe('VALIDACAO')
    const grande = await app.inject({ method: 'PUT', url: '/v1/perfil', headers: { ...h, 'content-type': 'application/json' }, payload: JSON.stringify({ termosChave: ['a'.repeat(2_000_000)] }) })
    expect(grande.statusCode).toBe(400) // 413 do Fastify
    expect(grande.json().codigo).toBe('VALIDACAO')
  })
})
