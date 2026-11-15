import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { acompanhamentoRepoMemoria } from '../../src/acompanhamento/memoria.js'
import { novoAcompanhamento, type AcompanhamentoRegistro, type Etapa } from '../../src/acompanhamento/modelo.js'
import { inicioDoDiaBrasilia } from '../../src/acompanhamento/rotas.js'
import { buildApp } from '../../src/app.js'
import { diaBrasilia, somarDias } from '../../src/dominio/tempo.js'
import type { Edital } from '../../src/dominio/edital.js'
import { acompanhamentoRepoFirestore, editalLeituraFirestore } from '../../src/infra/firestore-acompanhamentos.js'
import { iniciarFirebase } from '../../src/infra/firebase.js'

// Requer o emulador do Firestore (FIRESTORE_EMULATOR_HOST, ou 127.0.0.1:8080) e execução a partir de `server/`:
//   firebase emulators:exec --only firestore "npm run test:int"
// ou, com o Compose no ar: docker compose exec api npx vitest run tests/integration/acompanhamentos-firestore.test.ts
// O emulador NÃO cobra nem exige índices compostos: a conferência dos índices é feita no deploy (firestore.indexes.json).
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.GCLOUD_PROJECT ??= 'demo-licitaradar'

const rodada = Date.now().toString(36)
const EMP = `emp-int-${rodada}`
const OUTRA = `emp-int-outra-${rodada}`
const agora = new Date()
const hoje = diaBrasilia(agora)

const edital = (id: string, dias: number): Edital => ({
  id: `${id}-${rodada}`,
  objeto: `Objeto ${id}`,
  descricao: '',
  orgao: 'Órgão',
  uf: 'DF',
  municipio: null,
  modalidade: 'pregao_eletronico',
  segmento: null,
  valorEstimado: null,
  dataPublicacao: `${somarDias(hoje, -5)}T08:00:00-03:00`,
  dataLimite: `${somarDias(hoje, dias)}T15:00:00-03:00`,
})

let repo: ReturnType<typeof acompanhamentoRepoFirestore>
const idsCriados = new Set<string>()
const col = () => getFirestore().collection('acompanhamentos')

async function limpar() {
  await Promise.all([...idsCriados].map((id) => col().doc(id).delete()))
  idsCriados.clear()
}

beforeAll(() => {
  iniciarFirebase()
  repo = acompanhamentoRepoFirestore()
})
beforeEach(limpar)
afterAll(limpar)

const registro = (empresaId: string, e: Edital, etapa: Etapa = 'interessado'): AcompanhamentoRegistro => {
  const r = novoAcompanhamento(empresaId, e, agora, etapa)
  idsCriados.add(r.id)
  return r
}

describe('acompanhamentoRepoFirestore', () => {
  it('criar é idempotente: 10 chamadas ao mesmo tempo gravam um documento só', async () => {
    const r = registro(EMP, edital('a', 5))
    const resultados = await Promise.all(Array.from({ length: 10 }, () => repo.criar(r)))
    expect(resultados.filter((x) => x.criado)).toHaveLength(1)
    expect(resultados.every((x) => x.registro.id === r.id)).toBe(true)
    const snap = await col().where('empresaId', '==', EMP).get()
    expect(snap.size).toBe(1)
    // O id fica só no id do documento, não dentro dos dados.
    expect(snap.docs[0]!.data()).not.toHaveProperty('id')
  })

  it('obter devolve o registro com o id, ou null', async () => {
    const r = registro(EMP, edital('b', 5))
    await repo.criar(r)
    expect(await repo.obter(r.id)).toEqual(r)
    expect(await repo.obter('0'.repeat(32))).toBeNull()
  })

  it('atualizar grava o que `mudar` devolve; se `mudar` lança, nada é gravado; id inexistente devolve null', async () => {
    const r = registro(EMP, edital('c', 5))
    await repo.criar(r)
    const novo = await repo.atualizar(r.id, (a) => ({ ...a, etapa: 'preparando', fase: 'inicial' }))
    expect(novo?.etapa).toBe('preparando')
    expect((await repo.obter(r.id))?.etapa).toBe('preparando')
    await expect(
      repo.atualizar(r.id, () => {
        throw new Error('recusado')
      }),
    ).rejects.toThrow('recusado')
    expect((await repo.obter(r.id))?.etapa).toBe('preparando')
    expect(await repo.atualizar('0'.repeat(32), (a) => a)).toBeNull()
  })

  it('remover valida antes de apagar: se `validar` lança, o documento fica; sem documento devolve false', async () => {
    const r = registro(EMP, edital('d', 5))
    await repo.criar(r)
    await expect(
      repo.remover(r.id, () => {
        throw new Error('recusado')
      }),
    ).rejects.toThrow('recusado')
    expect(await repo.obter(r.id)).not.toBeNull()
    expect(await repo.remover(r.id, () => {})).toBe(true)
    expect(await repo.obter(r.id)).toBeNull()
    expect(await repo.remover(r.id, () => {})).toBe(false)
  })

  it('listarPagina dá o mesmo resultado que a implementação em memória, em todas as páginas e filtros', async () => {
    const dados: AcompanhamentoRegistro[] = [
      registro(EMP, edital('f1', -20), 'enviado'),
      registro(EMP, edital('f2', -3), 'resultado'),
      registro(EMP, edital('p0', 0)),
      registro(EMP, edital('p1', 2), 'preparando'),
      registro(EMP, edital('p2', 3)),
      registro(EMP, edital('p3', 9), 'enviado'),
      registro(EMP, edital('p4', 9), 'preparando'),
      registro(EMP, edital('p5', 30)),
      registro(EMP, edital('i1', -1)),
      registro(EMP, edital('i2', -9), 'preparando'),
      registro(OUTRA, edital('o1', 1)),
    ]
    for (const r of dados) await repo.criar(r)
    const memoria = acompanhamentoRepoMemoria(dados)
    const hojeInicioMs = inicioDoDiaBrasilia(agora)

    for (const etapa of [undefined, 'interessado', 'preparando', 'enviado', 'resultado'] as const) {
      for (const limit of [1, 3, 4, 100]) {
        for (let offset = 0; offset <= 12; offset += limit) {
          const consulta = { empresaId: EMP, etapa, hojeInicioMs, offset, limit }
          const [esperado, obtido] = await Promise.all([memoria.listarPagina(consulta), repo.listarPagina(consulta)])
          expect(obtido, JSON.stringify({ etapa, limit, offset })).toEqual(esperado)
        }
      }
    }
    // Sem filtro: 10 da empresa (o de OUTRA não entra), com os encerrados (i1, i2) por último.
    const tudo = await repo.listarPagina({ empresaId: EMP, hojeInicioMs, offset: 0, limit: 100 })
    expect(tudo.total).toBe(10)
    expect(tudo.itens.slice(-2).map((i) => i.titulo)).toEqual(['Objeto i2', 'Objeto i1'])
    expect(tudo.itens.slice(0, 2).map((i) => i.titulo)).toEqual(['Objeto f1', 'Objeto f2'])
  })
})

