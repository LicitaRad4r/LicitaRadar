import { readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../src/app.js'
import type { Usuario } from '../../src/auth.js'
import type { Edital, RegistroScore } from '../../src/dominio/edital.js'
import { criarFontePncp, opcoesPncpDoAmbiente } from '../../src/ingestao/cliente-pncp.js'
import { contratacoesFixture, fonteFixture } from '../../src/ingestao/fixtures.js'
import { dataComFuso, idDoEdital, normalizarContratacao } from '../../src/ingestao/pncp.js'
import { executarIngestao, type IngestaoRepo, type ResultadoIngestao } from '../../src/ingestao/servico.js'
import { EMPRESAS } from '../../src/seed/golden.js'
import { auth } from './ajudantes.js'

/** Ingestão do PNCP: adapter, cliente HTTP, serviço (editais + scores), rota do job e saúde da API. */
const agora = new Date('2026-11-03T13:00:00Z') // terça-feira, 10h em Brasília
const lerJson = (nome: string) => JSON.parse(readFileSync(new URL(`../fixtures/pncp/${nome}`, import.meta.url), 'utf8'))
const pagina1 = lerJson('proposta-pregao-pagina-1.json')
const pagina2 = lerJson('proposta-pregao-pagina-2.json')

describe('adapter do PNCP', () => {
  it('converte data sem fuso para Brasília (UTC-03:00) e respeita fuso explícito', () => {
    expect(dataComFuso('2026-11-20T09:00:00')).toBe('2026-11-20T12:00:00.000Z')
    expect(dataComFuso('2026-11-25T14:00:00-03:00')).toBe('2026-11-25T17:00:00.000Z')
    expect(dataComFuso('2026-11-20T12:00:00Z')).toBe('2026-11-20T12:00:00.000Z')
    expect(dataComFuso('2026-11-02')).toBe('2026-11-02T03:00:00.000Z')
    expect(dataComFuso('lixo')).toBeNull()
    expect(dataComFuso(null)).toBeNull()
  })

  it('o id do edital não tem "/" (vira id de documento e parâmetro de rota)', () => {
    expect(idDoEdital('00394460000141-1-000321/2026')).toBe('00394460000141-1-000321-2026')
  })

  it('normaliza uma contratação completa para o Edital do domínio', () => {
    const r = normalizarContratacao(pagina1.data[0], agora)
    expect(r).toEqual({
      edital: {
        id: '00394460000141-1-000321-2026',
        objeto: 'Aquisição de notebooks para laboratórios de informática',
        descricao: 'Garantia mínima de 36 meses.',
        orgao: 'Universidade de Brasília',
        uf: 'DF',
        municipio: 'Brasília',
        modalidade: 'pregao_eletronico',
        segmento: null,
        valorEstimado: 180000.5,
        dataPublicacao: '2026-11-02T03:00:00.000Z',
        dataLimite: '2026-11-20T12:00:00.000Z',
      },
    })
  })

  it('valor 0 (sigiloso) vira null; sem razão social usa o nome da unidade; sem município vira null', () => {
    const r = normalizarContratacao(pagina1.data[1], agora)
    expect(r).toMatchObject({ edital: { valorEstimado: null, orgao: 'Prefeitura de Goiânia', descricao: '' } })
    const sem = normalizarContratacao({ ...pagina2.data[0], unidadeOrgao: { ufSigla: 'rs' } }, agora)
    expect(sem).toMatchObject({ edital: { uf: 'RS', municipio: null } })
  })

  it('lê o órgão em `razaoSocial` (resposta real do PNCP) e em `razaosocial` (manual)', () => {
    const real = {
      numeroControlePNCP: '08761140000194-1-000040/2025',
      objetoCompra: 'REGISTRO DE PREÇOS PARA AQUISIÇÃO DE EQUIPAMENTOS DE SEGURANÇA',
      informacaoComplementar: 'EQUIPAMENTOS DE SEGURANÇA PARA GAR',
      modalidadeId: 6,
      valorTotalEstimado: 9732643.43,
      dataPublicacaoPncp: '2025-03-13T14:10:37',
      dataEncerramentoProposta: '2026-11-09T23:59:59',
      orgaoEntidade: { cnpj: '08761140000194', razaoSocial: 'SECRETARIA DE ESTADO DA ADMINISTRACAO', poderId: 'E', esferaId: 'E' },
      unidadeOrgao: { ufSigla: 'PB', municipioNome: 'João Pessoa', nomeUnidade: 'UNIDADE X' },
    }
    expect(normalizarContratacao(real, agora)).toMatchObject({
      edital: { id: '08761140000194-1-000040-2025', orgao: 'SECRETARIA DE ESTADO DA ADMINISTRACAO', uf: 'PB', modalidade: 'pregao_eletronico' },
    })
    const manual = { ...real, orgaoEntidade: { razaosocial: 'ORGAO DO MANUAL' } }
    expect(normalizarContratacao(manual, agora)).toMatchObject({ edital: { orgao: 'ORGAO DO MANUAL' } })
  })

  it('mapeia as modalidades suportadas e ignora as demais', () => {
    const modalidade = (id: number) => normalizarContratacao({ ...pagina2.data[0], modalidadeId: id }, agora)
    expect(modalidade(6)).toMatchObject({ edital: { modalidade: 'pregao_eletronico' } })
    expect(modalidade(4)).toMatchObject({ edital: { modalidade: 'concorrencia' } })
    expect(modalidade(5)).toMatchObject({ edital: { modalidade: 'concorrencia' } })
    expect(modalidade(8)).toMatchObject({ edital: { modalidade: 'dispensa' } })
    for (const id of [1, 7, 9, 12]) expect(modalidade(id)).toEqual({ ignorada: 'modalidade' })
  })

  it('ignora: sem prazo, proposta já encerrada, sem UF e registro inválido', () => {
    const base = pagina2.data[0]
    expect(normalizarContratacao({ ...base, dataEncerramentoProposta: null }, agora)).toEqual({ ignorada: 'sem_prazo' })
    expect(normalizarContratacao({ ...base, dataEncerramentoProposta: '2026-11-03T09:59:00' }, agora)).toEqual({ ignorada: 'encerrada' })
    expect(normalizarContratacao({ ...base, unidadeOrgao: { ufSigla: '' } }, agora)).toEqual({ ignorada: 'sem_uf' })
    expect(normalizarContratacao({ ...base, unidadeOrgao: null }, agora)).toEqual({ ignorada: 'sem_uf' })
    expect(normalizarContratacao({ ...base, objetoCompra: '   ' }, agora)).toEqual({ ignorada: 'invalida' })
    expect(normalizarContratacao({ modalidadeId: 6 }, agora)).toEqual({ ignorada: 'invalida' })
    expect(normalizarContratacao(null, agora)).toEqual({ ignorada: 'invalida' })
  })
})

describe('opções do PNCP pelo ambiente', () => {
  it('lê as variáveis, usa o padrão quando faltam e recusa valor inválido', () => {
    expect(opcoesPncpDoAmbiente({})).toEqual({ baseUrl: undefined, diasAFrente: undefined, maxPaginas: undefined, intervaloMs: undefined })
    expect(opcoesPncpDoAmbiente({ PNCP_MAX_PAGINAS: '2', PNCP_INTERVALO_MS: '8000', PNCP_DIAS_A_FRENTE: '15', PNCP_BASE_URL: 'http://x' })).toEqual({
      baseUrl: 'http://x', diasAFrente: 15, maxPaginas: 2, intervaloMs: 8000,
    })
    expect(() => opcoesPncpDoAmbiente({ PNCP_MAX_PAGINAS: 'abc' })).toThrow(/PNCP_MAX_PAGINAS inválida/)
  })
})

describe('cliente do PNCP', () => {
  const resposta = (corpo: unknown, status = 200) =>
    status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
  const semEspera = async () => {}

  it('consulta propostas em aberto por modalidade, pagina até acabar e não repete modalidade vazia (204)', async () => {
    const urls: string[] = []
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url))
      urls.push(String(url))
      if (u.searchParams.get('codigoModalidadeContratacao') !== '6') return resposta(null, 204)
      return resposta(u.searchParams.get('pagina') === '1' ? pagina1 : pagina2)
    })
    const busca = await criarFontePncp({ fetchImpl: fetchImpl as unknown as typeof fetch, esperar: semEspera })(agora)

    expect(busca.contratacoes).toHaveLength(3)
    expect(busca.falhas).toEqual([])
    const u6 = urls.filter((u) => u.includes('codigoModalidadeContratacao=6'))
    expect(u6).toHaveLength(2) // páginas 1 e 2
    const primeira = new URL(u6[0]!)
    expect(primeira.origin + primeira.pathname).toBe('https://pncp.gov.br/api/consulta/v1/contratacoes/proposta')
    expect(primeira.searchParams.get('dataFinal')).toBe('20261203') // hoje (03/11) + 30 dias
    expect(primeira.searchParams.get('pagina')).toBe('1')
    expect(primeira.searchParams.get('tamanhoPagina')).toBe('50')
    expect(primeira.searchParams.has('dataInicial')).toBe(false)
    // As outras 3 modalidades (4, 5, 8) responderam 204 e pararam na 1ª página.
    expect(urls).toHaveLength(2 + 3)
  })

  it('repete em 503 e 429 e depois segue; não repete em 400 nem 422', async () => {
    const esperar = vi.fn(async () => {})
    let chamadas = 0
    const instavel = vi.fn(async () => (++chamadas === 1 ? resposta({}, 503) : chamadas === 2 ? resposta({}, 429) : resposta(pagina2)))
    const ok = await criarFontePncp({ modalidades: [6], fetchImpl: instavel as unknown as typeof fetch, esperar })(agora)
    expect(ok.contratacoes).toHaveLength(1)
    expect(instavel).toHaveBeenCalledTimes(3)
    expect(esperar).toHaveBeenCalledTimes(2)

    for (const status of [400, 422]) {
      const ruim = vi.fn(async () => resposta({}, status))
      await expect(criarFontePncp({ modalidades: [6], fetchImpl: ruim as unknown as typeof fetch, esperar })(agora)).rejects.toThrow()
      expect(ruim, String(status)).toHaveBeenCalledTimes(1)
    }
  })

  it('429: respeita o Retry-After, espera cada vez mais (limite de taxa do PNCP) e segue com o que já coletou se as falhas vierem depois', async () => {
    const esperas: number[] = []
    const esperar = async (ms: number) => void esperas.push(ms)
    let n = 0
    const limitado = vi.fn(async () => {
      n++
      if (n === 1) return new Response('{}', { status: 429, headers: { 'retry-after': '7' } })
      if (n <= 3) return new Response('{}', { status: 429 })
      return resposta(pagina2)
    })
    const ok = await criarFontePncp({ modalidades: [6], fetchImpl: limitado as unknown as typeof fetch, esperar })(agora)
    expect(ok.contratacoes).toHaveLength(1)
    expect(esperas).toEqual([7000, 10_000, 20_000]) // Retry-After; sem ele, 429 espera 10 s e 20 s (5 s × 2^n)

    // Padrões: pausa de 5 s entre requisições e 3 páginas por modalidade (o PNCP aceita poucas chamadas por minuto).
    const padrao: number[] = []
    const vazio = vi.fn(async () => resposta(null, 204))
    await criarFontePncp({ modalidades: [6, 4], fetchImpl: vazio as unknown as typeof fetch, esperar: async (ms) => void padrao.push(ms) })(agora)
    expect(padrao).toEqual([5000])

    // Pausa entre requisições (páginas e modalidades): 1ª sem pausa, as demais com `intervaloMs`.
    const pausas: number[] = []
    const fetchImpl = vi.fn(async () => resposta(null, 204))
    await criarFontePncp({ modalidades: [6, 4, 5], intervaloMs: 123, fetchImpl: fetchImpl as unknown as typeof fetch, esperar: async (ms) => void pausas.push(ms) })(agora)
    expect(pausas).toEqual([123, 123])

    // Páginas já coletadas não se perdem se a modalidade falha depois (todas falhando = só erro se nada veio).
    let k = 0
    const meio = vi.fn(async () => (++k === 1 ? resposta({ ...pagina1, paginasRestantes: 1 }) : resposta({}, 429)))
    const parcial = await criarFontePncp({ modalidades: [6], tentativas: 1, fetchImpl: meio as unknown as typeof fetch, esperar: semEspera })(agora)
    expect(parcial.contratacoes.length).toBeGreaterThan(0)
    expect(parcial.falhas).toEqual(['modalidade 6: HTTP 429'])
  })

  it('uma modalidade que falha não derruba as outras; se todas falham, dá erro', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      new URL(String(url)).searchParams.get('codigoModalidadeContratacao') === '4' ? resposta({}, 500) : resposta(pagina2),
    )
    const parcial = await criarFontePncp({ modalidades: [6, 4], tentativas: 2, fetchImpl: fetchImpl as unknown as typeof fetch, esperar: semEspera })(agora)
    expect(parcial.contratacoes).toHaveLength(1)
    expect(parcial.falhas).toEqual(['modalidade 4: HTTP 500'])

    const rede = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(criarFontePncp({ modalidades: [6], tentativas: 2, fetchImpl: rede as unknown as typeof fetch, esperar: semEspera })(agora)).rejects.toThrow(/Nenhuma modalidade/)
    // O erro final diz o porquê (tipo/código de rede), sem a mensagem original nem a URL.
    await expect(criarFontePncp({ modalidades: [6], tentativas: 1, fetchImpl: rede as unknown as typeof fetch, esperar: semEspera })(agora)).rejects.toThrow(/modalidade 6: sem resposta \(/)
  })

  it('respeita o teto de páginas por modalidade', async () => {
    const infinita = vi.fn(async () => resposta({ ...pagina1, paginasRestantes: 99 }))
    const busca = await criarFontePncp({ modalidades: [6], maxPaginas: 3, fetchImpl: infinita as unknown as typeof fetch, esperar: semEspera })(agora)
    expect(infinita).toHaveBeenCalledTimes(3)
    expect(busca.contratacoes).toHaveLength(6)
  })
})

