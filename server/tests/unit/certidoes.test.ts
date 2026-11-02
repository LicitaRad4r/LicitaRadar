import { describe, expect, it } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { Usuario } from '../../src/auth.js'
import { classificar } from '../../src/certidoes/status.js'
import { somarDias } from '../../src/dominio/tempo.js'
import { certidoesGolden } from '../../src/seed/golden.js'
import { auth } from './ajudantes.js'
import { armazenamentoMemoria, certidaoRepoMemoria } from './memoria.js'

// 15/10/2026 10:00 em Brasília
let agora = new Date('2026-10-15T13:00:00Z')
const HOJE = '2026-10-15'
const usuarios: Record<string, Usuario> = {
  decisorA: { uid: 'da', empresaId: 'emp-a', role: 'decisor' },
  analistaA: { uid: 'aa', empresaId: 'emp-a', role: 'analista' },
  decisorB: { uid: 'db', empresaId: 'emp-b', role: 'decisor' },
  semEmpresa: { uid: 'sx' },
}

function criar() {
  const repo = certidaoRepoMemoria(certidoesGolden(agora))
  const arq = armazenamentoMemoria()
  const app = buildApp({
    logger: false,
    agora: () => agora,
    feed: { editais: async () => [], scores: async () => [] },
    perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
    definirClaims: async () => {},
    certidoes: repo.repo,
    arquivos: arq.armazenamento,
    verificarToken: async (t) => {
      const u = usuarios[t]
      if (!u) throw new Error('invalido')
      return u
    },
  })
  return { app, ...repo, ...arq }
}

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(100, 1)])
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 2)])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 3)])

interface Campos {
  validade?: string
  arquivo?: Buffer
  nomeArquivo?: string
  extras?: Record<string, string>
}

