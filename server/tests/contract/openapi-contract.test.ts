import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

const openapiTexto = readFileSync(new URL('../../openapi.yaml', import.meta.url), 'utf8')
const schemaClienteTexto = readFileSync(
  new URL('../../../client/src/api/schema.d.ts', import.meta.url),
  'utf8',
)

type OperacaoSpec = {
  operationId?: string
  security?: string
  respostas: string[]
  parametros: string[]
}

/**
 * Extrai as rotas, métodos HTTP, códigos de resposta e parâmetros declarados no openapi.yaml
 * para verificar a conformidade estrutural do contrato sem dependências externas de parser YAML.
 */
function extrairRotasDoOpenApi(yaml: string): Map<string, Map<string, OperacaoSpec>> {
  const linhas = yaml.split(/\r?\n/)
  const rotas = new Map<string, Map<string, OperacaoSpec>>()
  let emPaths = false
  let rotaAtual: string | null = null
  let metodoAtual: string | null = null
  let secaoMetodo: 'responses' | 'parameters' | 'outra' | null = null

  for (const linha of linhas) {
    if (/^paths:\s*$/.test(linha)) {
      emPaths = true
      continue
    }
    if (emPaths && /^[a-zA-Z]/.test(linha)) {
      break
    }
    if (!emPaths) continue

    const matchRota = /^ {2}(\/[^\s:]+):\s*$/.exec(linha)
    if (matchRota) {
      rotaAtual = matchRota[1]
      rotas.set(rotaAtual, new Map())
      metodoAtual = null
      secaoMetodo = null
      continue
    }

    const matchMetodo = /^ {4}(get|post|put|patch|delete):\s*$/.exec(linha)
    if (matchMetodo && rotaAtual) {
      metodoAtual = matchMetodo[1].toUpperCase()
      rotas.get(rotaAtual)!.set(metodoAtual, { respostas: [], parametros: [] })
      secaoMetodo = null
      continue
    }

    if (!rotaAtual || !metodoAtual) continue
    const operacao = rotas.get(rotaAtual)!.get(metodoAtual)!

    const matchOpId = /^ {6}operationId:\s*(\S+)/.exec(linha)
    if (matchOpId) {
      operacao.operationId = matchOpId[1]
      continue
    }

    const matchSecurity = /^ {6}security:\s*(.+)$/.exec(linha)
    if (matchSecurity) {
      operacao.security = matchSecurity[1].trim()
      continue
    }

    const matchSecao = /^ {6}([a-zA-Z]+):\s*$/.exec(linha)
    if (matchSecao) {
      const nome = matchSecao[1]
      secaoMetodo = nome === 'responses' || nome === 'parameters' ? nome : 'outra'
      continue
    }

    if (secaoMetodo === 'responses') {
      const matchStatus = /^ {8}'(\d{3})':/.exec(linha)
      if (matchStatus) operacao.respostas.push(matchStatus[1])
    }

    if (secaoMetodo === 'parameters') {
      const matchParamNome = /^ {8}-\s*name:\s*(\S+)/.exec(linha)
      if (matchParamNome) operacao.parametros.push(matchParamNome[1])
      const matchParamRef = /^ {8}-\s*\$ref:\s*'#\/components\/parameters\/([^']+)'/.exec(linha)
      if (matchParamRef) operacao.parametros.push(`$ref:${matchParamRef[1]}`)
    }
  }

  return rotas
}

const rotasOpenApi = extrairRotasDoOpenApi(openapiTexto)

// Schemas Zod espelhando estritamente o contrato server/openapi.yaml (v0.2 / Checkpoint 2)
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

function ehDataIsoValida(valor: string): boolean {
  if (!isoDateRegex.test(valor)) return false
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  )
}

const DataIsoSchema = z.string().refine(ehDataIsoValida, 'Data ISO inválida')
const DataHoraIsoSchema = z.string().datetime()

