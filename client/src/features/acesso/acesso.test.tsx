import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { configurarSessao, sessao } from '@/lib/sessao'
import { criarSessaoMock, SENHA_DEMO, USUARIOS_DEMO } from '@/mocks/sessao'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { API_URL } from '@/services/config'
import { renderizar } from '@/testes/utils'

function abrir(url: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

async function entrarComo(email: string, senha = SENHA_DEMO) {
  await userEvent.type(await screen.findByLabelText('E-mail'), email)
  await userEvent.type(screen.getByLabelText('Senha'), senha)
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

const [decisor, analista] = USUARIOS_DEMO

describe('Jornada 4: login e tratamento central de 401 e 403', () => {
  it('sem sessão, qualquer página leva ao login, e depois de entrar volta para ela', async () => {
    configurarSessao(criarSessaoMock(null))
    const { router } = abrir('/certidoes')

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')

    await entrarComo(decisor.email)

    expect(await screen.findByRole('heading', { name: 'Certidões' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/certidoes')
  })

  it('login com senha errada mostra o erro e continua na tela de login', async () => {
    configurarSessao(criarSessaoMock(null))
    abrir('/login')

    await entrarComo(decisor.email, 'senha-errada')

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true')
  })

  it('401 em qualquer chamada encerra a sessão e leva ao login; depois volta para a mesma página', async () => {
    let expirou = true
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        expirou
          ? HttpResponse.json({ codigo: 'NAO_AUTENTICADO', mensagem: 'Sessão expirada.', requestId: 'r1' }, { status: 401 })
          : undefined,
      ),
    )
    const { router } = abrir('/?uf=DF')

    expect(await screen.findByText('Sua sessão expirou. Entre de novo para continuar de onde parou.')).toBeInTheDocument()
    expect(sessao.atual().usuario).toBeNull()

    expirou = false
    await entrarComo(decisor.email)

    expect(await screen.findByRole('heading', { name: 'Editais para você' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?uf=DF')
  })

  it('403 de acesso negado abre a página Acesso negado', async () => {
    configurarSessao(criarSessaoMock(analista))
    const { router } = abrir('/certidoes')

    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/acesso-negado')

    await userEvent.click(screen.getByRole('link', { name: 'Voltar para os editais' }))
    expect(await screen.findByRole('heading', { name: 'Editais para você' })).toBeInTheDocument()
  })

  it('para o analista, o menu não mostra Certidões', async () => {
    configurarSessao(criarSessaoMock(analista))
    abrir('/')

    const menu = await screen.findByRole('navigation', { name: 'Principal' })
    expect(within(menu).getByRole('link', { name: 'Editais' })).toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: 'Certidões' })).not.toBeInTheDocument()
  })

  it('403 de empresa não configurada não é falta de permissão: fica na tela com a explicação', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        HttpResponse.json(
          { codigo: 'EMPRESA_NAO_CONFIGURADA', mensagem: 'Configure o perfil.', requestId: 'r3' },
          { status: 403 },
        ),
      ),
    )
    const { router } = abrir('/')

    expect(await screen.findByRole('alert')).toHaveTextContent('Configure o perfil da sua empresa')
    expect(router.state.location.pathname).toBe('/')
  })

  it('sair encerra a sessão e volta ao login', async () => {
    const { router } = abrir('/')
    await screen.findByRole('heading', { name: 'Editais para você' })

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(sessao.atual().usuario).toBeNull()
  })
})
