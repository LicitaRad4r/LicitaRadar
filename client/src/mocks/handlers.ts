import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw'
import { API_URL } from '@/api/config'
import type { Acompanhamento, Certidao, CertidaoEntrada, ErroApi, Etapa, Feedback, Perfil } from '@/api/tipos'
import { banco, editais, ETAPAS_PADRAO, statusPorValidade } from './dados'

/**
 * Mock da API seguindo server/openapi.yaml. Serve para desenvolver as telas
 * enquanto o back não implementa as rotas, e para os testes.
 *
 * No navegador dá para forçar um estado em todas as telas pela URL:
 *   ?mock=vazio   listas vazias
 *   ?mock=erro    toda chamada falha com 500
 *   ?mock=lento   respostas demoram 3 s (para ver o carregando)
 *   ?mock=sem-login  toda chamada responde 401
 */
type Cenario = 'normal' | 'vazio' | 'erro' | 'lento' | 'sem-login'

function cenarioAtual(): Cenario {
  if (typeof window === 'undefined' || import.meta.env.MODE === 'test') return 'normal'
  return (new URLSearchParams(window.location.search).get('mock') as Cenario | null) ?? 'normal'
}

const url = (caminho: string) => `${API_URL}${caminho}`

function erro(status: number, corpo: ErroApi) {
  return HttpResponse.json(corpo, { status })
}

