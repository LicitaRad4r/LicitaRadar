import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { API_URL } from '@/services/config'
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

    expect(screen.getByText('Carregando oportunidades')).toBeVisible()
    await screen.findAllByRole('article')

    expect(editais()).toHaveLength(10)
    const notas = screen
      .getAllByRole('img', { name: /^Nota \d+ de 100/ })
      .map((anel) => Number(anel.getAttribute('aria-label')!.match(/\d+/)![0]))
    expect(notas).toEqual([...notas].sort((a, b) => b - a))
    // Selo com a nota e o texto da faixa, não só cor.
    expect(within(editais()[0]).getByRole('img', { name: 'Nota 94 de 100, aderência alta' })).toHaveTextContent('94Alta')
    expect(screen.getAllByRole('img', { name: /aderência média$/ }).length).toBeGreaterThan(0)
    expect(within(editais()[0]).getByRole('heading')).toHaveTextContent('Aquisição de notebooks e monitores')
  })

  it('pagina e guarda a página na URL', async () => {
    const { router } = abrirFeed()
    await screen.findAllByRole('article')
    const primeiroDaPagina1 = within(editais()[0]).getByRole('heading').textContent

    await userEvent.click(screen.getByRole('button', { name: /Próxima/ }))

    expect(await screen.findByText(/^2 de \d+$/)).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=2')
    expect(within(editais()[0]).getByRole('heading').textContent).not.toBe(primeiroDaPagina1)
  })

  it('adiciona estados como etiquetas e remove uma de cada vez', async () => {
    const { router } = abrirFeed()
    await screen.findAllByRole('article')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Adicionar estado' }), 'DF')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Adicionar estado' }), 'GO')

    expect(router.state.location.search).toBe('?uf=DF&uf=GO')
    const ativas = screen.getByRole('list', { name: 'Filtros ativos' })
    expect(within(ativas).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remover filtro DF',
      'Remover filtro GO',
    ])
    await waitFor(() =>
      expect(editais().every((e) => within(e).queryByText(/, (DF|GO)$/))).toBe(true),
    )

    await userEvent.click(within(ativas).getByRole('button', { name: 'Remover filtro DF' }))

    expect(router.state.location.search).toBe('?uf=GO')
  })

  it('filtra por modalidade e volta para a primeira página', async () => {
    const { router } = abrirFeed('/?page=2')
    await screen.findAllByRole('article')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modalidade' }), 'concorrencia')

    expect(router.state.location.search).toBe('?modalidade=concorrencia')
    await waitFor(() => expect(editais().every((e) => within(e).queryByText(/^Concorrência,/))).toBe(true))
  })

  it('filtra por faixa de valor e avisa quando o mínimo passa do máximo', async () => {
    const { router } = abrirFeed()
    await screen.findAllByRole('article')
    await userEvent.click(screen.getByRole('button', { name: 'Mais filtros' }))

    await userEvent.type(screen.getByRole('textbox', { name: 'Valor mínimo' }), '900000')
    await userEvent.type(screen.getByRole('textbox', { name: 'Valor máximo' }), '100000')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar valor' }))

    expect(screen.getByRole('alert')).toHaveTextContent('O valor mínimo não pode ser maior que o máximo.')
    expect(router.state.location.search).toBe('')

    await userEvent.clear(screen.getByRole('textbox', { name: 'Valor máximo' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Valor máximo' }), '3.000.000')
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar valor' }))

    expect(router.state.location.search).toBe('?valorMin=900000&valorMax=3000000')
    expect(
      await screen.findByRole('button', { name: /^Remover filtro De R\$\s900\.000 a R\$\s3\.000\.000$/ }),
    ).toBeInTheDocument()
  })

  it('reabre o link com os filtros e o painel de mais filtros aberto', async () => {
    abrirFeed('/?prazo=7&municipio=Goi%C3%A2nia')

    expect(await screen.findByRole('button', { name: /Mais filtros/, expanded: true })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Prazo para proposta' })).toHaveValue('7')
    expect(screen.getByRole('searchbox', { name: 'Município' })).toHaveValue('Goiânia')
    expect(screen.getByRole('button', { name: 'Remover filtro Encerra em até 7 dias' })).toBeInTheDocument()
  })

  it('sem resultados com filtro: explica e oferece limpar', async () => {
    abrirFeed('/?q=hemodialise')

    expect(await screen.findByText('Nenhum edital combina com esses filtros')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /Limpar filtros/ })[0])

    expect(await screen.findAllByRole('article')).toHaveLength(10)
    expect(screen.getByRole('searchbox', { name: 'Buscar no objeto do edital' })).toHaveValue('')
  })

  it.each([
    ['sem_editais', 0, 'Ainda não há editais ingeridos'],
    ['todos_descartados', 24, 'Nenhum edital combina com o perfil da sua empresa'],
  ] as const)('lista vazia por %s: mostra a mensagem certa, sem Limpar filtros', async (motivoVazio, totalIngeridos, mensagem) => {
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        HttpResponse.json({ itens: [], page: 1, pageSize: 10, total: 0, totalIngeridos, motivoVazio }),
      ),
    )
    abrirFeed()

    expect(await screen.findByText(mensagem)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Limpar filtros/ })).not.toBeInTheDocument()
  })

  it('mostra as três faixas de aderência do contrato', async () => {
    abrirFeed('/?page=3')
    await screen.findAllByRole('article')

    expect(screen.getAllByRole('img', { name: /aderência baixa$/ }).length).toBeGreaterThan(0)
  })

  it('mostra o erro com opção de tentar de novo', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'falhou' }, { status: 500 }),
      ),
    )
    abrirFeed()

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('Não foi possível carregar as oportunidades')
    expect(screen.queryByText(/Nenhum edital/)).not.toBeInTheDocument()
    expect(within(alerta).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })

})
