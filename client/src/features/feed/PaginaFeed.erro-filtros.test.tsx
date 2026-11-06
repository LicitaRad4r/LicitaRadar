import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { API_URL } from '@/services/config'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'

function abrirFeed(url: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

describe('Feed: erro durante a pesquisa', () => {
  it('CT-FILT-008: a API falha com filtros aplicados; mostra "Tentar novamente" e mantém os filtros', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'falhou' }, { status: 500 }),
      ),
    )
    const { router } = abrirFeed('/?q=notebook&uf=DF')

    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()

    // Os filtros continuam nos campos e na URL.
    expect(screen.getByRole('searchbox', { name: 'Buscar no objeto do edital' })).toHaveValue('notebook')
    expect(router.state.location.search).toContain('q=notebook')
    expect(router.state.location.search).toContain('uf=DF')

    // Ao tentar de novo com a API de volta, a lista vem com os mesmos filtros.
    servidor.resetHandlers()
    await userEvent.click(within(alerta).getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findAllByRole('article')).not.toHaveLength(0)
    expect(screen.getByRole('searchbox', { name: 'Buscar no objeto do edital' })).toHaveValue('notebook')
  })
})
