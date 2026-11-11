import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'

function abrirFeed(url: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

describe('Feed: complementos de CT-FILT', () => {
  it('CT-FILT-002: valorMin de R$ 1 bilhão na URL deixa a lista vazia, explica e oferece limpar', async () => {
    abrirFeed('/?valorMin=1000000000')

    expect(await screen.findByText('Nenhum edital combina com esses filtros')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Limpar filtros/ }).length).toBeGreaterThan(0)
  })

  it('CT-FILT-003: com vários filtros que zeram a lista, Limpar filtros tira todos e devolve a lista inteira', async () => {
    const { router } = abrirFeed('/?q=hemodialise&uf=DF&modalidade=pregao_eletronico')

    expect(await screen.findByText('Nenhum edital combina com esses filtros')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /Limpar filtros/ })[0])

    expect(await screen.findAllByRole('article')).toHaveLength(10)
    expect(router.state.location.search).toBe('')
    expect(screen.queryByRole('list', { name: 'Filtros ativos' })).not.toBeInTheDocument()
  })
})
