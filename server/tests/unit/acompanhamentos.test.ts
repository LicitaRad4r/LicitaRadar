import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import { acompanhamentoRepoMemoria, editaisEmMemoria } from '../../src/acompanhamento/memoria.js'
import { ETAPAS, faixaDe, idDoAcompanhamento, transicaoPermitida, type Etapa } from '../../src/acompanhamento/modelo.js'
import { inicioDoDiaBrasilia } from '../../src/acompanhamento/rotas.js'
import type { AcompanhamentoRepo } from '../../src/acompanhamento/repositorio.js'
import type { Usuario } from '../../src/auth.js'
import type { Edital } from '../../src/dominio/edital.js'
import { acompanhamentosGolden, editaisGolden } from '../../src/seed/golden.js'
import { auth } from './ajudantes.js'
import { armazenamentoMemoria, certidaoRepoMemoria } from './memoria.js'

// 15/10/2026 10:00 em Brasília (quinta-feira)
const agora = new Date('2026-10-15T13:00:00Z')
const usuarios: Record<string, Usuario> = {
  decisorA: { uid: 'da', empresaId: 'emp-a', role: 'decisor' },
  analistaA: { uid: 'aa', empresaId: 'emp-a', role: 'analista' },
  decisorB: { uid: 'db', empresaId: 'emp-b', role: 'decisor' },
  semEmpresa: { uid: 'sx' },
}

/** Edital de teste com o prazo em `dataLimite` (ISO com fuso). */
const edital = (id: string, dataLimite: string, extra: Partial<Edital> = {}): Edital => ({
  id,
  objeto: `Objeto ${id}`,
  descricao: '',
  orgao: `Órgão ${id}`,
  uf: 'DF',
  municipio: null,
  modalidade: 'pregao_eletronico',
  segmento: null,
  valorEstimado: 100000,
  dataPublicacao: '2026-10-01T08:00:00-03:00',
  dataLimite,
  ...extra,
})

const EDITAIS = [
  edital('ed-1', '2026-10-20T15:00:00-03:00'),
  edital('ed-2', '2026-10-25T15:00:00-03:00'),
  edital('ed-3', '2026-10-30T15:00:00-03:00'),
  edital('ed/barra', '2026-10-30T15:00:00-03:00'),
]

function criar(editais: Edital[] = EDITAIS, repo: AcompanhamentoRepo = acompanhamentoRepoMemoria()) {
  const app = buildApp({
    logger: false,
    agora: () => agora,
    feed: { editais: async () => [], scores: async () => [] },
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    certidoes: certidaoRepoMemoria([]).repo,
    arquivos: armazenamentoMemoria().armazenamento,
    acompanhamentos: { repo, editais: editaisEmMemoria(editais) },
    verificarToken: async (t) => {
      const u = usuarios[t]
      if (!u) throw new Error('invalido')
      return u
    },
  })
  return { app, repo }
}

type App = ReturnType<typeof criar>['app']
const criarAcomp = (app: App, editalId: string, token = 'decisorA', prefixo = '/v1') =>
  app.inject({ method: 'POST', url: `${prefixo}/acompanhamentos`, headers: auth(token), payload: { editalId } })
const mover = (app: App, id: string, corpo: unknown, token = 'decisorA') =>
  app.inject({ method: 'PATCH', url: `/v1/acompanhamentos/${id}`, headers: auth(token), payload: corpo as object })
const remover = (app: App, id: string, token = 'decisorA') =>
  app.inject({ method: 'DELETE', url: `/v1/acompanhamentos/${id}`, headers: auth(token) })
const listar = (app: App, query = '', token = 'decisorA') =>
  app.inject({ method: 'GET', url: `/v1/acompanhamentos${query}`, headers: auth(token) })

