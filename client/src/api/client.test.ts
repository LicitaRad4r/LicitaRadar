import { afterEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { servidor } from '@/mocks/servidor'
import { api, configurarToken, desembrulhar } from './client'
import { API_URL } from './config'
import { ApiError, errosPorCampo, mensagemAmigavel } from './erros'

afterEach(() => configurarToken(async () => null))

describe('cliente da API', () => {
  it('envia o token do usuário no cabeçalho Authorization', async () => {
    let cabecalho: string | null = null
    servidor.use(
      http.get(`${API_URL}/v1/certidoes`, ({ request }) => {
        cabecalho = request.headers.get('Authorization')
        return HttpResponse.json({ itens: [] })
      }),
    )
    configurarToken(async () => 'token-de-teste')

    await desembrulhar(api.GET('/v1/certidoes'))

    expect(cabecalho).toBe('Bearer token-de-teste')
  })

  it('não envia Authorization quando ninguém entrou', async () => {
    let cabecalho: string | null = 'nao-lido'
    servidor.use(
      http.get(`${API_URL}/v1/certidoes`, ({ request }) => {
        cabecalho = request.headers.get('Authorization')
        return HttpResponse.json({ itens: [] })
      }),
    )

    await desembrulhar(api.GET('/v1/certidoes'))

    expect(cabecalho).toBeNull()
  })

  it('transforma a resposta de erro do contrato em ApiError', async () => {
    servidor.use(
      http.put(`${API_URL}/v1/perfil`, () =>
        HttpResponse.json(
          {
            codigo: 'VALIDACAO',
            mensagem: 'Dados inválidos.',
            detalhes: [{ campo: 'valorMaximo', mensagem: 'Deve ser maior que o mínimo.' }],
          },
          { status: 400 },
        ),
      ),
    )

    const erro = await desembrulhar(api.PUT('/v1/perfil', { body: {} })).catch((e) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro.status).toBe(400)
    expect(erro.codigo).toBe('VALIDACAO')
    expect(errosPorCampo(erro)).toEqual({ valorMaximo: 'Deve ser maior que o mínimo.' })
    expect(mensagemAmigavel(erro)).toBe('Confira os campos destacados.')
  })

  it('usa o status quando o erro vem sem corpo', async () => {
    servidor.use(http.get(`${API_URL}/v1/perfil`, () => new HttpResponse(null, { status: 401 })))

    const erro = await desembrulhar(api.GET('/v1/perfil')).catch((e) => e)

    expect(erro.codigo).toBe('NAO_AUTENTICADO')
    expect(mensagemAmigavel(erro)).toMatch(/sessão expirou/)
  })

  it('trata servidor fora do ar como erro de conexão', async () => {
    servidor.use(http.get(`${API_URL}/v1/perfil`, () => HttpResponse.error()))

    const erro = await desembrulhar(api.GET('/v1/perfil')).catch((e) => e)

    expect(erro).toBeInstanceOf(ApiError)
    expect(erro.codigo).toBe('SEM_CONEXAO')
    expect(mensagemAmigavel(erro)).toMatch(/Não foi possível falar com o servidor/)
  })
})
