import { describe, expect, it } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { API_URL } from '@/api/config'
import { chaves } from '@/api/chaves'
import type { FeedPagina } from '@/api/tipos'
import { servidor } from '@/mocks/servidor'
import { renderizarHook } from '@/testes/utils'
import { useFeedback } from './editais/api'
import { useFeed } from './feed/api'
import { useCriarCertidao, useCertidoes } from './certidoes/api'
import { useAlertas, useMarcarAlerta } from './alertas/api'

describe('feed', () => {
  it('lista editais ordenados por score e aplica filtros', async () => {
    const { result } = renderizarHook(() => useFeed({ uf: ['GO'] }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const scores = result.current.data!.itens.map((e) => e.score)
    expect(result.current.data!.itens.every((e) => e.uf === 'GO')).toBe(true)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('marca relevante na hora e desfaz se a API falhar', async () => {
    servidor.use(
      http.put(`${API_URL}/v1/editais/:id/feedback`, async () => {
        await delay(100)
        return HttpResponse.json({ codigo: 'ERRO_INTERNO', mensagem: 'falhou' }, { status: 500 })
      }),
    )
    const { result, queryClient } = renderizarHook(() => ({ feed: useFeed(), feedback: useFeedback() }))
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true))
    const primeiro = result.current.feed.data!.itens[0]
    const lerFeedback = () =>
      queryClient.getQueryData<FeedPagina>(chaves.feed.lista({}))!.itens.find((e) => e.id === primeiro.id)!.feedback

    act(() => result.current.feedback.mutate({ editalId: primeiro.id, valor: 'relevante' }))
    await waitFor(() => expect(lerFeedback()).toBe('relevante'))

    await waitFor(() => expect(result.current.feedback.isError).toBe(true))
    expect(lerFeedback()).toBeNull()
  })
})

describe('certidões', () => {
  it('cadastra e recarrega a lista com o status calculado', async () => {
    const { result } = renderizarHook(() => ({ lista: useCertidoes(), criar: useCriarCertidao() }))
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))
    const antes = result.current.lista.data!.length

    await act(() => result.current.criar.mutateAsync({ tipo: 'municipal', dataValidade: '2000-01-01' }))

    await waitFor(() => expect(result.current.lista.data!.length).toBe(antes + 1))
    expect(result.current.lista.data!.at(-1)!.status).toBe('vencida')
  })

  it('devolve os erros de validação por campo', async () => {
    const { result } = renderizarHook(() => useCriarCertidao())

    await act(() =>
      result.current.mutateAsync({ tipo: 'federal', dataValidade: '' }).catch(() => undefined),
    )

    expect(result.current.error?.codigo).toBe('VALIDACAO')
    expect(result.current.error?.detalhes[0].campo).toBe('dataValidade')
  })
})

describe('alertas', () => {
  it('marca como lido', async () => {
    const { result } = renderizarHook(() => ({ alertas: useAlertas(), marcar: useMarcarAlerta() }))
    await waitFor(() => expect(result.current.alertas.isSuccess).toBe(true))
    const naoLido = result.current.alertas.data!.itens.find((a) => !a.lido)!

    await act(() => result.current.marcar.mutateAsync({ alertaId: naoLido.id, lido: true }))

    await waitFor(() =>
      expect(result.current.alertas.data!.itens.find((a) => a.id === naoLido.id)!.lido).toBe(true),
    )
  })
})
