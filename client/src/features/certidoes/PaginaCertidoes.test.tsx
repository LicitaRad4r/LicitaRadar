import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { API_URL } from '@/api/config'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'
import { LIMITE_ARQUIVO } from './FormularioRenovacao'

function abrirCertidoes() {
  const router = createMemoryRouter(rotas, { initialEntries: ['/certidoes'] })
  return renderizar(<RouterProvider router={router} />)
}

const grupo = (nome: RegExp) => screen.getByRole('region', { name: nome })
const nomesEm = (regiao: HTMLElement) => within(regiao).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const pdf = (nome = 'certidao.pdf', tamanho = 20) =>
  new File(['%'.repeat(tamanho)], nome, { type: 'application/pdf' })

async function abrirRenovacao(nome: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Renovar certidão ${nome}` }))
  return screen.findByRole('dialog', { name: 'Renovar certidão' })
}

describe('Certidões', () => {
  it('lista primeiro as certidões em alerta, na ordem de urgência, e depois as em dia', async () => {
    abrirCertidoes()

    expect(screen.getByRole('status', { name: 'Carregando certidões' })).toBeInTheDocument()
    await screen.findByRole('heading', { name: 'CRF do FGTS' })

    expect(nomesEm(grupo(/Precisam de atenção \(3\)/))).toEqual([
      'CNDT (débitos trabalhistas)',
      'CRF do FGTS',
      'Certidão negativa municipal',
    ])
    expect(nomesEm(grupo(/Em dia \(2\)/))).toEqual(['Certidão negativa do DF', 'CND Receita Federal e PGFN'])

    const vencida = screen.getByRole('listitem', { name: 'CNDT (débitos trabalhistas)' })
    expect(within(vencida).getByText('Vencida')).toBeInTheDocument()
    expect(within(vencida).getByText('Venceu há 3 dias')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'CRF do FGTS' })).getByText('Urgente')).toBeInTheDocument()
  })

  it('renova a certidão e a lista se atualiza na hora, já na nova posição', async () => {
    abrirCertidoes()
    const dialogo = await abrirRenovacao('CRF do FGTS')
    const novaValidade = somarDias(hojeEmBrasilia(), 200)

    await userEvent.upload(within(dialogo).getByLabelText('Arquivo da certidão nova'), pdf('fgts-2027.pdf'))
    await userEvent.type(within(dialogo).getByLabelText('Nova validade'), novaValidade)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar renovação' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(nomesEm(grupo(/Precisam de atenção \(2\)/))).not.toContain('CRF do FGTS')
    expect(nomesEm(grupo(/Em dia \(3\)/)).at(-1)).toBe('CRF do FGTS')
    expect(within(screen.getByRole('listitem', { name: 'CRF do FGTS' })).getByText('Em dia')).toBeInTheDocument()
  })

  it('mostra a lista atualizada antes de o back confirmar a lista de novo', async () => {
    abrirCertidoes()
    await screen.findByRole('heading', { name: 'CRF do FGTS' })
    // A partir daqui, recarregar a lista demora: o que aparece vem da resposta da renovação.
    servidor.use(
      http.get(`${API_URL}/v1/certidoes`, async () => {
        await delay('infinite')
        return HttpResponse.json({ itens: [] })
      }),
    )
    const dialogo = await abrirRenovacao('CRF do FGTS')

    await userEvent.upload(within(dialogo).getByLabelText('Arquivo da certidão nova'), pdf())
    await userEvent.type(within(dialogo).getByLabelText('Nova validade'), somarDias(hojeEmBrasilia(), 200))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar renovação' }))

    await waitFor(() => expect(nomesEm(grupo(/Em dia/))).toContain('CRF do FGTS'))
  })

  it('valida arquivo e validade antes de enviar', async () => {
    abrirCertidoes()
    const dialogo = await abrirRenovacao('CRF do FGTS')
    const campoArquivo = within(dialogo).getByLabelText('Arquivo da certidão nova')
    const salvar = within(dialogo).getByRole('button', { name: 'Salvar renovação' })

    await userEvent.click(salvar)
    expect(within(dialogo).getByText('Escolha o arquivo da certidão nova.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Informe a nova validade.')).toBeInTheDocument()

    await userEvent.upload(campoArquivo, pdf('grande.pdf', LIMITE_ARQUIVO + 1))
    await userEvent.type(within(dialogo).getByLabelText('Nova validade'), hojeEmBrasilia())
    await userEvent.click(salvar)

    expect(within(dialogo).getByText('O arquivo passa de 5 MB.')).toBeInTheDocument()
    expect(within(dialogo).getByText('A nova validade precisa ser depois de hoje.')).toBeInTheDocument()
    expect(campoArquivo).toHaveAttribute('aria-invalid', 'true')
  })

  it('aceita arquivo de 5 MB exatos', async () => {
    abrirCertidoes()
    const dialogo = await abrirRenovacao('CRF do FGTS')

    await userEvent.upload(within(dialogo).getByLabelText('Arquivo da certidão nova'), pdf('limite.pdf', LIMITE_ARQUIVO))
    await userEvent.type(within(dialogo).getByLabelText('Nova validade'), somarDias(hojeEmBrasilia(), 90))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar renovação' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('mostra no campo certo o erro de validação que vem do back', async () => {
    servidor.use(
      http.put(`${API_URL}/v1/certidoes/:id/renovacao`, () =>
        HttpResponse.json(
          {
            codigo: 'VALIDACAO',
            mensagem: 'Dados inválidos.',
            requestId: 'r1',
            detalhes: [{ campo: 'arquivo', mensagem: 'O arquivo não é um PDF válido.' }],
          },
          { status: 400 },
        ),
      ),
    )
    abrirCertidoes()
    const dialogo = await abrirRenovacao('CRF do FGTS')

    await userEvent.upload(within(dialogo).getByLabelText('Arquivo da certidão nova'), pdf())
    await userEvent.type(within(dialogo).getByLabelText('Nova validade'), somarDias(hojeEmBrasilia(), 90))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar renovação' }))

    expect(await within(dialogo).findByText('O arquivo não é um PDF válido.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cancelar fecha o formulário sem mudar nada', async () => {
    abrirCertidoes()
    const dialogo = await abrirRenovacao('CRF do FGTS')

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(nomesEm(grupo(/Precisam de atenção \(3\)/))).toContain('CRF do FGTS')
  })

  it('para o analista, explica que as certidões ficam com o decisor', async () => {
    servidor.use(
      http.get(`${API_URL}/v1/certidoes`, () =>
        HttpResponse.json({ codigo: 'ACESSO_NEGADO', mensagem: 'Acesso negado.', requestId: 'r2' }, { status: 403 }),
      ),
    )
    abrirCertidoes()

    expect(await screen.findByText('As certidões ficam com o decisor da empresa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  })

  it('sem certidões, mostra o estado vazio', async () => {
    servidor.use(http.get(`${API_URL}/v1/certidoes`, () => HttpResponse.json({ itens: [] })))
    abrirCertidoes()

    expect(await screen.findByText('Nenhuma certidão cadastrada')).toBeInTheDocument()
  })
})