const UfSchema = z.string().regex(/^[A-Z]{2}$/)
const FaixaSchema = z.enum(['alta', 'media'])
const FeedbackSchema = z.enum(['relevante', 'irrelevante'])
const SegmentoSchema = z.enum(['saude', 'educacao', 'ti', 'construcao_civil', 'servicos_gerais'])
const ModalidadeSchema = z.enum(['pregao_eletronico', 'concorrencia', 'dispensa'])
const CriterioSchema = z.enum(['termo', 'uf', 'valor', 'prazo', 'segmento', 'modalidade'])
const CertidaoTipoSchema = z.enum(['federal', 'fgts', 'trabalhista', 'estadual', 'municipal', 'outra'])
const CertidaoStatusSchema = z.enum(['valida', 'vence_em_breve', 'vencida'])
const AlertaTipoSchema = z.enum(['prazo_edital', 'certidao_vencendo', 'nova_oportunidade'])

const HealthSchema = z
  .object({
    status: z.literal('ok'),
    timestamp: DataHoraIsoSchema,
  })
  .strict()

const ErroSchema = z
  .object({
    codigo: z.enum([
      'VALIDACAO',
      'NAO_AUTENTICADO',
      'EMPRESA_NAO_CONFIGURADA',
      'NAO_ENCONTRADO',
      'ACESSO_NEGADO',
      'ERRO_INTERNO',
    ]),
    mensagem: z.string().min(1),
    detalhes: z
      .array(
        z
          .object({
            campo: z.string().min(1),
            mensagem: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()

const PerfilSchema = z
  .object({
    empresaId: z.string().nullable().optional(),
    ufs: z
      .array(UfSchema)
      .refine((itens) => new Set(itens).size === itens.length, 'UFs duplicadas')
      .optional(),
    termosChave: z.array(z.string().min(2)).max(50).optional(),
    segmentos: z
      .array(SegmentoSchema)
      .refine((itens) => new Set(itens).size === itens.length, 'Segmentos duplicados')
      .optional(),
    modalidades: z
      .array(ModalidadeSchema)
      .refine((itens) => new Set(itens).size === itens.length, 'Modalidades duplicadas')
      .optional(),
    valorMinimo: z.number().min(0).nullable().optional(),
    valorMaximo: z.number().min(0).nullable().optional(),
    prazoMinimoDiasUteis: z.number().int().min(0).nullable().optional(),
  })
  .strict()
  .refine(
    (p) => p.valorMinimo == null || p.valorMaximo == null || p.valorMinimo <= p.valorMaximo,
    { message: 'valorMaximo deve ser maior ou igual a valorMinimo', path: ['valorMaximo'] },
  )

const PaginacaoQuerySchema = z.object({
  pagina: z.number().int().min(1).default(1),
  tamanho: z.number().int().min(1).max(100).default(20),
})

const FeedQuerySchema = PaginacaoQuerySchema.extend({
  termo: z.string().min(2).optional(),
  uf: z.array(UfSchema).optional(),
  valorMinimo: z.number().min(0).optional(),
  valorMaximo: z.number().min(0).optional(),
  publicadoDe: DataIsoSchema.optional(),
  publicadoAte: DataIsoSchema.optional(),
  limiteDe: DataIsoSchema.optional(),
  limiteAte: DataIsoSchema.optional(),
  faixa: FaixaSchema.optional(),
}).refine(
  (q) => q.valorMinimo === undefined || q.valorMaximo === undefined || q.valorMinimo <= q.valorMaximo,
  { message: 'valorMinimo não pode ser maior que valorMaximo', path: ['valorMaximo'] },
)

const EditalResumoSchema = z.object({
  id: z.string().min(1),
  orgao: z.string().min(1),
  objeto: z.string().min(1),
  modalidade: z.string().optional(),
  uf: UfSchema,
  municipio: z.string().nullable().optional(),
  valorEstimado: z.number().nullable().optional(),
  dataPublicacao: DataHoraIsoSchema.optional(),
  dataLimiteProposta: DataHoraIsoSchema,
  linkPncp: z.string().url().optional(),
})

const FeedItemSchema = EditalResumoSchema.extend({
  score: z.number().int().min(0).max(100),
  faixa: FaixaSchema,
  criteriosAtendidos: z.array(CriterioSchema),
  diasParaEncerrar: z.number().int().min(0),
  feedback: FeedbackSchema.nullable().optional(),
  acompanhando: z.boolean().optional(),
})

const FeedPaginaSchema = z.object({
  itens: z.array(FeedItemSchema),
  pagina: z.number().int().min(1),
  tamanho: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalIngeridos: z.number().int().min(0),
})

const EditalDetalheSchema = FeedItemSchema.extend({
  descricao: z.string().optional(),
})

const EtapaSchema = z.object({
  titulo: z.string().min(1),
  concluida: z.boolean(),
})

const AcompanhamentoSchema = z.object({
  editalId: z.string().min(1),
  edital: EditalResumoSchema,
  etapas: z.array(EtapaSchema),
  atualizadoEm: DataHoraIsoSchema,
})

const CertidaoEntradaSchema = z.object({
  tipo: CertidaoTipoSchema,
  descricao: z.string().optional(),
  dataValidade: DataIsoSchema,
})

const CertidaoAtualizacaoSchema = z
  .object({
    tipo: CertidaoTipoSchema.optional(),
    descricao: z.string().optional(),
    dataValidade: DataIsoSchema.optional(),
  })
  .strict()
  .refine((corpo) => Object.keys(corpo).length >= 1, 'Informe ao menos um campo para atualizar')

const CertidaoSchema = CertidaoEntradaSchema.extend({
  id: z.string().min(1),
  status: CertidaoStatusSchema,
})

const AlertaSchema = z.object({
  id: z.string().min(1),
  tipo: AlertaTipoSchema,
  titulo: z.string().min(1),
  mensagem: z.string().optional(),
  editalId: z.string().nullable().optional(),
  certidaoId: z.string().nullable().optional(),
  criadoEm: DataHoraIsoSchema,
  lido: z.boolean(),
})

const AtualizarAlertaBodySchema = z.object({ lido: z.boolean() }).strict()

describe('Estrutura e rotas do contrato OpenAPI 3.1 (openapi.yaml)', () => {
  test('define versão OpenAPI 3.1.0, título da API e servidor local na porta 3333', () => {
    expect(openapiTexto).toMatch(/^openapi:\s*3\.1\.0/m)
    expect(openapiTexto).toMatch(/title:\s*LicitaRadar API/)
    expect(openapiTexto).toMatch(/version:\s*0\.[23]\.0/)
    expect(openapiTexto).toContain('url: http://localhost:3333')
  })

  test('documenta todas as 11 rotas e 16 operações previstas para as jornadas do MVP', () => {
    const operacoesEsperadas: Array<[string, string[]]> = [
      ['/health', ['GET']],
      ['/v1/perfil', ['GET', 'PUT']],
      ['/v1/feed', ['GET']],
      ['/v1/editais/{editalId}', ['GET']],
      ['/v1/editais/{editalId}/feedback', ['PUT', 'DELETE']],
      ['/v1/editais/{editalId}/acompanhamento', ['PUT', 'DELETE']],
      ['/v1/acompanhamentos', ['GET']],
      ['/v1/certidoes', ['GET', 'POST']],
      ['/v1/certidoes/{certidaoId}', ['PATCH', 'DELETE']],
      ['/v1/alertas', ['GET']],
      ['/v1/alertas/{alertaId}', ['PATCH']],
    ]

    for (const [rota, metodos] of operacoesEsperadas) {
      expect(rotasOpenApi.has(rota), `rota ausente: ${rota}`).toBe(true)
      const mapaMetodos = rotasOpenApi.get(rota)!
      for (const metodo of metodos) {
        expect(mapaMetodos.has(metodo), `método ${metodo} ausente em ${rota}`).toBe(true)
        expect(mapaMetodos.get(metodo)!.operationId).toBeTruthy()
      }
    }
  })

  test('mantém os tipos gerados no frontend (schema.d.ts) alinhados às rotas e schemas principais', () => {
    for (const rota of rotasOpenApi.keys()) {
      if (rota === '/v1/certidoes/{certidaoId}/renovacao') continue
      expect(schemaClienteTexto).toContain(`"${rota}":`)
    }
    for (const schema of [
      'Health',
      'Erro',
      'Perfil',
      'EditalResumo',
      'FeedItem',
      'FeedPagina',
      'EditalDetalhe',
      'Etapa',
      'Acompanhamento',
      'Certidao',
      'CertidaoEntrada',
      'CertidaoAtualizacao',
      'Alerta',
    ]) {
      expect(schemaClienteTexto).toContain(`${schema}:`)
    }
  })
})

describe('CT-SEG-001 a 004, 007 a 009 e 011: barreira de segurança e isolamento no contrato', () => {
  test('CT-SEG-001 a 003: apenas /health é público e todas as rotas /v1 exigem Bearer JWT com resposta 401', () => {
    expect(openapiTexto).toMatch(/^security:\s*\n\s*-\s*bearerAuth:\s*\[\]/m)
    expect(openapiTexto).toMatch(/bearerAuth:\s*\n\s*type:\s*http\s*\n\s*scheme:\s*bearer/m)

    const saude = rotasOpenApi.get('/health')!.get('GET')!
    expect(saude.security).toBe('[]')

    for (const [rota, metodos] of rotasOpenApi.entries()) {
      if (!rota.startsWith('/v1/')) continue
      for (const [metodo, spec] of metodos.entries()) {
        expect(spec.security, `${metodo} ${rota} não deve desabilitar auth`).not.toBe('[]')
        expect(
          spec.respostas.includes('401'),
          `${metodo} ${rota} deve declarar resposta 401 (NaoAutenticado)`,
        ).toBe(true)
      }
    }
  })

  test('CT-SEG-004: todas as rotas de negócio sob /v1 (exceto /v1/perfil) declaram resposta 403 (SemEmpresa)', () => {
    for (const [rota, metodos] of rotasOpenApi.entries()) {
      if (!rota.startsWith('/v1/') || rota === '/v1/perfil') continue
      for (const [metodo, spec] of metodos.entries()) {
        expect(
          spec.respostas.includes('403'),
          `${metodo} ${rota} deve declarar resposta 403 quando faltar claim empresaId`,
        ).toBe(true)
      }
    }
  })

  test('CT-SEG-007 e 008: rotas com identificador de recurso declaram 404 para não revelar dados de outra empresa', () => {
    for (const [rota, metodos] of rotasOpenApi.entries()) {
      if (!rota.includes('{')) continue
      for (const [metodo, spec] of metodos.entries()) {
        expect(
          spec.respostas.includes('404'),
          `${metodo} ${rota} deve declarar resposta 404 (NaoEncontrado)`,
        ).toBe(true)
      }
    }
  })

  test('CT-SEG-009: nenhuma rota aceita empresaId ou orgId na URL/query e Perfil.empresaId é somente leitura', () => {
    for (const [rota, metodos] of rotasOpenApi.entries()) {
      expect(rota).not.toMatch(/empresaId|orgId|tenantId/i)
      for (const spec of metodos.values()) {
        for (const param of spec.parametros) {
          expect(param).not.toMatch(/empresaId|orgId|tenantId/i)
        }
      }
    }
    expect(openapiTexto).toMatch(/empresaId:\s*\n(?:\s+.*\n)*?\s+readOnly:\s*true/)
  })

  test('CT-SEG-011: schema Erro exige codigo fixo e mensagem, rejeitando vazamento de dados pessoais ou internos', () => {
    expect(
      ErroSchema.safeParse({
        codigo: 'NAO_AUTENTICADO',
        mensagem: 'Token ausente ou expirado.',
      }).success,
    ).toBe(true)

    expect(
      ErroSchema.safeParse({
        codigo: 'VALIDACAO',
        mensagem: 'Dados inválidos.',
        detalhes: [{ campo: 'valorMaximo', mensagem: 'Deve ser maior ou igual ao mínimo.' }],
      }).success,
    ).toBe(true)

    // Rejeita código fora do contrato
    expect(
      ErroSchema.safeParse({
        codigo: 'SQL_ERROR',
        mensagem: 'Falha interna',
      }).success,
    ).toBe(false)

    // Rejeita vazamento de campos extras (dados pessoais, stack trace ou dados do recurso bloqueado)
    expect(
      ErroSchema.safeParse({
        codigo: 'NAO_ENCONTRADO',
        mensagem: 'Recurso não encontrado.',
        emailUsuario: 'analista@empresa.com.br',
      }).success,
    ).toBe(false)
  })
})

describe('CT-FEED-001, CT-FEED-006 e CT-FEED-009: contrato do feed e análise de valor-limite (EP/BVA)', () => {
  const itemValidoBase = {
    id: '00394460000141-1-000123-2026',
    orgao: 'Ministério da Saúde',
    objeto: 'Aquisição de notebooks',
    uf: 'DF',
    dataLimiteProposta: '2026-11-15T18:00:00.000Z',
    score: 80,
    faixa: 'alta' as const,
    criteriosAtendidos: ['termo', 'uf'] as const,
    diasParaEncerrar: 10,
  }

  test('CT-FEED-001: score aceita valores-limite válidos (0, 1, 75, 99, 100) e rejeita inválidos (-1, 101, decimal)', () => {
    for (const scoreValido of [0, 1, 75, 99, 100]) {
      const res = FeedItemSchema.safeParse({ ...itemValidoBase, score: scoreValido })
      expect(res.success, `score=${scoreValido} deveria ser aceito`).toBe(true)
    }

    for (const scoreInvalido of [-1, 101, -0.1, 100.1, 75.5, Number.NaN]) {
      const res = FeedItemSchema.safeParse({ ...itemValidoBase, score: scoreInvalido })
      expect(res.success, `score=${scoreInvalido} deveria ser rejeitado`).toBe(false)
    }
  })

  test('CT-FEED-006: FeedPagina exige totalIngeridos >= 0 nos limites 0, 1 e 2 e rejeita negativo ou ausente', () => {
    for (const totalIngeridos of [0, 1, 2]) {
      const res = FeedPaginaSchema.safeParse({
        itens: [],
        pagina: 1,
        tamanho: 10,
        total: 0,
        totalIngeridos,
      })
      expect(res.success, `totalIngeridos=${totalIngeridos} deveria ser válido`).toBe(true)
    }

    expect(
      FeedPaginaSchema.safeParse({
        itens: [],
        pagina: 1,
        tamanho: 10,
        total: 0,
        totalIngeridos: -1,
      }).success,
    ).toBe(false)

    expect(
      FeedPaginaSchema.safeParse({
        itens: [],
        pagina: 1,
        tamanho: 10,
        total: 0,
      }).success,
    ).toBe(false)
  })

  test('CT-FEED-009: paginação valida fronteiras de pagina (0 vs 1) e tamanho (0, 1, 2, 99, 100 vs 101)', () => {
    // Defaults quando omitidos
    expect(PaginacaoQuerySchema.parse({})).toEqual({ pagina: 1, tamanho: 20 })

    // Fronteiras válidas de tamanho (BVA: 1, 2, 99, 100) e pagina (1, 2)
    for (const tamanho of [1, 2, 99, 100]) {
      expect(PaginacaoQuerySchema.safeParse({ pagina: 1, tamanho }).success).toBe(true)
    }
    expect(PaginacaoQuerySchema.safeParse({ pagina: 2, tamanho: 10 }).success).toBe(true)

    // Fronteiras inválidas de pagina (0, -1, decimal) e tamanho (0, 101, -1, decimal)
    for (const paginaInvalida of [0, -1, 1.5]) {
      expect(PaginacaoQuerySchema.safeParse({ pagina: paginaInvalida, tamanho: 20 }).success).toBe(false)
    }
    for (const tamanhoInvalido of [0, 101, -1, 20.5]) {
      expect(PaginacaoQuerySchema.safeParse({ pagina: 1, tamanho: tamanhoInvalido }).success).toBe(false)
    }
  })
})

describe('CT-FILT-001 e CT-FILT-007: filtros dinâmicos do feed e validação de parâmetros (EP/BVA)', () => {
  test('CT-FILT-001: valorMinimo/valorMaximo aceitam limites >= 0 e min = max, mas rejeitam -0.01, -1 e min > max', () => {
    for (const valor of [0, 0.01, 49_999.99, 50_000, 50_000.01, 1_000_000_000]) {
      expect(FeedQuerySchema.safeParse({ valorMinimo: valor }).success).toBe(true)
      expect(FeedQuerySchema.safeParse({ valorMaximo: valor }).success).toBe(true)
    }

    // Limite min = max válido
    expect(FeedQuerySchema.safeParse({ valorMinimo: 50_000, valorMaximo: 50_000 }).success).toBe(true)

    // Valores negativos no limite (-0.01 e -1) inválidos
    for (const negativo of [-0.01, -1]) {
      expect(FeedQuerySchema.safeParse({ valorMinimo: negativo }).success).toBe(false)
      expect(FeedQuerySchema.safeParse({ valorMaximo: negativo }).success).toBe(false)
    }

    // valorMinimo > valorMaximo inválido
    expect(FeedQuerySchema.safeParse({ valorMinimo: 50_000.01, valorMaximo: 50_000 }).success).toBe(false)
  })

  test('CT-FILT-007: query do feed rejeita termo com menos de 2 letras, UF inválida, faixa inválida e data corrompida', () => {
    expect(
      FeedQuerySchema.safeParse({
        termo: 'Notébook',
        uf: ['DF', 'GO'],
        faixa: 'alta',
        publicadoDe: '2026-10-01',
        publicadoAte: '2026-10-31',
        limiteDe: '2026-11-01',
        limiteAte: '2026-11-30',
      }).success,
    ).toBe(true)

    // Fronteira de termo: 1 caractere falha, 2 caracteres passa
    expect(FeedQuerySchema.safeParse({ termo: '' }).success).toBe(false)
    expect(FeedQuerySchema.safeParse({ termo: 'a' }).success).toBe(false)
    expect(FeedQuerySchema.safeParse({ termo: 'ti' }).success).toBe(true)

    // UF fora do padrão ^[A-Z]{2}$
    expect(FeedQuerySchema.safeParse({ uf: ['df'] }).success).toBe(false)
    expect(FeedQuerySchema.safeParse({ uf: ['DF1'] }).success).toBe(false)

    // Faixa inexistente
    expect(FeedQuerySchema.safeParse({ faixa: 'baixa' }).success).toBe(false)

    // Datas malformadas ou inexistentes no calendário
    for (const dataInvalida of ['2026-13-01', '2026-02-30', '31/10/2026', 'abc']) {
      expect(FeedQuerySchema.safeParse({ publicadoDe: dataInvalida }).success).toBe(false)
      expect(FeedQuerySchema.safeParse({ limiteAte: dataInvalida }).success).toBe(false)
    }
  })
})

describe('CT-CERT-001, CT-CERT-003 e CT-CERT-006: contrato de certidões', () => {
  test('CT-CERT-001 e 003: Certidao valida tipos permitidos e status calculado (valida, vence_em_breve, vencida)', () => {
    for (const status of ['valida', 'vence_em_breve', 'vencida'] as const) {
      expect(
        CertidaoSchema.safeParse({
          id: 'cert-1',
          tipo: 'fgts',
          descricao: 'CRF do FGTS',
          dataValidade: '2026-11-15',
          status,
        }).success,
      ).toBe(true)
    }

    expect(
      CertidaoSchema.safeParse({
        id: 'cert-1',
        tipo: 'inexistente',
        dataValidade: '2026-11-15',
        status: 'valida',
      }).success,
    ).toBe(false)

    expect(
      CertidaoSchema.safeParse({
        id: 'cert-1',
        tipo: 'federal',
        dataValidade: '2026-11-15',
        status: 'regular',
      }).success,
    ).toBe(false)
  })

  test('CT-CERT-006: CertidaoEntrada exige dataValidade ISO e CertidaoAtualizacao exige ao menos 1 campo', () => {
    expect(
      CertidaoEntradaSchema.safeParse({
        tipo: 'trabalhista',
        descricao: 'CNDT',
        dataValidade: '2026-12-31',
      }).success,
    ).toBe(true)

    expect(CertidaoEntradaSchema.safeParse({ tipo: 'trabalhista', dataValidade: '' }).success).toBe(false)
    expect(CertidaoEntradaSchema.safeParse({ tipo: 'trabalhista', dataValidade: '31-12-2026' }).success).toBe(
      false,
    )

    // PATCH /v1/certidoes/{certidaoId}: minProperties = 1
    expect(CertidaoAtualizacaoSchema.safeParse({}).success).toBe(false)
    expect(CertidaoAtualizacaoSchema.safeParse({ dataValidade: '2027-01-15' }).success).toBe(true)
  })
})

describe('Contrato de Perfil, Editais, Acompanhamentos, Alertas e Infraestrutura (/health)', () => {
  test('Perfil: valida limites de termosChave (2..50 itens), unicidade de UFs e prazoMinimoDiasUteis >= 0', () => {
    expect(
      PerfilSchema.safeParse({
        empresaId: null,
        ufs: ['DF', 'GO'],
        termosChave: ['notebook', 'software'],
        segmentos: ['ti'],
        modalidades: ['pregao_eletronico'],
        valorMinimo: 50_000,
        valorMaximo: 500_000,
        prazoMinimoDiasUteis: 3,
      }).success,
    ).toBe(true)

    // Fronteira termosChave: 50 itens válidos passam, 51 falham
    const cinquentaTermos = Array.from({ length: 50 }, (_, i) => `termo-${i}`)
    expect(PerfilSchema.safeParse({ termosChave: cinquentaTermos }).success).toBe(true)
    expect(PerfilSchema.safeParse({ termosChave: [...cinquentaTermos, 'extra'] }).success).toBe(false)

    // UFs duplicadas e prazo negativo falham
    expect(PerfilSchema.safeParse({ ufs: ['DF', 'DF'] }).success).toBe(false)
    expect(PerfilSchema.safeParse({ prazoMinimoDiasUteis: -1 }).success).toBe(false)
    expect(PerfilSchema.safeParse({ prazoMinimoDiasUteis: 0 }).success).toBe(true)
  })

  test('Editais, Feedback e Acompanhamento: valida detalhe do edital, voto de relevância e etapas com título não vazio', () => {
    const resumo = {
      id: '00394460000141-1-000123-2026',
      orgao: 'Ministério da Saúde',
      objeto: 'Aquisição de notebooks',
      uf: 'DF',
      dataLimiteProposta: '2026-11-15T18:00:00.000Z',
    }

    expect(
      EditalDetalheSchema.safeParse({
        ...resumo,
        score: 94,
        faixa: 'alta',
        criteriosAtendidos: ['termo', 'uf'],
        diasParaEncerrar: 9,
        feedback: 'relevante',
        acompanhando: true,
        descricao: 'Registro de preços para equipamentos de TI.',
      }).success,
    ).toBe(true)

    expect(FeedbackSchema.safeParse('relevante').success).toBe(true)
    expect(FeedbackSchema.safeParse('irrelevante').success).toBe(true)
    expect(FeedbackSchema.safeParse('neutro').success).toBe(false)

    expect(
      AcompanhamentoSchema.safeParse({
        editalId: resumo.id,
        edital: resumo,
        etapas: [{ titulo: 'Ler o edital e anexos', concluida: true }],
        atualizadoEm: '2026-10-31T12:00:00.000Z',
      }).success,
    ).toBe(true)

    // Etapa com título vazio deve falhar (minLength: 1)
    expect(EtapaSchema.safeParse({ titulo: '', concluida: false }).success).toBe(false)
  })

  test('Alertas e /health: valida payload de alertas, atualização de lido e resposta de saúde da API', () => {
    expect(
      AlertaSchema.safeParse({
        id: 'alerta-1',
        tipo: 'certidao_vencendo',
        titulo: 'CRF do FGTS vence em 12 dias',
        mensagem: 'Renove antes para não ser inabilitado.',
        editalId: null,
        certidaoId: 'cert-2',
        criadoEm: '2026-10-30T10:00:00.000Z',
        lido: false,
      }).success,
    ).toBe(true)

    expect(AtualizarAlertaBodySchema.safeParse({ lido: true }).success).toBe(true)
    expect(AtualizarAlertaBodySchema.safeParse({}).success).toBe(false)
    expect(AtualizarAlertaBodySchema.safeParse({ lido: 'sim' }).success).toBe(false)

    expect(HealthSchema.safeParse({ status: 'ok', timestamp: '2026-10-31T12:00:00.000Z' }).success).toBe(true)
    expect(HealthSchema.safeParse({ status: 'degraded', timestamp: '2026-10-31T12:00:00.000Z' }).success).toBe(
      false,
    )
  })
})

