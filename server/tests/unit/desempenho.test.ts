import { describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { Usuario } from '../../src/auth.js'
import type { FeedRepo } from '../../src/feed/repositorio.js'
import { editaisGolden, scoresGolden } from '../../src/seed/golden.js'
import { auth } from './ajudantes.js'
import { armazenamentoMemoria, certidaoRepoMemoria } from './memoria.js'

const agora = new Date('2026-10-15T13:00:00Z')
const usuario: Usuario = { uid: 'ua', empresaId: 'emp-a', role: 'analista' }
const golden = editaisGolden(agora)
const scores = scoresGolden(agora, golden)

function appGolden() {
  const feed: FeedRepo = { editais: async () => golden, scores: async (id) => scores.filter((s) => s.empresaId === id) }
  return buildApp({
    logger: false,
    agora: () => agora,
    feed,
    certidoes: certidaoRepoMemoria([]),
    arquivos: armazenamentoMemoria().armazenamento,
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    verificarToken: async () => usuario,
  })
}

const p95 = (amostras: number[]) => [...amostras].sort((a, b) => a - b)[Math.ceil(amostras.length * 0.95) - 1]

describe('Desempenho do feed (RNF03)', () => {
  it('CT-FILT-009: p95 de GET /feed com o seed fica em no máximo 800 ms (200 amostras)', async () => {
    const app = appGolden()
    await app.inject({ method: 'GET', url: '/feed', headers: auth('t') }) // aquecimento
    const amostras: number[] = []
    for (let i = 0; i < 200; i++) {
      const inicio = performance.now()
      const r = await app.inject({ method: 'GET', url: '/feed?uf=DF', headers: auth('t') })
      amostras.push(performance.now() - inicio)
      expect(r.statusCode).toBe(200)
    }
    expect(p95(amostras)).toBeLessThanOrEqual(800)
  })
})