/** Monta um multipart/form-data na mão. */
function multipart(c: Campos) {
  const f = 'XXborderXX'
  const partes: Buffer[] = []
  const campo = (n: string, v: string) =>
    partes.push(Buffer.from(`--${f}\r\nContent-Disposition: form-data; name="${n}"\r\n\r\n${v}\r\n`))
  if (c.validade !== undefined) campo('validade', c.validade)
  for (const [k, v] of Object.entries(c.extras ?? {})) campo(k, v)
  if (c.arquivo) {
    partes.push(
      Buffer.from(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${c.nomeArquivo ?? 'cert.pdf'}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      c.arquivo,
      Buffer.from('\r\n'),
    )
  }
  partes.push(Buffer.from(`--${f}--\r\n`))
  return { payload: Buffer.concat(partes), headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}

const renovar = (app: ReturnType<typeof criar>['app'], id: string, c: Campos, token = 'decisorA') => {
  const m = multipart(c)
  return app.inject({ method: 'PUT', url: `/certidoes/${id}/renovacao`, payload: m.payload, headers: { ...auth(token), ...m.headers } })
}
const listar = (app: ReturnType<typeof criar>['app'], token = 'decisorA', prefixo = '') =>
  app.inject({ method: 'GET', url: `${prefixo}/certidoes`, headers: auth(token) })

describe('Jornada 3: classificação (CT-CERT-003 a 006)', () => {
  const casos: Array<[string, number, number, string]> = [
    ['CT-CERT-003', -2, -2, 'vencida'],
    ['hoje', 0, 0, 'urgente'],
    ['CT-CERT-003', 3, 3, 'urgente'],
    ['CT-CERT-004', 15, 15, 'urgente'],
    ['CT-CERT-005', 16, 16, 'atencao'],
    ['CT-CERT-005', 30, 30, 'atencao'],
    ['CT-CERT-006', 31, 31, 'em_dia'],
  ]
  it.each(casos)('%s: validade em %i dia(s) → %s', (_id, dias, restantes, status) => {
    expect(classificar(somarDias(HOJE, dias), agora)).toEqual({ diasRestantes: restantes, status })
  })

  it('CT-CERT-010: a virada do dia em Brasília muda o status sem gravar nada', () => {
    const validade = somarDias(HOJE, 16)
    // 23:59 de 15/10 (02:59Z de 16/10): faltam 16 dias → atenção
    expect(classificar(validade, new Date('2026-10-16T02:59:00Z'))).toEqual({ diasRestantes: 16, status: 'atencao' })
    // 00:00 de 16/10 em Brasília (03:00Z): faltam 15 dias → urgente
    expect(classificar(validade, new Date('2026-10-16T03:00:00Z'))).toEqual({ diasRestantes: 15, status: 'urgente' })
  })
})

describe('Jornada 3: GET /certidoes', () => {
  it('lista com diasRestantes e status, da mais urgente para a menos urgente', async () => {
    const { app } = criar()
    const r = await listar(app)
    expect(r.statusCode).toBe(200)
    const itens = r.json().itens
    expect(itens.map((i: { diasRestantes: number }) => i.diasRestantes)).toEqual([-2, 3, 15, 16, 30, 31])
    expect(itens.map((i: { status: string }) => i.status)).toEqual(['vencida', 'urgente', 'urgente', 'atencao', 'atencao', 'em_dia'])
    expect(Object.keys(itens[0]).sort()).toEqual(['diasRestantes', 'id', 'nome', 'status', 'validade'])
  })

  it('serve também em /v1 e só traz as certidões da empresa do token', async () => {
    const { app } = criar()
    const b = await listar(app, 'decisorB', '/v1')
    expect(b.statusCode).toBe(200)
    expect(b.json().itens.map((i: { id: string }) => i.id)).toEqual(['cert-b-mais10'])
  })

  it('CT-SEG-005: analista recebe 403 ACESSO_NEGADO', async () => {
    const { app } = criar()
    for (const prefixo of ['', '/v1']) {
      const r = await listar(app, 'analistaA', prefixo)
      expect(r.statusCode).toBe(403)
      expect(r.json().codigo).toBe('ACESSO_NEGADO')
    }
  })

  it('sem token 401; sem claims 403 EMPRESA_NAO_CONFIGURADA; outra empresa na query 403', async () => {
    const { app } = criar()
    expect((await app.inject({ method: 'GET', url: '/certidoes' })).statusCode).toBe(401)
    const s = await listar(app, 'semEmpresa')
    expect([s.statusCode, s.json().codigo]).toEqual([403, 'EMPRESA_NAO_CONFIGURADA'])
    const q = await app.inject({ method: 'GET', url: '/certidoes?empresaId=emp-b', headers: auth('decisorA') })
    expect([q.statusCode, q.json().codigo]).toEqual([403, 'ACESSO_NEGADO'])
  })
})

describe('Jornada 3: PUT /certidoes/{id}/renovacao', () => {
  const nova = somarDias(HOJE, 365)

  it('CT-CERT-007: renova com PDF, JPG ou PNG, recalcula o status e mantém o arquivo anterior inativo', async () => {
    for (const [arquivo, tipo] of [[PDF, 'application/pdf'], [PNG, 'image/png'], [JPG, 'image/jpeg']] as const) {
      const { app, mapa, gravados } = criar()
      const r = await renovar(app, 'cert-a-vencida', { validade: nova, arquivo })
      expect(r.statusCode).toBe(200)
      expect(r.json()).toMatchObject({ id: 'cert-a-vencida', validade: nova, diasRestantes: 365, status: 'em_dia' })
      const c = mapa.get('cert-a-vencida')!
      expect(c.arquivo.tipo).toBe(tipo)
      expect(c.anteriores).toHaveLength(1)
      expect(gravados.get(c.arquivo.chave)?.equals(arquivo)).toBe(true)
    }
  })

  it('aceita 5 MB exatos e recusa 5 MB + 1 byte, sem alterar a certidão', async () => {
    const cinco = Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(5 * 1024 * 1024 - 4)])
    const ok = criar()
    expect((await renovar(ok.app, 'cert-a-mais3', { validade: nova, arquivo: cinco })).statusCode).toBe(200)

    const grande = Buffer.concat([cinco, Buffer.from([0])])
    const ruim = criar()
    const r = await renovar(ruim.app, 'cert-a-mais3', { validade: nova, arquivo: grande })
    expect(r.statusCode).toBe(400)
    expect(r.json().detalhes[0].campo).toBe('arquivo')
    expect(ruim.mapa.get('cert-a-mais3')!.validade).toBe(somarDias(HOJE, 3))
    expect(ruim.gravados.size).toBe(0)
  })

  it('recusa arquivo vazio, de outro tipo (mesmo com nome .pdf) ou ausente, indicando o campo', async () => {
    const { app, mapa, gravados } = criar()
    const texto = await renovar(app, 'cert-a-mais3', { validade: nova, arquivo: Buffer.from('oi, sou um txt'), nomeArquivo: 'x.pdf' })
    const vazio = await renovar(app, 'cert-a-mais3', { validade: nova, arquivo: Buffer.alloc(0) })
    const ausente = await renovar(app, 'cert-a-mais3', { validade: nova })
    for (const r of [texto, vazio, ausente]) {
      expect(r.statusCode).toBe(400)
      expect(r.json().codigo).toBe('VALIDACAO')
      expect(r.json().detalhes.map((d: { campo: string }) => d.campo)).toContain('arquivo')
    }
    expect(mapa.get('cert-a-mais3')!.anteriores).toHaveLength(0)
    expect(gravados.size).toBe(0)
  })

  it('CT-CERT-007 (validade): passada, hoje, igual ou anterior à atual, ausente ou malformada → 400 no campo validade', async () => {
    // cert-a-mais30 vence em +30: +20 é futura, mas anterior à atual
    const casos: Array<[string, string | undefined, string]> = [
      ['cert-a-mais3', somarDias(HOJE, -1), 'passada'],
      ['cert-a-mais3', HOJE, 'hoje'],
      ['cert-a-mais30', somarDias(HOJE, 20), 'anterior à atual'],
      ['cert-a-mais30', somarDias(HOJE, 30), 'igual à atual'],
      ['cert-a-mais3', undefined, 'ausente'],
      ['cert-a-mais3', '31/12/2027', 'formato'],
      ['cert-a-mais3', '2027-02-30', 'inexistente'],
    ]
    for (const [id, validade, rotulo] of casos) {
      const { app, mapa, gravados } = criar()
      const antes = structuredClone(mapa.get(id)!)
      const r = await renovar(app, id, { validade, arquivo: PDF })
      expect(r.statusCode, rotulo).toBe(400)
      expect(r.json().detalhes.map((d: { campo: string }) => d.campo), rotulo).toContain('validade')
      expect(mapa.get(id), rotulo).toEqual(antes)
      expect(gravados.size, rotulo).toBe(0)
    }
  })

  it('validade um dia depois da atual e futura é aceita', async () => {
    const { app } = criar()
    const r = await renovar(app, 'cert-a-mais30', { validade: somarDias(HOJE, 31), arquivo: PDF })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ diasRestantes: 31, status: 'em_dia' })
  })

  it('CT-SEG-006: certidão de outra empresa → 403 e nada é gravado', async () => {
    const { app, mapa, gravados } = criar()
    const antes = structuredClone(mapa.get('cert-a-mais3')!)
    const r = await renovar(app, 'cert-a-mais3', { validade: nova, arquivo: PDF }, 'decisorB')
    expect([r.statusCode, r.json().codigo]).toEqual([403, 'ACESSO_NEGADO'])
    expect(mapa.get('cert-a-mais3')).toEqual(antes)
    expect(gravados.size).toBe(0)
  })

  it('CT-SEG-005: analista → 403 e nada é gravado', async () => {
    const { app, mapa, gravados } = criar()
    const antes = structuredClone(mapa.get('cert-a-mais3')!)
    const r = await renovar(app, 'cert-a-mais3', { validade: nova, arquivo: PDF }, 'analistaA')
    expect([r.statusCode, r.json().codigo]).toEqual([403, 'ACESSO_NEGADO'])
    expect(mapa.get('cert-a-mais3')).toEqual(antes)
    expect(gravados.size).toBe(0)
  })

  it('empresaId de outra empresa no corpo → 403; certidão inexistente → 404; sem token → 401; sem multipart → 400', async () => {
    const { app, gravados } = criar()
    const corpo = await renovar(app, 'cert-a-mais3', { validade: nova, arquivo: PDF, extras: { empresaId: 'emp-b' } })
    expect(corpo.statusCode).toBe(403)
    expect(gravados.size).toBe(0)
    expect((await renovar(app, 'nao-existe', { validade: nova, arquivo: PDF })).statusCode).toBe(404)
    const sem = await app.inject({ method: 'PUT', url: '/certidoes/cert-a-mais3/renovacao' })
    expect(sem.statusCode).toBe(401)
    const json = await app.inject({ method: 'PUT', url: '/certidoes/cert-a-mais3/renovacao', headers: auth('decisorA'), payload: { validade: nova } })
    expect(json.statusCode).toBe(400)
  })

  it('serve também em /v1', async () => {
    const { app } = criar()
    const m = multipart({ validade: nova, arquivo: PDF })
    const r = await app.inject({ method: 'PUT', url: '/v1/certidoes/cert-a-mais3/renovacao', payload: m.payload, headers: { ...auth('decisorA'), ...m.headers } })
    expect(r.statusCode).toBe(200)
  })

  it('depois de renovar, a lista reflete o novo status e a nova ordem', async () => {
    const { app } = criar()
    await renovar(app, 'cert-a-vencida', { validade: nova, arquivo: PDF })
    const itens = (await listar(app)).json().itens
    expect(itens[0]).toMatchObject({ diasRestantes: 3, status: 'urgente' })
    expect(itens.at(-1)).toMatchObject({ id: 'cert-a-vencida', status: 'em_dia' })
  })
})
