import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { API_URL } from '@/api/config'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'

function abrirFeed(url = '/') {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

const editais = () => screen.getAllByRole('article')

describe('Feed', () => {
  it('lista os 10 primeiros editais do mais para o menos aderente, com a faixa visível', async () => {
    abrirFeed()

    expect(screen.getByRole('status', { name: 'Carregando editais' })).toBeInTheDocument()
    await screen.findAllByRole('article')

    expect(editais()).toHaveLength(10)
    const notas = screen
      .getAllByRole('img', { name: /^Aderência/ })
      .map((anel) => Number(anel.getAttribute('aria-label')!.match(/\d+/)![0]))
    expect(notas).toEqual([...notas].sort((a, b) => b - a))
    expect(within(editais()[0]).getByText('Alta aderência')).toBeInTheDocument()
    expect(screen.getAllByText('Média aderência').length).toBeGreaterThan(0)
  })

  it('pagina e guarda a página na URL', async () => {
    const { router } = abrirFeed()
    await screen.findAllByRole('article')
    const primeiroDaPagina1 = within(editais()[0]).getByRole('heading').textContent

    await userEvent.click(screen.getByRole('button', { name: /Próxima/ }))

    expect(await screen.findByText(/^2 de \d+$/)).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pagina=2')
    expect(within(editais()[0]).getByRole('heading').textContent).not.toBe(primeiroDaPagina1)
  })

  it('filtra por faixa e volta para a primeira página', async () => {
    const { router } = abrirFeed('/?pagina=2')
    await screen.findAllByRole('article')

    await userEvent.click(screen.getByRole('button', { name: 'Alta' }))

    expect(router.state.location.search).toBe('?faixa=alta')
    await screen.findByRole('button', { name: 'Alta', pressed: true })
    expect(await screen.findAllByText('Alta aderência')).toHaveLength(editais().length)
  })

  it('sem resultados com filtro: explica e oferece limpar', async () => {
    abrirFeed('/?termo=hemodialise')

    expect(await screen.findByText('Nenhum edital combina com esses filtros')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /Limpar filtros/ })[0])

    expect(await screen.findAllByRole('article')).toHaveLength(10)
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('sem resultados e sem filtro: avisa que ainda não há editais para o perfil', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () => HttpResponse.json({ itens: [], pagina: 1, tamanho: 10, total: 0 })),
    )
    abrirFeed()

    expect(await screen.findByText('Ainda não há editais para o seu perfil')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Limpar filtros/ })).not.toBeInTheDocument()
  })

  it('mostra o erro com opção de tentar de novo', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'falhou' }, { status: 500 }),
      ),
    )
    abrirFeed()

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível carregar os editais')
    expect(within(alerta).getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })

  it('marca um edital como relevante', async () => {
    abrirFeed()
    await screen.findAllByRole('article')
    const botao = within(editais()[0]).getByRole('button', { name: 'Relevante' })

    await userEvent.click(botao)

    expect(within(editais()[0]).getByRole('button', { name: 'Relevante', pressed: true })).toBeInTheDocument()
  })
})