function repoMemoria() {
  const editais = new Map<string, Edital>()
  const scores = new Map<string, RegistroScore>()
  const repo: IngestaoRepo = {
    empresas: async () => EMPRESAS.map((e) => ({ id: e.id, perfil: e.perfil })),
    gravarEditais: async (lista) => lista.forEach((e) => editais.set(e.id, e)),
    gravarScores: async (lista) => lista.forEach((s) => scores.set(`${s.empresaId}_${s.editalId}`, s)),
    removerScores: async (pares) => pares.forEach((p) => scores.delete(`${p.empresaId}_${p.editalId}`)),
  }
  return { repo, editais, scores }
}

describe('serviço de ingestão', () => {
  it('grava os editais e calcula o score de cada empresa; ignora e descarta o que não serve', async () => {
    const { repo, editais, scores } = repoMemoria()
    const r = await executarIngestao({ fonte: fonteFixture, repo, agora: () => agora })

    expect(r).toEqual({
      recebidas: 10,
      editaisGravados: 8,
      ignoradas: { invalida: 0, modalidade: 1, sem_prazo: 1, sem_uf: 0, encerrada: 0 },
      falhasPncp: [],
      empresas: 2,
      scoresGravados: 6,
      scoresRemovidos: 10, // 2 empresas × 8 editais − 6 pontuados
    })
    expect(editais.size).toBe(8)
    const nota = (empresa: string, n: number) => scores.get(`${empresa}_00394460000141-1-${String(n).padStart(6, '0')}-2026`)
    // Empresa A (DF/GO, notebook/impressora): notebooks no DF = 100; TI em GO com notebook só na descrição = 75; RS fora da UF = 75.
    expect(nota('emp-a', 101)).toMatchObject({ nota: 100, faixa: 'alta' })
    expect(nota('emp-a', 102)).toMatchObject({ nota: 75, faixa: 'media' })
    expect(nota('emp-a', 103)).toMatchObject({ nota: 75, faixa: 'media' })
    // Empresa B (RS, só notebook): o do RS = 100; o do DF perde os 25 pontos de UF.
    expect(nota('emp-b', 103)).toMatchObject({ nota: 100, faixa: 'alta' })
    expect(nota('emp-b', 101)).toMatchObject({ nota: 75, faixa: 'media' })
    // Descartados pelo funil: valor 10%+ acima (107), prazo curto (108), modalidade fora do perfil (104, 105), sem termo (106).
    for (const n of [104, 105, 106, 107, 108]) {
      expect(nota('emp-a', n), `emp-a ${n}`).toBeUndefined()
      expect(nota('emp-b', n), `emp-b ${n}`).toBeUndefined()
    }
  })

  it('é idempotente (rodar de novo não duplica) e remove o score de um edital que passou a ser descartado', async () => {
    const { repo, editais, scores } = repoMemoria()
    await executarIngestao({ fonte: fonteFixture, repo, agora: () => agora })
    const antes = new Set(scores.keys())
    await executarIngestao({ fonte: fonteFixture, repo, agora: () => agora })
    expect(new Set(scores.keys())).toEqual(antes)
    expect(editais.size).toBe(8)

    // O edital 101 teve o valor corrigido para fora da faixa das duas empresas: o score antigo some.
    const alterado = contratacoesFixture(agora).map((c) => (c.numeroControlePNCP.includes('000101') ? { ...c, valorTotalEstimado: 900000 } : c))
    await executarIngestao({ fonte: async () => ({ contratacoes: alterado, falhas: [] }), repo, agora: () => agora })
    expect(scores.has('emp-a_00394460000141-1-000101-2026')).toBe(false)
    expect(scores.has('emp-b_00394460000141-1-000101-2026')).toBe(false)
  })

  it('repete o mesmo edital no lote sem duplicar e informa as falhas parciais do PNCP', async () => {
    const { repo, editais } = repoMemoria()
    const [a] = contratacoesFixture(agora)
    const r = await executarIngestao({ fonte: async () => ({ contratacoes: [a, a], falhas: ['modalidade 4: HTTP 500'] }), repo, agora: () => agora })
    expect(editais.size).toBe(1)
    expect(r).toMatchObject({ recebidas: 2, editaisGravados: 1, falhasPncp: ['modalidade 4: HTTP 500'] })
  })

  it('empresa com perfil inválido é pulada, sem derrubar a ingestão', async () => {
    const { repo } = repoMemoria()
    const comInvalida: IngestaoRepo = { ...repo, empresas: async () => [{ id: 'emp-x', perfil: { ufs: ['xx'] } as never }, ...(await repo.empresas())] }
    const r = await executarIngestao({ fonte: fonteFixture, repo: comInvalida, agora: () => agora })
    expect(r.empresas).toBe(2)
  })
})