/** Leva um acompanhamento recém-criado até a etapa pedida, pelo caminho permitido. */
async function levarAte(app: App, id: string, etapa: Etapa) {
  const caminho: Array<[Etapa, object]> = [
    ['preparando', { etapa: 'preparando' }],
    ['enviado', { etapa: 'enviado' }],
    ['resultado', { etapa: 'resultado', resultado: 'venceu' }],
  ]
  for (const [e, corpo] of caminho) {
    if (ETAPAS.indexOf(e) > ETAPAS.indexOf(etapa)) break
    expect((await mover(app, id, corpo)).statusCode).toBe(200)
  }
}

describe('modelo: transições e faixas', () => {
  it('só avança uma etapa; a única volta é preparando → interessado (todas as 16 combinações)', () => {
    const permitidas = new Set(['interessado>preparando', 'preparando>enviado', 'preparando>interessado', 'enviado>resultado'])
    for (const de of ETAPAS) for (const para of ETAPAS) expect(transicaoPermitida(de, para), `${de}>${para}`).toBe(permitidas.has(`${de}>${para}`))
  })

  it('o início do dia é meia-noite de Brasília, e não a de UTC', () => {
    // 15/10 02:00 UTC ainda é 14/10 23:00 em Brasília.
    expect(inicioDoDiaBrasilia(new Date('2026-10-15T02:00:00Z'))).toBe(new Date('2026-10-14T03:00:00Z').getTime())
    expect(inicioDoDiaBrasilia(agora)).toBe(new Date('2026-10-15T03:00:00Z').getTime())
  })

  it('faixaDe: prazo de hoje em diante é em_prazo; vencido depende da fase', () => {
    const hoje = inicioDoDiaBrasilia(agora)
    expect(faixaDe({ fase: 'inicial', prazoEm: hoje }, hoje)).toBe('em_prazo')
    expect(faixaDe({ fase: 'inicial', prazoEm: hoje - 1 }, hoje)).toBe('iniciais_vencidos')
    expect(faixaDe({ fase: 'final', prazoEm: hoje - 1 }, hoje)).toBe('finais_vencidos')
    expect(faixaDe({ fase: 'final', prazoEm: hoje + 1 }, hoje)).toBe('em_prazo')
  })

  it('o id é determinístico por empresa × edital, opaco e diferente entre empresas', () => {
    expect(idDoAcompanhamento('emp-a', 'ed-1')).toBe(idDoAcompanhamento('emp-a', 'ed-1'))
    expect(idDoAcompanhamento('emp-a', 'ed-1')).not.toBe(idDoAcompanhamento('emp-b', 'ed-1'))
    expect(idDoAcompanhamento('emp-a', 'ed-1')).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('POST /v1/acompanhamentos', () => {
  it('201: cria em interessado com os dados copiados do edital e sem vazar empresaId', async () => {
    const { app } = criar()
    const r = await criarAcomp(app, 'ed-1')
    expect(r.statusCode).toBe(201)
    expect(r.json()).toEqual({
      id: idDoAcompanhamento('emp-a', 'ed-1'),
      editalId: 'ed-1',
      etapa: 'interessado',
      resultado: null,
      titulo: 'Objeto ed-1',
      orgao: 'Órgão ed-1',
      uf: 'DF',
      prazo: '2026-10-20T15:00:00-03:00',
      diasRestantes: 5,
      destaque: false,
      encerrado: false,
      criadoEm: agora.toISOString(),
      atualizadoEm: agora.toISOString(),
    })
    expect(r.body).not.toContain('emp-a')
  })

  it('200: o mesmo edital de novo devolve o existente e não duplica (inclusive se já mudou de etapa)', async () => {
    const { app, repo } = criar()
    const primeira = (await criarAcomp(app, 'ed-1')).json()
    await mover(app, primeira.id, { etapa: 'preparando' })
    const segunda = await criarAcomp(app, 'ed-1')
    expect(segunda.statusCode).toBe(200)
    expect(segunda.json()).toMatchObject({ id: primeira.id, etapa: 'preparando' })
    expect((repo as ReturnType<typeof acompanhamentoRepoMemoria>).todos()).toHaveLength(1)
  })

  it('duas chamadas ao mesmo tempo criam um só (uma 201 e uma 200)', async () => {
    const { app, repo } = criar()
    const rs = await Promise.all([criarAcomp(app, 'ed-2'), criarAcomp(app, 'ed-2')])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 201])
    expect((repo as ReturnType<typeof acompanhamentoRepoMemoria>).todos()).toHaveLength(1)
  })

  it('empresas diferentes acompanham o mesmo edital cada uma com o seu registro', async () => {
    const { app } = criar()
    const a = (await criarAcomp(app, 'ed-1', 'decisorA')).json()
    const b = (await criarAcomp(app, 'ed-1', 'decisorB')).json()
    expect(a.id).not.toBe(b.id)
    expect((await listar(app, '', 'decisorA')).json().total).toBe(1)
    expect((await listar(app, '', 'decisorB')).json().total).toBe(1)
  })

  it('o analista também pode acompanhar editais', async () => {
    const { app } = criar()
    expect((await criarAcomp(app, 'ed-1', 'analistaA')).statusCode).toBe(201)
  })

  it('404 para edital inexistente (nada é criado)', async () => {
    const { app, repo } = criar()
    const r = await criarAcomp(app, 'nao-existe')
    expect(r.statusCode).toBe(404)
    expect(r.json()).toMatchObject({ codigo: 'NAO_ENCONTRADO' })
    expect((repo as ReturnType<typeof acompanhamentoRepoMemoria>).todos()).toHaveLength(0)
  })

  it('400 para corpo inválido: sem editalId, vazio, não texto, com "/" ou com campo extra', async () => {
    const { app } = criar()
    for (const payload of [{}, { editalId: '' }, { editalId: 12 }, { editalId: 'ed/barra' }, { editalId: 'ed-1', etapa: 'enviado' }]) {
      const r = await app.inject({ method: 'POST', url: '/v1/acompanhamentos', headers: auth('decisorA'), payload })
      expect(r.statusCode, JSON.stringify(payload)).toBe(400)
      expect(r.json()).toMatchObject({ codigo: 'VALIDACAO' })
    }
  })

  it('403 quando o corpo traz empresaId de outra empresa', async () => {
    const { app } = criar()
    const r = await app.inject({ method: 'POST', url: '/v1/acompanhamentos', headers: auth('decisorA'), payload: { editalId: 'ed-1', empresaId: 'emp-b' } })
    expect(r.statusCode).toBe(403)
    expect(r.json()).toMatchObject({ codigo: 'ACESSO_NEGADO' })
  })

  it('responde também sem o prefixo /v1', async () => {
    const { app } = criar()
    expect((await criarAcomp(app, 'ed-1', 'decisorA', '')).statusCode).toBe(201)
    expect((await app.inject({ method: 'GET', url: '/acompanhamentos', headers: auth('decisorA') })).json().total).toBe(1)
  })
})

describe('autenticação e autorização', () => {
  it('401 sem token ou com token inválido, em todas as rotas', async () => {
    const { app } = criar()
    for (const [method, url] of [['POST', '/v1/acompanhamentos'], ['GET', '/v1/acompanhamentos'], ['PATCH', '/v1/acompanhamentos/x'], ['DELETE', '/v1/acompanhamentos/x']] as const) {
      const sem = await app.inject({ method, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {} })
      expect(sem.statusCode, `${method} sem token`).toBe(401)
      expect(sem.json()).toMatchObject({ codigo: 'NAO_AUTENTICADO' })
      const ruim = await app.inject({ method, url, headers: auth('lixo'), payload: method === 'GET' || method === 'DELETE' ? undefined : {} })
      expect(ruim.statusCode, `${method} token inválido`).toBe(401)
    }
  })

  it('403 EMPRESA_NAO_CONFIGURADA para token sem empresa, em todas as rotas', async () => {
    const { app } = criar()
    for (const [method, url] of [['POST', '/v1/acompanhamentos'], ['GET', '/v1/acompanhamentos'], ['PATCH', '/v1/acompanhamentos/x'], ['DELETE', '/v1/acompanhamentos/x']] as const) {
      const r = await app.inject({ method, url, headers: auth('semEmpresa'), payload: method === 'GET' || method === 'DELETE' ? undefined : { editalId: 'ed-1', etapa: 'preparando' } })
      expect(r.statusCode, `${method}`).toBe(403)
      expect(r.json()).toMatchObject({ codigo: 'EMPRESA_NAO_CONFIGURADA' })
    }
  })

  it('403 para acompanhamento de outra empresa em PATCH e DELETE, sem alterar nem revelar nada', async () => {
    const { app, repo } = criar()
    const { id } = (await criarAcomp(app, 'ed-1', 'decisorA')).json()
    const antes = JSON.stringify((repo as ReturnType<typeof acompanhamentoRepoMemoria>).todos())
    for (const r of [await mover(app, id, { etapa: 'preparando' }, 'decisorB'), await remover(app, id, 'decisorB')]) {
      expect(r.statusCode).toBe(403)
      expect(r.json()).toMatchObject({ codigo: 'ACESSO_NEGADO' })
      expect(r.body).not.toMatch(/ed-1|Objeto|emp-a/)
    }
    // Também quando a transição seria inválida: o dono é checado antes da regra (403, não 422).
    expect((await mover(app, id, { etapa: 'resultado', resultado: 'venceu' }, 'decisorB')).statusCode).toBe(403)
    expect(JSON.stringify((repo as ReturnType<typeof acompanhamentoRepoMemoria>).todos())).toBe(antes)
  })

  it('o GET só devolve os da própria empresa e ignora empresaId na query de outra (403)', async () => {
    const { app } = criar()
    await criarAcomp(app, 'ed-1', 'decisorA')
    expect((await listar(app, '', 'decisorB')).json()).toMatchObject({ itens: [], total: 0 })
    expect((await listar(app, '?empresaId=emp-a', 'decisorB')).statusCode).toBe(403)
  })
})

describe('PATCH /v1/acompanhamentos/{id}', () => {
  it('percorre interessado → preparando → enviado → resultado e atualiza atualizadoEm', async () => {
    const { app } = criar()
    const { id } = (await criarAcomp(app, 'ed-1')).json()
    const p = await mover(app, id, { etapa: 'preparando' })
    expect(p.json()).toMatchObject({ etapa: 'preparando', resultado: null })
    expect((await mover(app, id, { etapa: 'enviado' })).json()).toMatchObject({ etapa: 'enviado', resultado: null })
    const r = await mover(app, id, { etapa: 'resultado', resultado: 'nao_venceu' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ etapa: 'resultado', resultado: 'nao_venceu' })
    expect((await listar(app)).json().itens[0]).toMatchObject({ etapa: 'resultado', resultado: 'nao_venceu' })
  })

  it('permite voltar de preparando para interessado', async () => {
    const { app } = criar()
    const { id } = (await criarAcomp(app, 'ed-1')).json()
    await mover(app, id, { etapa: 'preparando' })
    expect((await mover(app, id, { etapa: 'interessado' })).json()).toMatchObject({ etapa: 'interessado' })
  })

  it('422 REGRA_DE_NEGOCIO em toda transição fora das permitidas, e nada muda', async () => {
    for (const de of ETAPAS) {
      for (const para of ETAPAS) {
        if (transicaoPermitida(de, para)) continue
        const { app } = criar()
        const { id } = (await criarAcomp(app, 'ed-1')).json()
        await levarAte(app, id, de)
        const antes = (await listar(app)).json().itens[0]
        const r = await mover(app, id, para === 'resultado' ? { etapa: para, resultado: 'venceu' } : { etapa: para })
        expect(r.statusCode, `${de} → ${para}`).toBe(422)
        expect(r.json()).toMatchObject({ codigo: 'REGRA_DE_NEGOCIO' })
        expect((await listar(app)).json().itens[0], `${de} → ${para} não pode alterar`).toEqual(antes)
      }
    }
  })

  it('depois do resultado nada mais muda', async () => {
    const { app } = criar()
    const { id } = (await criarAcomp(app, 'ed-1')).json()
    await levarAte(app, id, 'resultado')
    expect((await mover(app, id, { etapa: 'resultado', resultado: 'nao_venceu' })).statusCode).toBe(422)
    expect((await listar(app)).json().itens[0].resultado).toBe('venceu')
  })

  it('400 em resultado sem venceu/nao_venceu, resultado inválido e resultado fora da etapa resultado', async () => {
    const { app } = criar()
    const { id } = (await criarAcomp(app, 'ed-1')).json()
    await levarAte(app, id, 'enviado')
    for (const corpo of [{ etapa: 'resultado' }, { etapa: 'resultado', resultado: 'talvez' }, { etapa: 'resultado', resultado: null }]) {
      const r = await mover(app, id, corpo)
      expect(r.statusCode, JSON.stringify(corpo)).toBe(400)
      expect(r.json()).toMatchObject({ codigo: 'VALIDACAO', detalhes: [{ campo: 'resultado' }] })
    }
    expect((await mover(app, id, { etapa: 'enviado', resultado: 'venceu' })).statusCode).toBe(400)
    expect((await listar(app)).json().itens[0]).toMatchObject({ etapa: 'enviado', resultado: null })
  })

  it('400 em etapa inexistente, ausente ou campo extra; a validação vem antes da regra de transição', async () => {
    const { app } = criar()
    const { id } = (await criarAcomp(app, 'ed-1')).json()
    for (const corpo of [{}, { etapa: 'ganho' }, { etapa: 1 }, { etapa: 'preparando', prazo: 'x' }]) {
      expect((await mover(app, id, corpo)).statusCode, JSON.stringify(corpo)).toBe(400)
    }
    // interessado → resultado seria 422, mas sem `resultado` o pedido nem é válido: 400.
    expect((await mover(app, id, { etapa: 'resultado' })).statusCode).toBe(400)
  })

  it('404 para id inexistente', async () => {
    const { app } = criar()
    const r = await mover(app, 'f'.repeat(32), { etapa: 'preparando' })
    expect(r.statusCode).toBe(404)
    expect(r.json()).toMatchObject({ codigo: 'NAO_ENCONTRADO' })
  })
})

describe('DELETE /v1/acompanhamentos/{id}', () => {
  it('204 em interessado e em preparando; depois some da lista e dá para acompanhar de novo', async () => {
    for (const etapa of ['interessado', 'preparando'] as const) {
      const { app } = criar()
      const { id } = (await criarAcomp(app, 'ed-1')).json()
      await levarAte(app, id, etapa)
      const r = await remover(app, id)
      expect(r.statusCode, etapa).toBe(204)
      expect(r.body).toBe('')
      expect((await listar(app)).json().total).toBe(0)
      expect((await mover(app, id, { etapa: 'preparando' })).statusCode).toBe(404)
      expect((await criarAcomp(app, 'ed-1')).statusCode).toBe(201)
    }
  })

  it('422 em enviado e em resultado, e o acompanhamento continua lá', async () => {
    for (const etapa of ['enviado', 'resultado'] as const) {
      const { app } = criar()
      const { id } = (await criarAcomp(app, 'ed-1')).json()
      await levarAte(app, id, etapa)
      const r = await remover(app, id)
      expect(r.statusCode, etapa).toBe(422)
      expect(r.json()).toMatchObject({ codigo: 'REGRA_DE_NEGOCIO' })
      expect((await listar(app)).json().total).toBe(1)
    }
  })

  it('404 para id inexistente e para um já removido', async () => {
    const { app } = criar()
    expect((await remover(app, 'a'.repeat(32))).statusCode).toBe(404)
    const { id } = (await criarAcomp(app, 'ed-1')).json()
    expect((await remover(app, id)).statusCode).toBe(204)
    expect((await remover(app, id)).statusCode).toBe(404)
  })
})

describe('GET /v1/acompanhamentos: ordem, destaque e paginação', () => {
  // agora = quinta 15/10/2026 10:00 (Brasília)
  const CASOS = [
    edital('hoje-passou', '2026-10-15T08:00:00-03:00'), // hoje, horário já passado: dia 0, não encerrado
    edital('ontem', '2026-10-14T23:59:00-03:00'), // dia -1
    edital('d0-fim', '2026-10-15T23:59:00-03:00'), // dia 0
    edital('d3-fim', '2026-10-18T23:59:00-03:00'), // dia 3: destaque
    edital('d4-ini', '2026-10-19T00:00:00-03:00'), // dia 4: sem destaque
    edital('d10', '2026-10-25T10:00:00-03:00'),
    edital('antigo', '2026-10-01T10:00:00-03:00'), // dia -14
  ]

  async function montar() {
    const ctx = criar(CASOS)
    const ids: Record<string, string> = {}
    for (const e of CASOS) ids[e.id] = (await criarAcomp(ctx.app, e.id)).json().id
    return { ...ctx, ids }
  }

  it('ordena pelo prazo; os encerrados (prazo passado, proposta não enviada) vão para o fim', async () => {
    const { app } = await montar()
    const itens = (await listar(app)).json().itens as Array<{ editalId: string; encerrado: boolean }>
    expect(itens.map((i) => i.editalId)).toEqual(['hoje-passou', 'd0-fim', 'd3-fim', 'd4-ini', 'd10', 'antigo', 'ontem'])
    expect(itens.filter((i) => i.encerrado).map((i) => i.editalId)).toEqual(['antigo', 'ontem'])
  })

  it('o prazo vencido de um edital já enviado não o manda para o fim, e ele não é encerrado', async () => {
    const { app, ids } = await montar()
    await levarAte(app, ids['antigo']!, 'enviado')
    const itens = (await listar(app)).json().itens as Array<{ editalId: string; encerrado: boolean }>
    // Finais vencidos vêm antes de todos, porque o prazo é o mais antigo.
    expect(itens.map((i) => i.editalId)).toEqual(['antigo', 'hoje-passou', 'd0-fim', 'd3-fim', 'd4-ini', 'd10', 'ontem'])
    expect(itens.find((i) => i.editalId === 'antigo')?.encerrado).toBe(false)
    expect(itens.find((i) => i.editalId === 'ontem')?.encerrado).toBe(true)
  })

  it('destaque de 0 a 3 dias de calendário em Brasília (limites 3 e 4, dia 0 e passado)', async () => {
    const { app } = await montar()
    const itens = (await listar(app)).json().itens as Array<{ editalId: string; diasRestantes: number; destaque: boolean }>
    const por = Object.fromEntries(itens.map((i) => [i.editalId, i]))
    expect(por['hoje-passou']).toMatchObject({ diasRestantes: 0, destaque: true })
    expect(por['d0-fim']).toMatchObject({ diasRestantes: 0, destaque: true })
    expect(por['d3-fim']).toMatchObject({ diasRestantes: 3, destaque: true })
    expect(por['d4-ini']).toMatchObject({ diasRestantes: 4, destaque: false })
    expect(por['d10']).toMatchObject({ diasRestantes: 10, destaque: false })
    expect(por['ontem']).toMatchObject({ diasRestantes: -1, destaque: false })
    expect(por['antigo']).toMatchObject({ diasRestantes: -14, destaque: false })
  })

  it('a virada do dia usa Brasília: 23:30 em Brasília de quinta ainda é o mesmo dia (02:30Z de sexta)', async () => {
    const ctx = criar([edital('x', '2026-10-18T10:00:00-03:00')])
    // Relógio injetado: 15/10 23:30 BRT = 16/10 02:30 UTC.
    const tarde = buildApp({
      logger: false,
      agora: () => new Date('2026-10-16T02:30:00Z'),
      feed: { editais: async () => [], scores: async () => [] },
      perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
      definirClaims: async () => {},
      certidoes: certidaoRepoMemoria([]).repo,
      arquivos: armazenamentoMemoria().armazenamento,
      acompanhamentos: { repo: ctx.repo, editais: editaisEmMemoria([edital('x', '2026-10-18T10:00:00-03:00')]) },
      verificarToken: async (t) => usuarios[t]!,
    })
    await criarAcomp(tarde, 'x')
    expect((await listar(tarde)).json().itens[0]).toMatchObject({ diasRestantes: 3, destaque: true })
  })

  it('filtra por etapa e mantém a ordem', async () => {
    const { app, ids } = await montar()
    await mover(app, ids['d10']!, { etapa: 'preparando' })
    await mover(app, ids['d3-fim']!, { etapa: 'preparando' })
    const r = (await listar(app, '?etapa=preparando')).json()
    expect(r.total).toBe(2)
    expect(r.itens.map((i: { editalId: string }) => i.editalId)).toEqual(['d3-fim', 'd10'])
    expect((await listar(app, '?etapa=interessado')).json().total).toBe(5)
    expect((await listar(app, '?etapa=resultado')).json()).toMatchObject({ itens: [], total: 0 })
  })

  it('pagina sem repetir nem pular itens, e o total não muda entre páginas', async () => {
    const { app } = await montar()
    const todos = ((await listar(app, '?pageSize=100')).json().itens as Array<{ id: string }>).map((i) => i.id)
    const vistos: string[] = []
    for (const page of [1, 2, 3, 4]) {
      const r = (await listar(app, `?page=${page}&pageSize=3`)).json()
      expect(r).toMatchObject({ page, pageSize: 3, total: 7 })
      vistos.push(...r.itens.map((i: { id: string }) => i.id))
    }
    expect(vistos).toEqual(todos)
    expect((await listar(app, '?page=4&pageSize=3')).json().itens).toEqual([])
  })

  it('pagina por faixas: a página 2 cruza do em_prazo para os encerrados', async () => {
    const { app } = await montar()
    const r = (await listar(app, '?page=2&pageSize=4')).json()
    expect(r.itens.map((i: { editalId: string }) => i.editalId)).toEqual(['d10', 'antigo', 'ontem'])
  })

  it('usa padrão page=1 e pageSize=20; 400 em valores inválidos', async () => {
    const { app } = await montar()
    expect((await listar(app)).json()).toMatchObject({ page: 1, pageSize: 20 })
    for (const q of ['?page=0', '?pageSize=0', '?pageSize=101', '?page=a', '?etapa=ganho', '?pageSize=1.5']) {
      const r = await listar(app, q)
      expect(r.statusCode, q).toBe(400)
      expect(r.json()).toMatchObject({ codigo: 'VALIDACAO' })
    }
    expect((await listar(app, '?pageSize=100')).statusCode).toBe(200)
  })

  it('a rota pede ao repositório só a página (offset e limit), nunca a coleção inteira', async () => {
    const base = acompanhamentoRepoMemoria()
    const listarPagina = vi.fn(base.listarPagina)
    const { app } = criar(CASOS, { ...base, listarPagina })
    await criarAcomp(app, 'd10')
    await listar(app, '?page=3&pageSize=5&etapa=interessado')
    expect(listarPagina).toHaveBeenCalledTimes(1)
    expect(listarPagina).toHaveBeenCalledWith({ empresaId: 'emp-a', etapa: 'interessado', hojeInicioMs: inicioDoDiaBrasilia(agora), offset: 10, limit: 5 })
  })
})

describe('seed', () => {
  it('o seed traz 2 acompanhamentos da Empresa A, um em interessado e um em preparando (o de prazo mais curto vem primeiro)', async () => {
    const editais = editaisGolden(agora)
    const seed = acompanhamentosGolden(agora, editais)
    expect(seed.map((s) => [s.empresaId, s.editalId, s.etapa])).toEqual([
      ['emp-a', 'golden-A', 'interessado'],
      ['emp-a', 'golden-E', 'preparando'],
    ])
    const { app } = criar(editais, acompanhamentoRepoMemoria(seed))
    const itens = (await listar(app)).json().itens as Array<{ editalId: string }>
    expect(itens.map((i) => i.editalId)).toEqual(['golden-E', 'golden-A'])
  })
})
