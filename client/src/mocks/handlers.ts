import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw'
import { API_URL } from '@/api/config'
import type { CodigoErroApi, EditalDetalhe, ErroApi, FeedItem, MotivoVazio, Perfil } from '@/api/tipos'
import { diaEmBrasilia, hojeEmBrasilia } from '@/lib/datas'
import { banco, calcularCertidao, editais } from './dados'

/**
 * Mock da API seguindo server/openapi.yaml (v0.3). Serve para desenvolver as telas
 * enquanto o back não implementa as rotas, e para os testes.
 *
 * No navegador dá para forçar um estado em todas as telas pela URL (?mock=...):
 *   vazio        nenhum edital ingerido e nenhuma certidão
 *   descartados  o perfil descartou todos os editais
 *   erro         toda chamada falha com 500
 *   lento        respostas demoram 3 s (para ver o carregando)
 *   sem-login    toda chamada responde 401
 *   sem-empresa  rotas de negócio respondem 403 EMPRESA_NAO_CONFIGURADA
 * E simular o papel do usuário com ?papel=analista (certidões respondem 403 ACESSO_NEGADO).
 */
type Cenario = 'normal' | 'vazio' | 'descartados' | 'erro' | 'lento' | 'sem-login' | 'sem-empresa'

function parametroDaPagina(nome: string) {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return null
  return new URLSearchParams(window.location.search).get(nome)
}

const cenarioAtual = () => (parametroDaPagina('mock') as Cenario | null) ?? 'normal'
const papelAtual = () => (parametroDaPagina('papel') === 'analista' ? 'analista' : 'decisor')

const url = (caminho: string) => `${API_URL}${caminho}`

let contador = 0
function erro(status: number, codigo: CodigoErroApi, mensagem: string, detalhes?: ErroApi['detalhes']) {
  const corpo: ErroApi = { codigo, mensagem, requestId: `mock-${++contador}`, ...(detalhes && { detalhes }) }
  return HttpResponse.json(corpo, { status })
}

const naoEncontrado = () => erro(404, 'NAO_ENCONTRADO', 'Recurso não encontrado.')
const validacao = (campo: string, mensagem: string) =>
  erro(400, 'VALIDACAO', 'Dados inválidos.', [{ campo, mensagem }])

/** Aplica o cenário antes de qualquer rota. Devolve uma resposta se o cenário "atropelar" a rota. */
async function aplicarCenario(rotaDeNegocio: boolean) {
  const cenario = cenarioAtual()
  if (import.meta.env.MODE !== 'test') await delay(cenario === 'lento' ? 3000 : 300)
  if (cenario === 'erro') return erro(500, 'ERRO_INTERNO', 'Erro simulado.')
  if (cenario === 'sem-login') return erro(401, 'NAO_AUTENTICADO', 'Token ausente ou inválido.')
  if (cenario === 'sem-empresa' && rotaDeNegocio) {
    return erro(403, 'EMPRESA_NAO_CONFIGURADA', 'Configure o perfil da empresa antes de usar esta rota.')
  }
  return undefined
}

/** Envolve cada rota com o cenário. */
function rota(resolver: HttpResponseResolver, { negocio = true } = {}): HttpResponseResolver {
  return async (info) => (await aplicarCenario(negocio)) ?? resolver(info)
}

/** Só o decisor acessa certidões (RF03). */
function soDecisor(resolver: HttpResponseResolver): HttpResponseResolver {
  return rota((info) => (papelAtual() === 'analista' ? erro(403, 'ACESSO_NEGADO', 'Acesso negado.') : resolver(info)))
}

function paginacao(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? 20) || 20))
  return { page, pageSize }
}

/** Ordem do contrato: score desc, prazo mais próximo, publicação mais recente, id. */
function comparar(a: FeedItem, b: FeedItem) {
  return (
    b.score - a.score ||
    a.prazo.localeCompare(b.prazo) ||
    (b.dataPublicacao ?? '').localeCompare(a.dataPublicacao ?? '') ||
    a.id.localeCompare(b.id)
  )
}

/** Sem acento, minúsculo e sem plural simples (mesmo normalizador do score, segundo o contrato). */
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .map((palavra) => palavra.replace(/s$/, ''))
    .join(' ')
}

function filtrarFeed(todos: EditalDetalhe[], params: URLSearchParams) {
  const q = params.get('q')
  const ufs = params.getAll('uf').flatMap((uf) => uf.split(','))
  const municipio = params.get('municipio')
  const modalidade = params.get('modalidade')
  const publicadoDe = params.get('publicadoDe')
  const publicadoAte = params.get('publicadoAte')
  const prazoDe = params.get('prazoDe')
  const prazoAte = params.get('prazoAte')
  const valorMin = params.get('valorMin')
  const valorMax = params.get('valorMax')

  return todos
    .filter((e) => !q || normalizar(e.titulo).includes(normalizar(q)))
    .filter((e) => ufs.length === 0 || ufs.includes(e.uf))
    .filter((e) => !municipio || normalizar(e.municipio ?? '').includes(normalizar(municipio)))
    .filter((e) => !modalidade || e.modalidade === modalidade)
    .filter((e) => !publicadoDe || (e.dataPublicacao && diaEmBrasilia(e.dataPublicacao) >= publicadoDe))
    .filter((e) => !publicadoAte || (e.dataPublicacao && diaEmBrasilia(e.dataPublicacao) <= publicadoAte))
    .filter((e) => !prazoDe || diaEmBrasilia(e.prazo) >= prazoDe)
    .filter((e) => !prazoAte || diaEmBrasilia(e.prazo) <= prazoAte)
    // Edital sem valor não satisfaz um filtro de valor ativo.
    .filter((e) => !valorMin || (e.valorEstimado != null && e.valorEstimado >= Number(valorMin)))
    .filter((e) => !valorMax || (e.valorEstimado != null && e.valorEstimado <= Number(valorMax)))
}

