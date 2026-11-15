import { describe, expect, it, onTestFinished } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { banco } from '@/mocks/dados'
import { servidor } from '@/mocks/servidor'
import { rotas } from '@/routes/rotas'
import { API_URL } from '@/services/config'
import type { PerfilDTO } from '@/services/dto'
import { renderizar } from '@/testes/utils'

function abrir(url: string) {
  const router = createMemoryRouter(rotas, { initialEntries: [url] })
  return { router, ...renderizar(<RouterProvider router={router} />) }
}

function guardarCorpoDoPut() {
  const corposEnviados: PerfilDTO[] = []
  const guardarSeForPutDoPerfil = async ({ request }: { request: Request }) => {
    if (request.method === 'PUT' && request.url.endsWith('/v1/perfil')) corposEnviados.push(await request.clone().json())
  }
  servidor.events.on('request:start', guardarSeForPutDoPerfil)
  onTestFinished(() => servidor.events.removeListener('request:start', guardarSeForPutDoPerfil))
  return corposEnviados
}

const campoDeTermo = () => screen.getByLabelText('Termos-chave')
const termosAdicionados = () => screen.getByRole('list', { name: 'Termos-chave adicionados' })

async function adicionarTermo(termo: string) {
  await userEvent.clear(campoDeTermo())
  await userEvent.type(campoDeTermo(), `${termo}{Enter}`)
}

