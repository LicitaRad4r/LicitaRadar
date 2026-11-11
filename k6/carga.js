import http from 'k6/http'
import { check, sleep } from 'k6'
 
const API = (__ENV.API_URL || 'http://localhost:3333').replace(/\/$/, '')
const AUTH = (__ENV.AUTH_URL || 'http://localhost:9099').replace(/\/$/, '')
const EMAIL = __ENV.EMAIL || 'decisor.a@licitaradar.local'
const SENHA = __ENV.SENHA || 'senha-local-123'
const VUS = Number(__ENV.VUS || 5)
const VUS_ESCRITA = Number(__ENV.VUS_ESCRITA || 2)
const CURTO = __ENV.CURTO === '1'
const SAIDA = __ENV.SAIDA || 'k6/resultado-k6'
 
// Trava: este teste só roda contra a máquina local, para nunca gastar a cota do Firestore de produção.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?(\/|$)/
if (!LOCAL.test(API) || !LOCAL.test(AUTH)) {
  throw new Error(`API_URL e AUTH_URL precisam apontar para a máquina local (recebido: ${API} e ${AUTH}).`)
}
 
const etapas = CURTO
  ? (alvo) => [{ duration: '5s', target: alvo }, { duration: '8s', target: alvo }, { duration: '2s', target: 0 }]
  : (alvo) => [{ duration: '20s', target: alvo }, { duration: '60s', target: alvo }, { duration: '10s', target: 0 }]
 
const cenario = (exec, alvo) => ({ executor: 'ramping-vus', exec, startVUs: 0, stages: etapas(alvo), gracefulRampDown: '5s' })
 
export const options = {
  scenarios: {
    feed_sem_filtros: cenario('feedSemFiltros', VUS),
    feed_com_filtros: cenario('feedComFiltros', VUS),
    certidoes: cenario('certidoes', VUS),
    perfil_escrita: cenario('perfilEscrita', VUS_ESCRITA),
  },
  thresholds: {
    'http_req_duration{tipo:leitura}': ['p(95)<800'],
    'http_req_duration{tipo:escrita}': ['p(95)<1500'],
    'http_req_duration{rota:feed_sem_filtros}': ['p(95)<800'],
    'http_req_duration{rota:feed_com_filtros}': ['p(95)<800'],
    'http_req_duration{rota:certidoes}': ['p(95)<800'],
    'http_req_duration{rota:perfil_escrita}': ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
}
 
// Perfil da Empresa A do seed: o PUT regrava os mesmos valores, então o seed continua intacto.
const PERFIL_A = {
  ufs: ['DF', 'GO'],
  termosChave: ['notebook', 'impressora'],
  modalidades: ['pregao_eletronico'],
  valorMinimo: 50000,
  valorMaximo: 500000,
  prazoMinimoDiasUteis: 3,
}
 
const FILTROS = [
  '?uf=DF',
  '?uf=GO',
  '?modalidade=pregao_eletronico',
  '?q=notebook',
  '?uf=DF&modalidade=pregao_eletronico&valorMin=100000',
  '?page=1&pageSize=10',
]
 
export function setup() {
  const r = http.post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    JSON.stringify({ email: EMAIL, password: SENHA, returnSecureToken: true }),
    { headers: { 'Content-Type': 'application/json' }, tags: { tipo: 'setup' } },
  )
  if (r.status !== 200) {
    throw new Error(`Login no emulador de Auth falhou (HTTP ${r.status}). O compose está no ar e o seed foi rodado?`)
  }
  return { token: r.json('idToken') }
}
 
function opcoes(token, tipo, rota, extra = {}) {
  return {
    headers: { Authorization: `Bearer ${token}`, ...(extra.headers || {}) },
    tags: { tipo, rota },
  }
}
 
export function feedSemFiltros(dados) {
  const r = http.get(`${API}/v1/feed`, opcoes(dados.token, 'leitura', 'feed_sem_filtros'))
  check(r, {
    'feed sem filtros: 200': (x) => x.status === 200,
    'feed sem filtros: tem itens': (x) => Array.isArray(x.json('itens')) && x.json('itens').length > 0,
  })
  sleep(0.3)
}
 
export function feedComFiltros(dados) {
  const filtro = FILTROS[Math.floor(Math.random() * FILTROS.length)]
  const r = http.get(`${API}/v1/feed${filtro}`, opcoes(dados.token, 'leitura', 'feed_com_filtros'))
  check(r, {
    'feed com filtros: 200': (x) => x.status === 200,
    'feed com filtros: itens é lista': (x) => Array.isArray(x.json('itens')),
  })
  sleep(0.3)
}
 
export function certidoes(dados) {
  const r = http.get(`${API}/v1/certidoes`, opcoes(dados.token, 'leitura', 'certidoes'))
  check(r, {
    'certidões: 200': (x) => x.status === 200,
    'certidões: resposta em JSON': (x) => x.json() !== undefined,
  })
  sleep(0.3)
}
 
export function perfilEscrita(dados) {
  const r = http.put(
    `${API}/v1/perfil`,
    JSON.stringify(PERFIL_A),
    opcoes(dados.token, 'escrita', 'perfil_escrita', { headers: { 'Content-Type': 'application/json' } }),
  )
  check(r, {
    'perfil: 200': (x) => x.status === 200,
    'perfil: devolve o perfil salvo': (x) => Array.isArray(x.json('ufs')),
  })
  sleep(1)
}
 
// Resumo legível no terminal e em arquivos (.md para colar em docs/Testes, .json com os números brutos).
const ROTAS = [
  ['feed_sem_filtros', 'GET /v1/feed (sem filtros)', 'leitura', 800],
  ['feed_com_filtros', 'GET /v1/feed (com filtros)', 'leitura', 800],
  ['certidoes', 'GET /v1/certidoes', 'leitura', 800],
  ['perfil_escrita', 'PUT /v1/perfil', 'escrita', 1500],
]
const ms = (v) => (v === undefined ? '-' : `${v.toFixed(1)} ms`)
 
export function handleSummary(data) {
  const linhas = ROTAS.map(([rota, nome, tipo, meta]) => {
    const m = data.metrics[`http_req_duration{rota:${rota}}`]
    const v = m ? m.values : {}
    const ok = v['p(95)'] !== undefined && v['p(95)'] < meta
    return `| ${nome} | ${tipo} | ${ms(v.med)} | ${ms(v['p(95)'])} | ${ms(v.max)} | ≤ ${meta} ms | ${ok ? 'passou' : 'FALHOU'} |`
  })
  const reqs = data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0
  const falhas = data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0
  const checks = data.metrics.checks ? data.metrics.checks.values.rate : 0
  const texto = [
    `# Resultado do teste de carga (k6)`,
    ``,
    `Alvo: ${API} · usuário: ${EMAIL} · leitura: ${VUS} VUs por cenário · escrita: ${VUS_ESCRITA} VUs${CURTO ? ' · rodada curta' : ''}`,
    ``,
    `| Rota | Tipo | Mediana | p95 | Máximo | Meta p95 | Resultado |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
    ...linhas,
    ``,
    `Requisições: ${reqs} · falhas HTTP: ${(falhas * 100).toFixed(2)}% · checks aprovados: ${(checks * 100).toFixed(2)}%`,
    ``,
  ].join('\n')
  return {
    stdout: `\n${texto}\n`,
    [`${SAIDA}.md`]: texto,
    [`${SAIDA}.json`]: JSON.stringify(data, null, 2),
  }
}