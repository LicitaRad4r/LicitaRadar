import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { API_URL } from '@/services/config'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'

const grupo = (nome: RegExp) => screen.getByRole('region', { name: nome })
const nomesEm = (regiao: HTMLElement) => within(regiao).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const pdf = () => new File(['%'.repeat(20)], 'certidao.pdf', { type: 'application/pdf' })

describe('Certidões: falha no envio da renovação', () => {
  it('CT-CERT-009: erro 500 no envio mantém o formulário, avisa o erro e deixa a certidão anterior como estava', async () => {
    servidor.use(
      http.put(`${API_URL}/v1/certidoes/:id/renovacao`, () =>
        HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'falhou', requestId: 'r9' }, { status: 500 }),
      ),
    )
    const router = createMemoryRouter(rotas, { initialEntries: ['/certidoes'] })
    renderizar(<RouterProvider router={router} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Renovar certidão CRF do FGTS' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Renovar certidão' })
    await userEvent.upload(within(dialogo).getByLabelText('Arquivo da certidão nova'), pdf())
    await userEvent.type(within(dialogo).getByLabelText('Nova validade'), somarDias(hojeEmBrasilia(), 200))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar renovação' }))

    // O formulário continua aberto, com aviso de erro, e dá para tentar de novo.
    expect(await within(dialogo).findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Renovar certidão' })).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Salvar renovação' })).toBeEnabled()

    // A certidão anterior continua no mesmo grupo e com o mesmo status.
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(nomesEm(grupo(/Precisam de atenção/))).toContain('CRF do FGTS')
  })

  // CT-CERT-008: depende de decisão do produto sobre o texto "Todas as certidões estão em dia".
  // Hoje a tela só mostra o grupo "Em dia"; a mensagem do plano não existe no código.
  it.todo('CT-CERT-008: com todas as certidões em dia (31 dias ou mais), a tela mostra "Todas as certidões estão em dia"')
})
