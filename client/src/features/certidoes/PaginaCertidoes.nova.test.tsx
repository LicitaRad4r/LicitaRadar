import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { configurarSessao } from '@/lib/sessao'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { criarSessaoMock, USUARIOS_DEMO } from '@/mocks/sessao'
import { servidor } from '@/mocks/servidor'
import { API_URL } from '@/services/config'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'
import { LIMITE_ARQUIVO } from './arquivoDaCertidao'

function abrirCertidoes() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/certidoes'] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

const grupo = (nome: RegExp) => screen.getByRole('region', { name: nome })
const nomesEm = (regiao: HTMLElement) => within(regiao).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const pdf = (nome = 'certidao.pdf', tamanho = 20) => new File(['%'.repeat(tamanho)], nome, { type: 'application/pdf' })

async function abrirNovaCertidao() {
  await screen.findByRole('heading', { name: 'CRF do FGTS' })
  await userEvent.click(screen.getByRole('button', { name: 'Nova certidão' }))
  return screen.findByRole('dialog', { name: 'Nova certidão' })
}

async function preencher(
  dialogo: HTMLElement,
  { nome = 'Certidão de falência', arquivo = pdf(), validade = somarDias(hojeEmBrasilia(), 20) } = {},
) {
  if (nome) await userEvent.type(within(dialogo).getByLabelText('Tipo da certidão'), nome)
  if (arquivo) await userEvent.upload(within(dialogo).getByLabelText('Arquivo da certidão nova'), arquivo)
  if (validade) await userEvent.type(within(dialogo).getByLabelText('Validade'), validade)
}

function contarEnvios() {
  const envios: Request[] = []
  servidor.events.on('request:start', ({ request }) => {
    if (request.method === 'POST' && request.url.endsWith('/v1/certidoes')) envios.push(request)
  })
  return envios
}

describe('Certidões: envio de certidão nova (US14)', () => {
  it('pelo teclado, envia a certidão e ela aparece na lista com o selo de status, sem recarregar', async () => {
    abrirCertidoes()
    await screen.findByRole('heading', { name: 'CRF do FGTS' })

    screen.getByRole('button', { name: 'Nova certidão' }).focus()
    await userEvent.keyboard('{Enter}')
    const dialogo = await screen.findByRole('dialog', { name: 'Nova certidão' })

    await preencher(dialogo)
    within(dialogo).getByRole('button', { name: 'Enviar certidão' }).focus()
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(nomesEm(grupo(/Precisam de atenção \(4\)/))).toContain('Certidão de falência')
    const criada = screen.getByRole('listitem', { name: 'Certidão de falência' })
    expect(within(criada).getByText('Atenção')).toBeInTheDocument()
    expect(within(criada).getByText('Vence em 20 dias')).toBeInTheDocument()
  })

  it('sem validade, o envio é bloqueado com a mensagem no campo', async () => {
    const envios = contarEnvios()
    abrirCertidoes()
    const dialogo = await abrirNovaCertidao()

    await preencher(dialogo, { validade: '' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar certidão' }))

    const campoValidade = within(dialogo).getByLabelText('Validade')
    expect(await within(dialogo).findByText('Informe a validade.')).toBeInTheDocument()
    expect(campoValidade).toHaveAttribute('aria-invalid', 'true')
    expect(campoValidade).toHaveAccessibleDescription('Informe a validade.')
    expect(envios).toHaveLength(0)
  })

  it('arquivo acima de 5 MB mostra a mensagem de limite; 5 MB exatos passa', async () => {
    const envios = contarEnvios()
    abrirCertidoes()
    const dialogo = await abrirNovaCertidao()

    await preencher(dialogo, { arquivo: pdf('grande.pdf', LIMITE_ARQUIVO + 1) })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar certidão' }))
    expect(await within(dialogo).findByText('O arquivo passa de 5 MB.')).toBeInTheDocument()
    expect(envios).toHaveLength(0)

    await userEvent.upload(within(dialogo).getByLabelText('Arquivo da certidão nova'), pdf('limite.pdf', LIMITE_ARQUIVO))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar certidão' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(envios).toHaveLength(1)
  })

  it('erro da API mantém a lista como estava e deixa tentar de novo', async () => {
    servidor.use(
      http.post(`${API_URL}/v1/certidoes`, () =>
        HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'falhou', requestId: 'r1' }, { status: 500 }),
      ),
    )
    abrirCertidoes()
    const dialogo = await abrirNovaCertidao()

    await preencher(dialogo)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Enviar certidão' }))

    expect(await within(dialogo).findByRole('alert')).toBeInTheDocument()
    // Com o diálogo aberto, a lista atrás dele fica escondida da árvore de acessibilidade.
    expect(screen.getByRole('region', { name: /Precisam de atenção \(3\)/, hidden: true })).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: 'Certidão de falência', hidden: true })).not.toBeInTheDocument()

    servidor.resetHandlers()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('listitem', { name: 'Certidão de falência' })).toBeInTheDocument()
  })

  it('o analista não vê o botão nem a página', async () => {
    configurarSessao(criarSessaoMock(USUARIOS_DEMO[1]))
    const { router } = abrirCertidoes()

    expect(await screen.findByRole('heading', { name: 'Acesso negado' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/acesso-negado')
    expect(screen.queryByRole('button', { name: 'Nova certidão' })).not.toBeInTheDocument()
  })
})