const naoEncontrado = () =>
  erro(404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Recurso não encontrado.' })

/** Aplica o cenário antes de qualquer rota. Devolve uma resposta se o cenário "atropelar" a rota. */
async function aplicarCenario() {
  const cenario = cenarioAtual()
  if (import.meta.env.MODE !== 'test') await delay(cenario === 'lento' ? 3000 : 300)
  if (cenario === 'erro') return erro(500, { codigo: 'ERRO_INTERNO', mensagem: 'Erro simulado.' })
  if (cenario === 'sem-login') return erro(401, { codigo: 'NAO_AUTENTICADO', mensagem: 'Token ausente.' })
  return undefined
}

const listaVazia = () => cenarioAtual() === 'vazio'

/** Envolve cada rota com o cenário. */
function rota(resolver: HttpResponseResolver): HttpResponseResolver {
  return async (info) => (await aplicarCenario()) ?? resolver(info)
}

function paginar<T>(itens: T[], params: URLSearchParams) {
  const pagina = Math.max(1, Number(params.get('pagina') ?? 1))
  const tamanho = Math.min(100, Math.max(1, Number(params.get('tamanho') ?? 20)))
  const inicio = (pagina - 1) * tamanho
  return { itens: itens.slice(inicio, inicio + tamanho), pagina, tamanho, total: itens.length }
}

function acompanhamentoDe(editalId: string): Acompanhamento | undefined {
  const edital = editais().find((e) => e.id === editalId)
  const dados = banco.acompanhamentos.get(editalId)
  if (!edital || !dados) return undefined
  return { editalId, edital, ...dados }
}

export const handlers = [
  http.get(url('/health'), () =>
    HttpResponse.json({ status: 'ok' as const, timestamp: new Date().toISOString() }),
  ),

  // Perfil
  http.get(
    url('/v1/perfil'),
    rota(() => HttpResponse.json(listaVazia() ? {} : banco.perfil)),
  ),
  http.put(
    url('/v1/perfil'),
    rota(async ({ request }) => {
      const perfil = (await request.json()) as Perfil
      if (perfil.valorMinimo != null && perfil.valorMaximo != null && perfil.valorMinimo > perfil.valorMaximo) {
        return erro(400, {
          codigo: 'VALIDACAO',
          mensagem: 'Dados inválidos.',
          detalhes: [{ campo: 'valorMaximo', mensagem: 'Deve ser maior que o valor mínimo.' }],
        })
      }
      banco.perfil = perfil
      return HttpResponse.json(perfil)
    }),
  ),

  // Feed
  http.get(
    url('/v1/feed'),
    rota(({ request }) => {
      const params = new URL(request.url).searchParams
      if (listaVazia()) return HttpResponse.json(paginar([], params))
      const termo = params.get('termo')?.toLowerCase()
      const ufs = params.getAll('uf')
      const faixa = params.get('faixa')
      const valorMinimo = params.get('valorMinimo')
      const valorMaximo = params.get('valorMaximo')
      const itens = editais()
        .filter((e) => !termo || e.objeto.toLowerCase().includes(termo))
        .filter((e) => ufs.length === 0 || ufs.includes(e.uf))
        .filter((e) => !faixa || e.faixa === faixa)
        .filter((e) => !valorMinimo || (e.valorEstimado ?? 0) >= Number(valorMinimo))
        .filter((e) => !valorMaximo || (e.valorEstimado ?? Infinity) <= Number(valorMaximo))
        .sort((a, b) => b.score - a.score)
        .map(({ descricao: _descricao, ...item }) => item)
      return HttpResponse.json(paginar(itens, params))
    }),
  ),

  // Editais
  http.get(
    url('/v1/editais/:editalId'),
    rota(({ params }) => {
      const edital = editais().find((e) => e.id === params.editalId)
      return edital ? HttpResponse.json(edital) : naoEncontrado()
    }),
  ),
  http.put(
    url('/v1/editais/:editalId/feedback'),
    rota(async ({ params, request }) => {
      const editalId = String(params.editalId)
      if (!editais().some((e) => e.id === editalId)) return naoEncontrado()
      const { valor } = (await request.json()) as { valor: Feedback }
      banco.feedbacks.set(editalId, valor)
      return HttpResponse.json({ editalId, valor, atualizadoEm: new Date().toISOString() })
    }),
  ),
  http.delete(
    url('/v1/editais/:editalId/feedback'),
    rota(({ params }) => {
      banco.feedbacks.delete(String(params.editalId))
      return new HttpResponse(null, { status: 204 })
    }),
  ),
  http.put(
    url('/v1/editais/:editalId/acompanhamento'),
    rota(async ({ params, request }) => {
      const editalId = String(params.editalId)
      if (!editais().some((e) => e.id === editalId)) return naoEncontrado()
      const corpo = (await request.json().catch(() => ({}))) as { etapas?: Etapa[] }
      const atual = banco.acompanhamentos.get(editalId)
      const etapas =
        corpo.etapas ?? atual?.etapas ?? ETAPAS_PADRAO.map((titulo) => ({ titulo, concluida: false }))
      banco.acompanhamentos.set(editalId, { etapas, atualizadoEm: new Date().toISOString() })
      return HttpResponse.json(acompanhamentoDe(editalId))
    }),
  ),
  http.delete(
    url('/v1/editais/:editalId/acompanhamento'),
    rota(({ params }) => {
      return banco.acompanhamentos.delete(String(params.editalId))
        ? new HttpResponse(null, { status: 204 })
        : naoEncontrado()
    }),
  ),
  http.get(
    url('/v1/acompanhamentos'),
    rota(({ request }) => {
      const params = new URL(request.url).searchParams
      const itens = listaVazia()
        ? []
        : [...banco.acompanhamentos.keys()]
            .map(acompanhamentoDe)
            .filter((a): a is Acompanhamento => a !== undefined)
            .sort((a, b) => a.edital.dataLimiteProposta.localeCompare(b.edital.dataLimiteProposta))
      return HttpResponse.json(paginar(itens, params))
    }),
  ),

  // Certidões
  http.get(
    url('/v1/certidoes'),
    rota(() => HttpResponse.json({ itens: listaVazia() ? [] : banco.certidoes })),
  ),
  http.post(
    url('/v1/certidoes'),
    rota(async ({ request }) => {
      const entrada = (await request.json()) as CertidaoEntrada
      if (!entrada.dataValidade) {
        return erro(400, {
          codigo: 'VALIDACAO',
          mensagem: 'Dados inválidos.',
          detalhes: [{ campo: 'dataValidade', mensagem: 'Informe a data de validade.' }],
        })
      }
      const certidao: Certidao = {
        ...entrada,
        id: `cert-${banco.proximoId++}`,
        status: statusPorValidade(entrada.dataValidade),
      }
      banco.certidoes.push(certidao)
      return HttpResponse.json(certidao, {
        status: 201,
        headers: { Location: `/v1/certidoes/${certidao.id}` },
      })
    }),
  ),
  http.patch(
    url('/v1/certidoes/:certidaoId'),
    rota(async ({ params, request }) => {
      const certidao = banco.certidoes.find((c) => c.id === params.certidaoId)
      if (!certidao) return naoEncontrado()
      Object.assign(certidao, await request.json())
      certidao.status = statusPorValidade(certidao.dataValidade)
      return HttpResponse.json(certidao)
    }),
  ),
  http.delete(
    url('/v1/certidoes/:certidaoId'),
    rota(({ params }) => {
      const antes = banco.certidoes.length
      banco.certidoes = banco.certidoes.filter((c) => c.id !== params.certidaoId)
      return banco.certidoes.length < antes ? new HttpResponse(null, { status: 204 }) : naoEncontrado()
    }),
  ),

  // Alertas
  http.get(
    url('/v1/alertas'),
    rota(({ request }) => {
      const params = new URL(request.url).searchParams
      const tipo = params.get('tipo')
      const lido = params.get('lido')
      const itens = listaVazia()
        ? []
        : banco.alertas
            .filter((a) => !tipo || a.tipo === tipo)
            .filter((a) => lido === null || String(a.lido) === lido)
            .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      return HttpResponse.json(paginar(itens, params))
    }),
  ),
  http.patch(
    url('/v1/alertas/:alertaId'),
    rota(async ({ params, request }) => {
      const alerta = banco.alertas.find((a) => a.id === params.alertaId)
      if (!alerta) return naoEncontrado()
      alerta.lido = ((await request.json()) as { lido: boolean }).lido
      return HttpResponse.json(alerta)
    }),
  ),
]