describe('POST /jobs/ingestao-pncp (token do job)', () => {
  const TOKEN = 'token-do-job-com-bastante-entropia-0123456789'
  const usuarios: Record<string, Usuario> = { decisorA: { uid: 'u-dec-a', empresaId: 'emp-a', role: 'decisor' } }
  const resultado: ResultadoIngestao = {
    recebidas: 1, editaisGravados: 1, ignoradas: { invalida: 0, modalidade: 0, sem_prazo: 0, sem_uf: 0, encerrada: 0 }, falhasPncp: [], empresas: 1, scoresGravados: 1, scoresRemovidos: 0,
  }

  function criar(opcoes: { tokenJob?: string | null; ingestao?: () => Promise<ResultadoIngestao>; linhas?: string[] } = {}) {
    const executar = vi.fn(opcoes.ingestao ?? (async () => resultado))
    const logStream = opcoes.linhas
      ? new Writable({ write(chunk, _e, cb) { opcoes.linhas!.push(String(chunk)); cb() } })
      : undefined
    const app = buildApp({
      logger: false,
      logStream,
      agora: () => agora,
      tokenJob: opcoes.tokenJob === null ? undefined : (opcoes.tokenJob ?? TOKEN),
      ingestao: executar,
      feed: { editais: async () => [], scores: async () => [] },
      perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
      definirClaims: async () => {},
      certidoes: { listar: async () => [], obter: async () => null, salvar: async () => {} },
      arquivos: { salvar: async () => {} },
      verificarToken: async (t) => {
        const u = usuarios[t]
        if (!u) throw new Error('invalido')
        return u
      },
    })
    return { app, executar }
  }
  const chamar = (app: ReturnType<typeof criar>['app'], headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: '/jobs/ingestao-pncp', headers: { 'content-type': 'application/json', ...headers }, payload: '{}' })

  it('com o token do job, executa e devolve o resumo', async () => {
    const { app, executar } = criar()
    const r = await chamar(app, auth(TOKEN))
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual(resultado)
    expect(executar).toHaveBeenCalledTimes(1)
  })

  it('sem token, com token errado, esquema errado ou token de usuário do Firebase: 401 e nada executa', async () => {
    const { app, executar } = criar()
    for (const headers of [{}, auth('errado'), auth(TOKEN + 'x'), auth(TOKEN.slice(0, -1)), { authorization: `Basic ${TOKEN}` }, { authorization: TOKEN }, auth('decisorA')]) {
      const r = await chamar(app, headers)
      expect(r.statusCode, JSON.stringify(headers)).toBe(401)
      expect(r.json().codigo).toBe('NAO_AUTENTICADO')
      expect(r.json().requestId).toBeTruthy()
    }
    expect(executar).not.toHaveBeenCalled()
  })

  it('sem INGEST_JOB_TOKEN configurado no servidor, nenhum valor passa', async () => {
    const { app, executar } = criar({ tokenJob: null })
    for (const t of [TOKEN, '', 'undefined', 'null']) {
      const r = await chamar(app, t ? auth(t) : {})
      expect(r.statusCode, t).toBe(401)
    }
    expect(executar).not.toHaveBeenCalled()
  })

  it('o token do job não abre as rotas de negócio, e a rota não responde a GET', async () => {
    const { app } = criar()
    for (const url of ['/feed', '/v1/feed', '/certidoes', '/v1/perfil']) {
      const r = await app.inject({ method: 'GET', url, headers: auth(TOKEN) })
      expect(r.statusCode, url).toBe(401)
    }
    const get = await app.inject({ method: 'GET', url: '/jobs/ingestao-pncp', headers: auth(TOKEN) })
    expect(get.statusCode).toBe(404)
    const prefixo = await chamar(app, auth(TOKEN)).then(() => app.inject({ method: 'POST', url: '/v1/jobs/ingestao-pncp', headers: auth(TOKEN), payload: '{}' }))
    expect(prefixo.statusCode).toBe(401) // fora de /jobs/ingestao-pncp vale o token do Firebase, não o do job
  })

  it('sem a função de ingestão configurada a rota não existe (mas continua protegida)', async () => {
    const semRota = buildApp({
      logger: false,
      tokenJob: TOKEN,
      feed: { editais: async () => [], scores: async () => [] },
      perfis: { ler: async () => null, salvar: async () => {}, criar: async () => 'x' },
      definirClaims: async () => {},
      certidoes: { listar: async () => [], obter: async () => null, salvar: async () => {} },
      arquivos: { salvar: async () => {} },
      verificarToken: async () => {
        throw new Error('invalido')
      },
    })
    expect((await chamar(semRota)).statusCode).toBe(401)
    expect((await chamar(semRota, auth(TOKEN))).statusCode).toBe(404)
  })

  it('falha na ingestão responde 502 sem expor detalhes', async () => {
    const { app } = criar({ ingestao: async () => { throw new Error('conexao recusada em https://pncp.gov.br/segredo') } })
    const r = await chamar(app, auth(TOKEN))
    expect(r.statusCode).toBe(502)
    expect(r.json()).toEqual({ codigo: 'ERRO_INTERNO', mensagem: expect.not.stringContaining('pncp'), requestId: expect.any(String) })
  })

  it('o log de uma tentativa bloqueada traz só requestId, rota e status (sem o token)', async () => {
    const linhas: string[] = []
    const { app } = criar({ linhas })
    await chamar(app, auth('token-secreto-que-nao-pode-vazar'))
    const bloqueio = linhas.map((l) => JSON.parse(l)).find((l) => l.msg === 'acesso bloqueado')
    expect(bloqueio).toBeDefined()
    expect(Object.keys(bloqueio).sort()).toEqual(['level', 'msg', 'requestId', 'route', 'status', 'time'])
    expect(linhas.join('')).not.toContain('token-secreto-que-nao-pode-vazar')
  })
})

