import { describe, expect, it } from 'vitest'
import { createEvent, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { banco, criarAcompanhamento, editais } from '@/mocks/dados'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { API_URL } from '@/services/config'
import type { Etapa } from '@/services/dto'
import { renderizar } from '@/testes/utils'

function abrir(url = '/acompanhamento') {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return {
    router,
    ...renderizar(
      <>
        <RouterProvider router={router} />
        <Toaster />
      </>,
    ),
  }
}

const coluna = (nome: string) => screen.getByRole('region', { name: new RegExp(`^${nome}`) })
const cartoesDa = (nome: string) => within(coluna(nome)).queryAllByRole('article')
const titulosDa = (nome: string) => cartoesDa(nome).map((cartao) => within(cartao).getByRole('heading').textContent)

function prazoDaquiA(dias: number) {
  return new Date(`${somarDias(hojeEmBrasilia(), dias)}T18:00:00-03:00`).toISOString()
}

function acompanharComPrazo(indiceDoEdital: number, diasAtePrazo: number, etapa: Etapa = 'interessado') {
  const edital = { ...editais()[indiceDoEdital], prazo: prazoDaquiA(diasAtePrazo) }
  const acompanhamento = criarAcompanhamento(edital, etapa)
  banco.acompanhamentos.push(acompanhamento)
  return acompanhamento
}

async function esperarQuadro() {
  await screen.findByRole('region', { name: /^Interessado/ })
}

describe('Acompanhamento em kanban (US20)', () => {
  it('mostra carregando e depois as 4 colunas com os editais acompanhados', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/acompanhamentos`, async () => {
        await delay(50)
      }),
    )
    abrir()

    expect(await screen.findByText('Carregando acompanhamento')).toBeVisible()
    await esperarQuadro()

    for (const nome of ['Interessado', 'Preparando', 'Enviado', 'Resultado']) {
      expect(coluna(nome)).toBeInTheDocument()
    }
    expect(cartoesDa('Interessado')).toHaveLength(1)
    expect(cartoesDa('Preparando')).toHaveLength(1)
  })

  it('sem nenhum acompanhamento, mostra o estado vazio com o caminho para o feed', async () => {
    banco.acompanhamentos = []
    abrir()

    expect(await screen.findByText('Você ainda não acompanha nenhum edital')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver editais' })).toHaveAttribute('href', '/')
  })

  it('erro ao carregar mostra a mensagem e permite tentar de novo', async () => {
    let falhar = true
    servidor.use(
      http.get(`${API_URL}/v1/acompanhamentos`, () =>
        falhar ? HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'Falhou.', requestId: 'r1' }, { status: 500 }) : undefined,
      ),
    )
    abrir()

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o acompanhamento')
    falhar = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await esperarQuadro()
  })

  it('acompanhar um edital do feed coloca o cartão em Interessado', async () => {
    banco.acompanhamentos = []
    const { router } = abrir('/')
    const [primeiroEdital] = await screen.findAllByRole('article')
    const titulo = within(primeiroEdital).getByRole('heading').textContent!

    await userEvent.click(within(primeiroEdital).getByRole('button', { name: `Acompanhar: ${titulo}` }))
    await userEvent.click(await within(primeiroEdital).findByRole('link', { name: /^Acompanhando/ }))

    await esperarQuadro()
    expect(router.state.location.pathname).toBe('/acompanhamento')
    expect(titulosDa('Interessado')).toEqual([titulo])
  })

  it('leva o cartão até Resultado pelo teclado, exige Venceu ou Não venceu e trava o cartão; recarregar mantém', async () => {
    banco.acompanhamentos = []
    const { titulo } = acompanharComPrazo(0, 10)
    const { unmount } = abrir()
    await esperarQuadro()

    await userEvent.click(screen.getByRole('button', { name: `Mover para Preparando: ${titulo}` }))
    await waitFor(() => expect(titulosDa('Preparando')).toEqual([titulo]))
    await userEvent.click(screen.getByRole('button', { name: `Mover para Enviado: ${titulo}` }))
    await waitFor(() => expect(titulosDa('Enviado')).toEqual([titulo]))

    await userEvent.click(screen.getByRole('button', { name: `Mover para Resultado: ${titulo}` }))
    const dialogo = await screen.findByRole('dialog', { name: 'Resultado da licitação' })
    expect(within(dialogo).getByRole('button', { name: 'Salvar resultado' })).toBeDisabled()
    await userEvent.click(within(dialogo).getByRole('radio', { name: 'Venceu' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar resultado' }))

    await waitFor(() => expect(titulosDa('Resultado')).toEqual([titulo]))
    const cartao = cartoesDa('Resultado')[0]
    expect(within(cartao).getByText('Venceu')).toBeInTheDocument()
    expect(within(cartao).queryByRole('button')).not.toBeInTheDocument()
    expect(cartao).toHaveAttribute('draggable', 'false')

    unmount()
    abrir()
    await esperarQuadro()
    expect(titulosDa('Resultado')).toEqual([titulo])
  })

  it('cancelar a escolha do resultado deixa o cartão em Enviado', async () => {
    banco.acompanhamentos = []
    const { titulo } = acompanharComPrazo(0, 10, 'enviado')
    abrir()
    await esperarQuadro()

    await userEvent.click(screen.getByRole('button', { name: `Mover para Resultado: ${titulo}` }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(titulosDa('Enviado')).toEqual([titulo])
    expect(cartoesDa('Resultado')).toHaveLength(0)
  })

  it('só oferece as etapas permitidas: avançar uma por vez e voltar só de Preparando', async () => {
    banco.acompanhamentos = []
    const interessado = acompanharComPrazo(0, 10, 'interessado')
    const preparando = acompanharComPrazo(1, 10, 'preparando')
    const enviado = acompanharComPrazo(2, 10, 'enviado')
    abrir()
    await esperarQuadro()

    const botoesDo = (nome: string) =>
      within(cartoesDa(nome)[0])
        .getAllByRole('button')
        .map((botao) => botao.textContent)

    expect(botoesDo('Interessado')).toEqual(['Mover para Preparando', 'Deixar de acompanhar'])
    expect(botoesDo('Preparando')).toEqual(['Mover para Enviado', 'Voltar para Interessado', 'Deixar de acompanhar'])
    expect(botoesDo('Enviado')).toEqual(['Mover para Resultado'])

    await userEvent.click(screen.getByRole('button', { name: `Voltar para Interessado: ${preparando.titulo}` }))
    await waitFor(() => expect(titulosDa('Interessado')).toContain(preparando.titulo))
    expect(titulosDa('Interessado')).toContain(interessado.titulo)
    expect(titulosDa('Enviado')).toEqual([enviado.titulo])
  })

  it('se a API recusar a mudança (422), o cartão volta para a coluna anterior e aparece a mensagem', async () => {
    banco.acompanhamentos = []
    const { titulo } = acompanharComPrazo(0, 10)
    servidor.use(
      http.patch(`${API_URL}/v1/acompanhamentos/:acompanhamentoId`, async () => {
        await delay(30)
        return HttpResponse.json({ codigo: 'REGRA_DE_NEGOCIO', mensagem: 'Transição inválida.', requestId: 'r2' }, { status: 422 })
      }),
    )
    abrir()
    await esperarQuadro()

    await userEvent.click(screen.getByRole('button', { name: `Mover para Preparando: ${titulo}` }))
    expect(titulosDa('Preparando')).toEqual([titulo])

    expect(await screen.findByText('Essa mudança não é permitida. O edital continua onde estava.')).toBeInTheDocument()
    expect(titulosDa('Interessado')).toEqual([titulo])
    expect(cartoesDa('Preparando')).toHaveLength(0)
  })

  it('ao arrastar, só a coluna permitida aceita o cartão; as outras ficam desabilitadas', async () => {
    banco.acompanhamentos = []
    const { titulo } = acompanharComPrazo(0, 10)
    abrir()
    await esperarQuadro()
    const [cartao] = cartoesDa('Interessado')

    fireEvent.dragStart(cartao, { dataTransfer: { setData: () => {}, effectAllowed: '' } })

    expect(coluna('Enviado')).toHaveAttribute('aria-disabled', 'true')
    expect(coluna('Resultado')).toHaveAttribute('aria-disabled', 'true')
    expect(coluna('Preparando')).not.toHaveAttribute('aria-disabled')

    const soltarEmEnviado = createEvent.drop(coluna('Enviado'))
    fireEvent(coluna('Enviado'), soltarEmEnviado)
    expect(titulosDa('Interessado')).toEqual([titulo])

    fireEvent.drop(coluna('Preparando'))
    fireEvent.dragEnd(cartao)
    await waitFor(() => expect(titulosDa('Preparando')).toEqual([titulo]))
    expect(coluna('Enviado')).not.toHaveAttribute('aria-disabled')
  })

  it('ordena pelo prazo, destaca de 0 a 3 dias e manda os encerrados para o fim', async () => {
    banco.acompanhamentos = []
    const comQuatroDias = acompanharComPrazo(0, 4)
    const encerrado = acompanharComPrazo(1, -2)
    const comTresDias = acompanharComPrazo(2, 3)
    const hoje = acompanharComPrazo(3, 0)
    abrir()
    await esperarQuadro()

    expect(titulosDa('Interessado')).toEqual([hoje.titulo, comTresDias.titulo, comQuatroDias.titulo, encerrado.titulo])
    const [cartaoDeHoje, cartaoDeTresDias, cartaoDeQuatroDias, cartaoEncerrado] = cartoesDa('Interessado')
    expect(within(cartaoDeHoje).getByText('Prazo próximo')).toBeInTheDocument()
    expect(within(cartaoDeTresDias).getByText('Prazo próximo')).toBeInTheDocument()
    expect(within(cartaoDeQuatroDias).queryByText('Prazo próximo')).not.toBeInTheDocument()
    expect(within(cartaoEncerrado).getByText('Prazo encerrado')).toBeInTheDocument()
  })

  it('"Deixar de acompanhar" some em Enviado e Resultado e remove o cartão em Interessado', async () => {
    banco.acompanhamentos = []
    const interessado = acompanharComPrazo(0, 10, 'interessado')
    acompanharComPrazo(1, 10, 'enviado')
    const resultado = acompanharComPrazo(2, 10, 'enviado')
    banco.acompanhamentos.find((a) => a.id === resultado.id)!.etapa = 'resultado'
    banco.acompanhamentos.find((a) => a.id === resultado.id)!.resultado = 'nao_venceu'
    abrir()
    await esperarQuadro()

    expect(within(cartoesDa('Enviado')[0]).queryByRole('button', { name: /^Deixar de acompanhar/ })).not.toBeInTheDocument()
    expect(within(cartoesDa('Resultado')[0]).queryByRole('button', { name: /^Deixar de acompanhar/ })).not.toBeInTheDocument()
    expect(within(cartoesDa('Resultado')[0]).getByText('Não venceu')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: `Deixar de acompanhar: ${interessado.titulo}` }))
    await waitFor(() => expect(cartoesDa('Interessado')).toHaveLength(0))
    expect(banco.acompanhamentos.some((a) => a.id === interessado.id)).toBe(false)
  })
})
