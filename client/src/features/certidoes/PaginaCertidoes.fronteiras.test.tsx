import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { API_URL } from '@/services/config'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { calcularCertidao } from '@/mocks/dados'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'

const grupo = (nome: RegExp) => screen.getByRole('region', { name: nome })
const nomesEm = (regiao: HTMLElement) => within(regiao).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

describe('Certidões: fronteiras de status no painel (CT-CERT-002)', () => {
  it('16 e 30 dias pedem atenção; 31 dias já está em dia; 15 dias é urgente; ontem é vencida', async () => {
    const hoje = hojeEmBrasilia()
    const itens = [
      { id: 'c-1', nome: 'Vencida (-1)', validade: somarDias(hoje, -1) },
      { id: 'c-2', nome: 'Urgente (15)', validade: somarDias(hoje, 15) },
      { id: 'c-3', nome: 'Atenção (16)', validade: somarDias(hoje, 16) },
      { id: 'c-4', nome: 'Atenção (30)', validade: somarDias(hoje, 30) },
      { id: 'c-5', nome: 'Em dia (31)', validade: somarDias(hoje, 31) },
    ].map(calcularCertidao)
    servidor.use(http.get(`${API_URL}/v1/certidoes`, () => HttpResponse.json({ itens })))

    const router = createMemoryRouter(rotas, { initialEntries: ['/certidoes'] })
    renderizar(<RouterProvider router={router} />)
    await screen.findByRole('heading', { name: 'Em dia (31)' })

    const alerta = nomesEm(grupo(/Precisam de atenção \(4\)/))
    expect(alerta).toEqual(['Vencida (-1)', 'Urgente (15)', 'Atenção (16)', 'Atenção (30)'])
    expect(nomesEm(grupo(/Em dia \(1\)/))).toEqual(['Em dia (31)'])
    expect(within(screen.getByRole('listitem', { name: 'Urgente (15)' })).getByText('Urgente')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Atenção (30)' })).getByText('Atenção')).toBeInTheDocument()
  })
})