describe('API completa sobre o Firestore (emulador)', () => {
  const usuarios = {
    a: { uid: 'ua', empresaId: EMP, role: 'decisor' as const },
    b: { uid: 'ub', empresaId: OUTRA, role: 'analista' as const },
  }
  const cabecalho = (t: 'a' | 'b') => ({ authorization: `Bearer ${t}` })

  async function montar() {
    const e = edital('api', 6)
    const { id: _id, ...dados } = e
    await getFirestore().collection('editais').doc(e.id).set(dados)
    const app = buildApp({
      logger: false,
      verificarToken: async (t) => usuarios[t as 'a' | 'b'],
      definirClaims: async () => {},
      perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
      feed: { editais: async () => [], scores: async () => [] },
      certidoes: { listar: async () => [], obter: async () => null, salvar: async () => {} },
      arquivos: { salvar: async () => {} },
      acompanhamentos: { repo, editais: editalLeituraFirestore() },
    })
    return { app, e, apagarEdital: () => getFirestore().collection('editais').doc(e.id).delete() }
  }

  it('POST, GET, PATCH e DELETE de ponta a ponta, com isolamento entre empresas', async () => {
    const { app, e, apagarEdital } = await montar()
    try {
      const criado = await app.inject({ method: 'POST', url: '/v1/acompanhamentos', headers: cabecalho('a'), payload: { editalId: e.id } })
      expect(criado.statusCode).toBe(201)
      const { id } = criado.json()
      idsCriados.add(id)
      expect(criado.json()).toMatchObject({ editalId: e.id, etapa: 'interessado', titulo: 'Objeto api', diasRestantes: 6 })
      expect((await app.inject({ method: 'POST', url: '/v1/acompanhamentos', headers: cabecalho('a'), payload: { editalId: e.id } })).statusCode).toBe(200)
      expect((await app.inject({ method: 'POST', url: '/v1/acompanhamentos', headers: cabecalho('a'), payload: { editalId: 'nao-existe' } })).statusCode).toBe(404)

      const lista = await app.inject({ method: 'GET', url: '/v1/acompanhamentos', headers: cabecalho('a') })
      expect(lista.json()).toMatchObject({ total: 1, page: 1, pageSize: 20 })
      expect((await app.inject({ method: 'GET', url: '/v1/acompanhamentos', headers: cabecalho('b') })).json().total).toBe(0)

      expect((await app.inject({ method: 'PATCH', url: `/v1/acompanhamentos/${id}`, headers: cabecalho('b'), payload: { etapa: 'preparando' } })).statusCode).toBe(403)
      expect((await app.inject({ method: 'PATCH', url: `/v1/acompanhamentos/${id}`, headers: cabecalho('a'), payload: { etapa: 'enviado' } })).statusCode).toBe(422)
      expect((await app.inject({ method: 'PATCH', url: `/v1/acompanhamentos/${id}`, headers: cabecalho('a'), payload: { etapa: 'preparando' } })).json()).toMatchObject({ etapa: 'preparando' })

      expect((await app.inject({ method: 'DELETE', url: `/v1/acompanhamentos/${id}`, headers: cabecalho('b') })).statusCode).toBe(403)
      expect((await app.inject({ method: 'DELETE', url: `/v1/acompanhamentos/${id}`, headers: cabecalho('a') })).statusCode).toBe(204)
      expect((await app.inject({ method: 'DELETE', url: `/v1/acompanhamentos/${id}`, headers: cabecalho('a') })).statusCode).toBe(404)
    } finally {
      await apagarEdital()
    }
  })
})