describe('Perfil da empresa (BUG-005, US06/US07)', () => {
  it('carrega o perfil salvo no formulário', async () => {
    abrir('/perfil')

    expect(await screen.findByRole('heading', { name: 'Perfil da empresa' })).toBeInTheDocument()
    expect(await within(await screen.findByRole('list', { name: 'Termos-chave adicionados' })).findByText('notebook')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'DF' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'GO' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'SP' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Pregão eletrônico' })).toBeChecked()
    expect(screen.getByLabelText('Valor mínimo')).toHaveValue(50_000)
    expect(screen.getByLabelText('Valor máximo')).toHaveValue(3_000_000)
    expect(screen.getByLabelText('Prazo mínimo para a proposta (dias úteis)')).toHaveValue(3)
  })

  it('recusa termo com menos de 2 caracteres e termo repetido', async () => {
    abrir('/perfil')
    await screen.findByRole('list', { name: 'Termos-chave adicionados' })

    await adicionarTermo('a')
    expect(screen.getByText('O termo precisa de pelo menos 2 caracteres.')).toBeInTheDocument()
    expect(campoDeTermo()).toHaveAttribute('aria-invalid', 'true')

    await adicionarTermo('NOTEBOOK')
    expect(screen.getByText('Esse termo já está na lista.')).toBeInTheDocument()

    await adicionarTermo('impressora')
    expect(within(termosAdicionados()).getByText('impressora')).toBeInTheDocument()
    expect(screen.queryByText('Esse termo já está na lista.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remover termo impressora' }))
    expect(within(termosAdicionados()).queryByText('impressora')).not.toBeInTheDocument()
  })

  it('não envia quando o valor máximo é menor que o mínimo', async () => {
    const corposEnviados = guardarCorpoDoPut()
    abrir('/perfil')
    const valorMaximo = await screen.findByLabelText('Valor máximo')

    await userEvent.clear(valorMaximo)
    await userEvent.type(valorMaximo, '1000')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))

    expect(await screen.findByText('O valor máximo deve ser maior ou igual ao mínimo.')).toBeInTheDocument()
    expect(valorMaximo).toHaveAttribute('aria-invalid', 'true')
    expect(corposEnviados).toHaveLength(0)
  })

  it('salva o perfil e mantém os segmentos, que não aparecem na tela', async () => {
    const corposEnviados = guardarCorpoDoPut()
    abrir('/perfil')
    await screen.findByRole('list', { name: 'Termos-chave adicionados' })

    await adicionarTermo('impressora')
    await userEvent.click(screen.getByRole('checkbox', { name: 'GO' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Concorrência' }))
    await userEvent.clear(screen.getByLabelText('Prazo mínimo para a proposta (dias úteis)'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))

    await waitFor(() => expect(corposEnviados).toHaveLength(1))
    expect(corposEnviados[0]).toEqual({
      termosChave: ['notebook', 'computador', 'suporte técnico', 'software', 'impressora'],
      ufs: ['DF'],
      modalidades: ['pregao_eletronico', 'concorrencia'],
      valorMinimo: 50_000,
      valorMaximo: 3_000_000,
      prazoMinimoDiasUteis: null,
      segmentos: ['ti'],
    })
    expect(banco.perfil.ufs).toEqual(['DF'])
  })

  it('mostra no campo o erro de validação devolvido pela API', async () => {
    servidor.use(
      http.put(`${API_URL}/v1/perfil`, () =>
        HttpResponse.json(
          {
            codigo: 'VALIDACAO',
            mensagem: 'Dados inválidos.',
            requestId: 'r1',
            detalhes: [{ campo: 'termosChave.0', mensagem: 'Mínimo de 2 caracteres' }],
          },
          { status: 400 },
        ),
      ),
    )
    abrir('/perfil')
    await screen.findByRole('list', { name: 'Termos-chave adicionados' })

    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))

    expect(await screen.findByText('Mínimo de 2 caracteres')).toBeInTheDocument()
  })

  it('erro ao carregar o perfil mostra a mensagem e permite tentar de novo', async () => {
    let falhar = true
    servidor.use(
      http.get(`${API_URL}/v1/perfil`, () =>
        falhar
          ? HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'Falhou.', requestId: 'r2' }, { status: 500 })
          : undefined,
      ),
    )
    abrir('/perfil')

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o perfil')
    falhar = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('list', { name: 'Termos-chave adicionados' })).toBeInTheDocument()
  })

  it('empresa nova: do feed vai para o perfil, salva e passa a ver o feed ranqueado', async () => {
    banco.perfil = { empresaId: null, ufs: [], termosChave: [] }
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        banco.perfil.empresaId
          ? undefined
          : HttpResponse.json(
              { codigo: 'EMPRESA_NAO_CONFIGURADA', mensagem: 'Configure o perfil.', requestId: 'r3' },
              { status: 403 },
            ),
      ),
    )
    const { router } = abrir('/')

    await userEvent.click(await screen.findByRole('link', { name: 'Configurar perfil' }))
    expect(await screen.findByText('Configure o perfil da sua empresa para começar a ver os editais ranqueados.')).toBeInTheDocument()

    await adicionarTermo('notebook')
    await userEvent.click(screen.getByRole('checkbox', { name: 'DF' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))

    expect(await screen.findByRole('heading', { name: 'Editais para você' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(await screen.findAllByRole('article')).not.toHaveLength(0)
  })
  it('do feed sem editais para o perfil, leva ao perfil; salvar muda o feed (US08)', async () => {
    const TERMO_QUE_TRAZ_EDITAIS = 'impressora'
    servidor.use(
      http.get(`${API_URL}/v1/feed`, () =>
        banco.perfil.termosChave?.includes(TERMO_QUE_TRAZ_EDITAIS)
          ? undefined
          : HttpResponse.json({ itens: [], page: 1, pageSize: 10, total: 0, totalIngeridos: 24, motivoVazio: 'todos_descartados' }),
      ),
    )
    abrir('/')

    expect(await screen.findByText('Nenhum edital combina com o perfil da sua empresa')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Revisar perfil' }))

    await screen.findByRole('list', { name: 'Termos-chave adicionados' })
    await adicionarTermo(TERMO_QUE_TRAZ_EDITAIS)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    await waitFor(() => expect(banco.perfil.termosChave).toContain(TERMO_QUE_TRAZ_EDITAIS))

    await userEvent.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Editais' }))
    expect(await screen.findAllByRole('article')).not.toHaveLength(0)
    expect(screen.queryByText('Nenhum edital combina com o perfil da sua empresa')).not.toBeInTheDocument()
  })

  it('dá para preencher e salvar só pelo teclado, e todo campo tem rótulo', async () => {
    const corposEnviados = guardarCorpoDoPut()
    abrir('/perfil')
    await screen.findByRole('list', { name: 'Termos-chave adicionados' })
    const botaoSalvar = screen.getByRole('button', { name: 'Salvar perfil' })

    const camposVisitados: HTMLElement[] = []
    async function tabularAte(chegou: (elemento: HTMLElement) => boolean) {
      for (let tentativas = 0; tentativas < 100; tentativas++) {
        await userEvent.tab()
        const focado = document.activeElement as HTMLElement
        camposVisitados.push(focado)
        if (chegou(focado)) return focado
      }
      throw new Error('O foco não chegou ao elemento esperado pelo teclado.')
    }

    await tabularAte((elemento) => elemento === campoDeTermo())
    await userEvent.keyboard('impressora{Enter}')
    await tabularAte((elemento) => elemento === screen.getByRole('checkbox', { name: 'SP' }))
    await userEvent.keyboard(' ')
    await tabularAte((elemento) => elemento === screen.getByRole('checkbox', { name: 'Dispensa' }))
    await userEvent.keyboard(' ')
    await tabularAte((elemento) => elemento === botaoSalvar)
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(corposEnviados).toHaveLength(1))
    expect(corposEnviados[0].termosChave).toContain('impressora')
    expect(corposEnviados[0].ufs).toEqual(['DF', 'GO', 'SP'])
    expect(corposEnviados[0].modalidades).toEqual(['pregao_eletronico', 'dispensa'])

    const camposDoFormulario = camposVisitados.filter((elemento) => elemento instanceof HTMLInputElement)
    expect(camposDoFormulario.length).toBeGreaterThan(30)
    for (const campo of camposDoFormulario as HTMLInputElement[]) {
      expect(campo.labels?.length, `campo sem rótulo: ${campo.outerHTML}`).toBeGreaterThan(0)
    }
  })
})
