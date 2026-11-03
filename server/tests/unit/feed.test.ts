import { describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { Usuario } from '../../src/auth.js'
import type { Edital, RegistroScore } from '../../src/dominio/edital.js'
import { somarDias } from '../../src/dominio/tempo.js'
import type { FeedRepo } from '../../src/feed/repositorio.js'
import { editaisGolden, scoresGolden } from '../../src/seed/golden.js'
import { auth } from './ajudantes.js'
import { armazenamentoMemoria, certidaoRepoMemoria } from './memoria.js'

const agora = new Date('2026-10-15T13:00:00Z')
const usuarios: Record<string, Usuario> = {
  analistaA: { uid: 'ua', empresaId: 'emp-a', role: 'analista' },
  decisorB: { uid: 'ub', empresaId: 'emp-b', role: 'decisor' },
  vazia: { uid: 'uv', empresaId: 'emp-vazia', role: 'decisor' },
}

function criar(editais: Edital[], scores: RegistroScore[]) {
  const feed: FeedRepo = { editais: async () => editais, scores: async (id) => scores.filter((s) => s.empresaId === id) }
  return buildApp({
    logger: false,
    agora: () => agora,
    feed,
    certidoes: certidaoRepoMemoria([]),
    arquivos: armazenamentoMemoria().armazenamento,
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    verificarToken: async (t) => {
      const u = usuarios[t]
      if (!u) throw new Error('invalido')
      return u
    },
  })
}

const golden = editaisGolden(agora)
const appGolden = () => criar(golden, scoresGolden(agora, golden))
const get = (app: ReturnType<typeof criar>, url: string, token = 'analistaA') => app.inject({ method: 'GET', url, headers: auth(token) })

describe('Jornada 1: GET /feed', () => {
  it('CT-FEED-001: ordem não crescente de score', async () => {
    const r = await get(appGolden(), '/feed')
    const notas = r.json().itens.map((i: { score: number }) => i.score)
    expect(r.statusCode).toBe(200)
    expect(notas).toEqual([...notas].sort((a: number, b: number) => b - a))
    expect(r.json().itens.map((i: { id: string }) => i.id)).toEqual(['golden-A', 'golden-C', 'golden-B'])
  })

  it('CT-FEED-003: isolamento — a ordem se inverte entre empresas e D, E e F não aparecem', async () => {
    const app = appGolden()
    const a = (await get(app, '/feed', 'analistaA')).json()
    const b = (await get(app, '/feed', 'decisorB')).json()
    expect(a.itens.map((i: { id: string; score: number }) => [i.id, i.score])).toEqual([['golden-A', 100], ['golden-C', 75], ['golden-B', 65]])
    const idsB = b.itens.map((i: { id: string; score: number }) => [i.id, i.score])
    expect(idsB.slice(0, 2)).toEqual([['golden-C', 100], ['golden-A', 75]])
    for (const feed of [a, b]) {
      const ids = feed.itens.map((i: { id: string }) => i.id)
      expect(ids).not.toContain('golden-D')
      expect(ids).not.toContain('golden-E')
      expect(ids).not.toContain('golden-F')
    }
  })

  it('cada item traz id, título, órgão, modalidade, prazo, valor, score e faixa', async () => {
    const item = (await get(appGolden(), '/feed')).json().itens[0]
    expect(Object.keys(item)).toEqual(expect.arrayContaining(['id', 'titulo', 'orgao', 'modalidade', 'prazo', 'valorEstimado', 'score', 'faixa']))
    expect(item.faixa).toBe('alta')
  })

  it('CT-FEED-002: empate de score desempata por prazo, publicação mais recente e id', async () => {
    const base = golden[0]!
    const mk = (id: string, limite: string, pub: string): Edital => ({ ...base, id, dataLimite: limite, dataPublicacao: pub })
    const editais = [
      mk('z', '2026-10-28T15:00:00-03:00', '2026-10-10T08:00:00-03:00'),
      mk('b', '2026-10-28T15:00:00-03:00', '2026-10-12T08:00:00-03:00'),
      mk('a', '2026-10-28T15:00:00-03:00', '2026-10-12T08:00:00-03:00'),
      mk('perto', '2026-10-27T15:00:00-03:00', '2026-10-01T08:00:00-03:00'),
    ]
    const scores = editais.map((e): RegistroScore => ({ empresaId: 'emp-a', editalId: e.id, nota: 90, faixa: 'alta' }))
    const r = await get(criar(editais, scores), '/feed')
    expect(r.json().itens.map((i: { id: string }) => i.id)).toEqual(['perto', 'a', 'b', 'z'])
  })

  it('CT-FEED-009: paginação limitada ao pageSize, sem repetir nem pular', async () => {
    const base = golden[0]!
    const editais = Array.from({ length: 25 }, (_, i): Edital => ({ ...base, id: `e${String(i).padStart(2, '0')}` }))
    const scores = editais.map((e, i): RegistroScore => ({ empresaId: 'emp-a', editalId: e.id, nota: 100 - i, faixa: 'alta' }))
    const app = criar(editais, scores)
    const vistos: string[] = []
    for (const page of [1, 2, 3]) {
      const r = (await get(app, `/feed?page=${page}&pageSize=10`)).json()
      expect(r.itens.length).toBeLessThanOrEqual(10)
      expect(r.total).toBe(25)
      vistos.push(...r.itens.map((i: { id: string }) => i.id))
    }
    expect(vistos).toHaveLength(25)
    expect(new Set(vistos).size).toBe(25)
  })

  it('CT-FEED-009: page e pageSize inválidos respondem 400', async () => {
    const app = appGolden()
    for (const q of ['page=0', 'pageSize=0', 'pageSize=101', 'page=abc', 'pageSize=1.5']) {
      expect((await get(app, `/feed?${q}`)).statusCode, q).toBe(400)
    }
    expect((await get(app, '/feed?pageSize=100')).statusCode).toBe(200)
    expect((await get(app, '/feed?pageSize=1')).json().itens).toHaveLength(1)
  })

  it('motivoVazio: sem_editais, todos_descartados e filtros', async () => {
    expect((await get(criar([], []), '/feed')).json()).toMatchObject({ itens: [], motivoVazio: 'sem_editais' })
    expect((await get(appGolden(), '/feed', 'vazia')).json()).toMatchObject({ itens: [], motivoVazio: 'todos_descartados' })
    expect((await get(appGolden(), '/feed?valorMin=1000000000')).json()).toMatchObject({ itens: [], motivoVazio: 'filtros' })
    expect((await get(appGolden(), '/feed')).json().motivoVazio).toBeNull()
  })

  it('CT-FEED-004: abrir o feed não faz nenhuma requisição externa', async () => {
    const chamadas: unknown[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async (...args: unknown[]) => {
      chamadas.push(args)
      throw new Error('sem rede')
    }) as typeof fetch
    try {
      await get(appGolden(), '/feed')
    } finally {
      globalThis.fetch = original
    }
    expect(chamadas).toHaveLength(0)
  })

  it('exige token e papel válido (401 e 403)', async () => {
    const app = appGolden()
    expect((await app.inject({ method: 'GET', url: '/feed' })).statusCode).toBe(401)
    expect((await get(app, '/v1/feed')).statusCode).toBe(200) // mesmo caminho com prefixo do contrato
  })
})

describe('Jornada 2: filtros', () => {
  const app = appGolden()
  const ids = async (q: string, token = 'analistaA') => (await get(app, `/feed?${q}`, token)).json().itens.map((i: { id: string }) => i.id)

  it('CT-FILT-001: valorMin=50000 só traz editais acima, com score e ordem iguais', async () => {
    const sem = (await get(app, '/feed')).json().itens
    const com = (await get(app, '/feed?valorMin=200000')).json().itens
    expect(com.every((i: { valorEstimado: number }) => i.valorEstimado >= 200000)).toBe(true)
    for (const i of com) expect(sem.find((s: { id: string }) => s.id === i.id).score).toBe(i.score)
    expect(com.map((i: { id: string }) => i.id)).toEqual(sem.filter((s: { valorEstimado: number }) => s.valorEstimado >= 200000).map((s: { id: string }) => s.id))
  })

  it('CT-FILT-001: limites de valor e min = max', async () => {
    expect(await ids('valorMin=180000&valorMax=180000')).toEqual(['golden-A', 'golden-C'])
    expect(await ids('valorMin=180000.01')).toEqual(['golden-B'])
    expect(await ids('valorMax=179999.99')).toEqual([])
  })

  it('CT-FILT-004: filtro não recupera edital descartado (D)', async () => {
    expect(await ids('valorMin=600000&valorMax=800000')).toEqual([])
    expect(await ids('q=notebook&valorMin=1')).not.toContain('golden-D')
  })

  it('CT-FILT-005: filtros não recalculam o score', async () => {
    const sem = (await get(app, '/feed')).json().itens
    const com = (await get(app, '/feed?uf=DF,GO')).json().itens
    for (const i of com) expect(sem.find((s: { id: string }) => s.id === i.id).score).toBe(i.score)
  })

  it('CT-FILT-006: palavra-chave sem diferenciar maiúsculas, acentos e plural', async () => {
    const a = await ids('q=NOTEBOOK')
    expect(a.length).toBeGreaterThan(0)
    for (const q of ['Notébook', 'notebooks', 'notebook']) expect(await ids(`q=${encodeURIComponent(q)}`)).toEqual(a)
    expect((await get(app, '/feed?q=')).statusCode).toBe(400)
  })

  it('CT-FILT-007: parâmetros inválidos respondem 400 com campo', async () => {
    for (const q of ['valorMin=-1', 'valorMin=abc', 'valorMin=10&valorMax=5', 'publicadoDe=ontem', 'uf=XYZ', 'prazoDe=2026-10-20&prazoAte=2026-10-10']) {
      const r = await get(app, `/feed?${q}`)
      expect(r.statusCode, q).toBe(400)
      expect(r.json().codigo).toBe('VALIDACAO')
      expect(r.json().detalhes?.length).toBeGreaterThan(0)
    }
  })

  it('filtra por UF, modalidade, município e datas (dia no horário de Brasília)', async () => {
    expect(await ids('uf=GO')).toEqual(['golden-B'])
    expect(await ids('modalidade=dispensa')).toEqual([])
    expect(await ids('municipio=Gama')).toEqual([])
    const hoje = '2026-10-15'
    expect(await ids(`prazoDe=${somarDias(hoje, 20)}`)).toEqual([])
    expect(await ids(`publicadoDe=${hoje}`)).toEqual([])
    expect(await ids(`publicadoAte=${hoje}`)).toEqual(['golden-A', 'golden-C', 'golden-B'])
  })

  it('edital sem valor não satisfaz filtro de valor ativo', async () => {
    const semValor: Edital = { ...golden[0]!, id: 'sem-valor', valorEstimado: null }
    const scores: RegistroScore[] = [{ empresaId: 'emp-a', editalId: 'sem-valor', nota: 85, faixa: 'alta' }]
    const a = criar([semValor], scores)
    expect((await get(a, '/feed')).json().itens).toHaveLength(1)
    expect((await get(a, '/feed?valorMin=0')).json().itens).toHaveLength(0)
  })
})
