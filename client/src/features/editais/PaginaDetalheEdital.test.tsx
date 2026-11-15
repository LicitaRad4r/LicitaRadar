import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { API_URL } from '@/services/config'
import { renderizar } from '@/testes/utils'

const ID_DO_EDITAL_DE_NOTEBOOKS = '00394460000141-1-000123/2026'
const enderecoDoDetalhe = (editalId: string) => `/editais/${encodeURIComponent(editalId)}`

function abrir(url: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

describe('Detalhe do edital (US12)', () => {
  it('mostra carregando e depois os dados do edital, com o link para o PNCP', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/editais/:editalId`, async () => {
        await delay(50)
      }),
    )
    abrir(enderecoDoDetalhe(ID_DO_EDITAL_DE_NOTEBOOKS))

    expect(await screen.findByText('Carregando edital')).toBeVisible()

    const titulo = await screen.findByRole('heading', { level: 1 })
    expect(titulo).toHaveTextContent('Aquisição de notebooks e monitores para unidades de atenção básica')
    expect(screen.getByRole('img', { name: 'Nota 94 de 100, aderência alta' })).toBeInTheDocument()

    const informacoes = screen.getByText('Órgão').closest('dl')!
    for (const rotulo of ['Órgão', 'Local', 'Modalidade', 'Valor estimado', 'Prazo para proposta', 'Publicado em']) {
      expect(within(informacoes).getByText(rotulo)).toBeInTheDocument()
    }
    expect(within(informacoes).getByText('Ministério da Saúde')).toBeInTheDocument()
    expect(within(informacoes).getByText('Brasília, DF')).toBeInTheDocument()
    expect(within(informacoes).getByText('Pregão eletrônico')).toBeInTheDocument()

    const linkDoPncp = screen.getByRole('link', { name: /Ver edital original no PNCP/ })
    expect(linkDoPncp).toHaveAttribute('href', expect.stringContaining('pncp.gov.br'))
    expect(linkDoPncp).toHaveAttribute('target', '_blank')
  })

  it('edital inexistente mostra a mensagem de não encontrado', async () => {
    abrir(enderecoDoDetalhe('nao-existe-1-000000/2026'))

    expect(await screen.findByText('Edital não encontrado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
  })

  it('falha da API mostra o erro e permite tentar de novo', async () => {
    let falhar = true
    servidor.use(
      http.get(`${API_URL}/v1/editais/:editalId`, () =>
        falhar
          ? HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'Falhou.', requestId: 'r1' }, { status: 500 })
          : undefined,
      ),
    )
    abrir(enderecoDoDetalhe(ID_DO_EDITAL_DE_NOTEBOOKS))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o edital')

    falhar = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Aquisição de notebooks')
  })

  it('do feed, um clique abre o detalhe e Voltar mantém os filtros do feed', async () => {
    const { router } = abrir('/?uf=DF')
    const [primeiroEdital] = await screen.findAllByRole('article')

    await userEvent.click(within(primeiroEdital).getByRole('link'))

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/editais\//)

    await userEvent.click(screen.getByRole('link', { name: 'Voltar para os editais' }))

    expect(await screen.findByRole('heading', { name: 'Editais para você' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?uf=DF')
  })

  it('abre o detalhe pelo teclado a partir do feed', async () => {
    const { router } = abrir('/')
    const [primeiroEdital] = await screen.findAllByRole('article')
    const linkDoEdital = within(primeiroEdital).getByRole('link')

    linkDoEdital.focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/editais\//)
  })
})