const FILTROS = ['q', 'uf', 'municipio', 'modalidade', 'publicadoDe', 'publicadoAte', 'prazoDe', 'prazoAte', 'valorMin', 'valorMax']

const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png']
const LIMITE_ARQUIVO = 5 * 1024 * 1024

export const handlers = [
  http.get(url('/health'), () =>
    HttpResponse.json({ status: 'ok' as const, timestamp: new Date().toISOString() }),
  ),

  // Perfil (liberado também sem empresa no token)
  http.get(
    url('/v1/perfil'),
    rota(
      () =>
        HttpResponse.json(
          cenarioAtual() === 'sem-empresa' ? ({ empresaId: null, ufs: [], termosChave: [] } satisfies Perfil) : banco.perfil,
        ),
      { negocio: false },
    ),
  ),
  http.put(
    url('/v1/perfil'),
    rota(
      async ({ request }) => {
        const perfil = (await request.json()) as Perfil
        if (perfil.valorMinimo != null && perfil.valorMaximo != null && perfil.valorMinimo > perfil.valorMaximo) {
          return validacao('valorMaximo', 'Deve ser maior que o valor mínimo.')
        }
        const primeiro = !banco.perfil.empresaId
        banco.perfil = { ...perfil, empresaId: banco.perfil.empresaId ?? 'empresa-demo' }
        return HttpResponse.json(banco.perfil, { status: primeiro ? 201 : 200 })
      },
      { negocio: false },
    ),
  ),

  // Feed
  http.get(
    url('/v1/feed'),
    rota(({ request }) => {
      const params = new URL(request.url).searchParams
      const { page, pageSize } = paginacao(params)
      const valorMin = params.get('valorMin')
      const valorMax = params.get('valorMax')
      if (valorMin && valorMax && Number(valorMin) > Number(valorMax)) {
        return validacao('valorMin', 'O valor mínimo não pode ser maior que o máximo.')
      }

      const cenario = cenarioAtual()
      const ingeridos = cenario === 'vazio' ? [] : editais()
      const doPerfil = cenario === 'descartados' ? [] : ingeridos
      const filtrados = filtrarFeed(doPerfil, params)
        .map(({ descricao: _d, linkPncp: _l, ...item }) => item)
        .sort(comparar)
      const itens = filtrados.slice((page - 1) * pageSize, page * pageSize)

      let motivoVazio: MotivoVazio | null = null
      if (itens.length === 0) {
        const comFiltro = FILTROS.some((f) => params.has(f))
        motivoVazio =
          ingeridos.length === 0 ? 'sem_editais' : doPerfil.length === 0 ? 'todos_descartados' : comFiltro ? 'filtros' : null
      }
      return HttpResponse.json({
        itens,
        page,
        pageSize,
        total: filtrados.length,
        totalIngeridos: ingeridos.length,
        motivoVazio,
      })
    }),
  ),

  // Edital
  http.get(
    url('/v1/editais/:editalId'),
    rota(({ params }) => {
      const edital = editais().find((e) => e.id === params.editalId)
      return edital ? HttpResponse.json(edital) : naoEncontrado()
    }),
  ),

  // Certidões (só decisor)
  http.get(
    url('/v1/certidoes'),
    soDecisor(() => {
      const itens = cenarioAtual() === 'vazio' ? [] : banco.certidoes.map(calcularCertidao)
      itens.sort((a, b) => a.diasRestantes - b.diasRestantes || a.nome.localeCompare(b.nome, 'pt-BR'))
      return HttpResponse.json({ itens })
    }),
  ),
  http.put(
    url('/v1/certidoes/:certidaoId/renovacao'),
    soDecisor(async ({ params, request }) => {
      const indice = banco.certidoes.findIndex((c) => c.id === params.certidaoId)
      if (indice < 0) return naoEncontrado()
      const atual = banco.certidoes[indice]

      const dados = await request.formData()
      const arquivo = dados.get('arquivo')
      const validade = String(dados.get('validade') ?? '')

      // Checa pelo formato (tamanho e tipo) em vez de `instanceof Blob`: nos testes o Blob do jsdom
      // é outra classe que o do fetch do Node.
      const ehArquivo = (valor: unknown): valor is Blob =>
        typeof valor === 'object' && valor !== null && 'size' in valor && 'type' in valor
      if (!ehArquivo(arquivo) || arquivo.size === 0) return validacao('arquivo', 'Envie o arquivo da certidão.')
      if (!TIPOS_ACEITOS.includes(arquivo.type)) return validacao('arquivo', 'Envie um PDF, JPG ou PNG.')
      if (arquivo.size > LIMITE_ARQUIVO) return validacao('arquivo', 'O arquivo passa de 5 MB.')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(validade)) return validacao('validade', 'Informe a nova validade.')
      if (validade <= hojeEmBrasilia()) return validacao('validade', 'A nova validade precisa ser depois de hoje.')
      if (validade <= atual.validade) {
        return validacao('validade', 'A nova validade precisa ser depois da validade atual.')
      }

      const renovada = calcularCertidao({ id: atual.id, nome: atual.nome, validade })
      banco.certidoes[indice] = renovada
      return HttpResponse.json(renovada)
    }),
  ),
]
