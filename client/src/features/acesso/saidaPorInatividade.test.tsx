import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { LIMITE_DE_INATIVIDADE_MS } from '@/lib/inatividade'
import { sessao } from '@/lib/sessao'
import { SENHA_DEMO, USUARIOS_DEMO } from '@/mocks/sessao'
import { rotas } from '@/routes/rotas'
import { renderizar } from '@/testes/utils'

const UM_MINUTO_MS = 60_000
const INICIO = new Date('2026-11-20T09:00:00-03:00').getTime()
const AVISO_DE_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo para continuar de onde parou.'

function abrir(url: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

function passarTempoSemAtividade(milissegundos: number) {
  act(() => vi.advanceTimersByTime(milissegundos))
}

function voltarParaAba() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function atividadeEmOutraAba(quando: number) {
  localStorage.setItem('licitaradar:ultima-atividade', String(quando))
}

describe('US02: saída automática depois de 4 horas sem atividade', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: INICIO })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('3 h 59 min sem atividade continua logado; com 4 h sai e mostra o aviso', async () => {
    const { router } = abrir('/?uf=DF')
    expect(await screen.findByRole('heading', { name: 'Editais para você' })).toBeInTheDocument()

    passarTempoSemAtividade(LIMITE_DE_INATIVIDADE_MS - UM_MINUTO_MS)
    expect(sessao.atual().usuario).not.toBeNull()

    passarTempoSemAtividade(UM_MINUTO_MS)
    expect(await screen.findByText(AVISO_DE_SESSAO_EXPIRADA)).toBeInTheDocument()
    expect(sessao.atual().usuario).toBeNull()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('a aba parada confere o prazo ao voltar a ficar visível', async () => {
    abrir('/')
    await screen.findByRole('heading', { name: 'Editais para você' })

    vi.setSystemTime(INICIO + LIMITE_DE_INATIVIDADE_MS)
    voltarParaAba()

    expect(await screen.findByText(AVISO_DE_SESSAO_EXPIRADA)).toBeInTheDocument()
  })

  it('atividade em outra aba conta para esta', async () => {
    abrir('/')
    await screen.findByRole('heading', { name: 'Editais para você' })

    const atividadeNaOutraAba = INICIO + 3 * 60 * UM_MINUTO_MS
    atividadeEmOutraAba(atividadeNaOutraAba)
    vi.setSystemTime(INICIO + LIMITE_DE_INATIVIDADE_MS)
    voltarParaAba()

    expect(sessao.atual().usuario).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Editais para você' })).toBeInTheDocument()

    vi.setSystemTime(atividadeNaOutraAba + LIMITE_DE_INATIVIDADE_MS)
    voltarParaAba()
    expect(await screen.findByText(AVISO_DE_SESSAO_EXPIRADA)).toBeInTheDocument()
  })

  it('reabrir o app depois de 4 h parado leva ao login; ao entrar de novo, volta para a página', async () => {
    atividadeEmOutraAba(INICIO - LIMITE_DE_INATIVIDADE_MS)
    const { router } = abrir('/certidoes')

    expect(await screen.findByText(AVISO_DE_SESSAO_EXPIRADA)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('E-mail'), USUARIOS_DEMO[0].email)
    await userEvent.type(screen.getByLabelText('Senha'), SENHA_DEMO)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('heading', { name: 'Certidões' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/certidoes')
  })
})
