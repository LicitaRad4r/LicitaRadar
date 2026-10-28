import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { API_URL } from '@/api/config'
import { useCertidoes } from '@/features/certidoes/api'
import { servidor } from '@/mocks/servidor'
import { renderizar } from '@/testes/utils'
import { EstadoDaConsulta } from './EstadoDaConsulta'
import { Vazio } from './Vazio'

function ListaDeCertidoes() {
  const consulta = useCertidoes()
  return (
    <EstadoDaConsulta consulta={consulta} vazio={<Vazio titulo="Nenhuma certidão cadastrada" />}>
      {(certidoes) => (
        <ul>
          {certidoes.map((c) => (
            <li key={c.id}>{c.descricao}</li>
          ))}
        </ul>
      )}
    </EstadoDaConsulta>
  )
}

describe('EstadoDaConsulta', () => {
  it('mostra carregando e depois os dados (sucesso)', async () => {
    renderizar(<ListaDeCertidoes />)

    expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument()
    expect(await screen.findByText('CRF do FGTS')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Carregando' })).not.toBeInTheDocument()
  })

  it('mostra o estado vazio quando a lista vem vazia', async () => {
    servidor.use(http.get(`${API_URL}/v1/certidoes`, () => HttpResponse.json({ itens: [] })))

    renderizar(<ListaDeCertidoes />)

    expect(await screen.findByText('Nenhuma certidão cadastrada')).toBeInTheDocument()
  })

  it('mostra o erro e consegue tentar de novo', async () => {
    let falhar = true
    servidor.use(
      http.get(`${API_URL}/v1/certidoes`, () =>
        falhar
          ? HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'falhou' }, { status: 500 })
          : HttpResponse.json({ itens: [{ id: 'c1', tipo: 'fgts', descricao: 'Recuperada', dataValidade: '2030-01-01', status: 'valida' }] }),
      ),
    )

    renderizar(<ListaDeCertidoes />)

    expect(await screen.findByRole('alert')).toHaveTextContent('O servidor teve um problema')

    falhar = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => expect(screen.getByText('Recuperada')).toBeInTheDocument())
  })
})