describe('saúde da API (/healthz e /readyz)', () => {
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
  }

  it('são públicas (sem token) e /readyz fica pronto quando as dependências respondem', async () => {
    const app = buildApp({ ...base, prontidao: async () => {} })
    const h = await app.inject({ method: 'GET', url: '/healthz' })
    expect(h.statusCode).toBe(200)
    expect(h.json()).toEqual({ status: 'ok' })
    const r = await app.inject({ method: 'GET', url: '/readyz' })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ status: 'ready' })
    expect((await buildApp(base).inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(200)
  })

  it('/readyz responde 503 quando uma dependência falha, sem detalhes no corpo nem dados', async () => {
    const app = buildApp({ ...base, prontidao: async () => { throw new Error('firestore: credencial X expirada') } })
    const r = await app.inject({ method: 'GET', url: '/readyz' })
    expect(r.statusCode).toBe(503)
    expect(r.json()).toEqual({ status: 'unavailable' })
    expect(r.body).not.toContain('credencial')
    // /healthz continua 200: a API está de pé mesmo com a dependência fora.
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200)
  })

  it('não abrem rota de negócio: o resto continua exigindo token', async () => {
    const app = buildApp(base)
    for (const url of ['/healthz/x', '/readyz/', '/v1/healthz', '/v1/readyz']) {
      expect((await app.inject({ method: 'GET', url })).statusCode, url).toBe(401)
    }
  })
})
