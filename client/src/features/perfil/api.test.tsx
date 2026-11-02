import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { configurarToken } from '@/api/client'
import { banco } from '@/mocks/dados'
import { renderizarHook } from '@/testes/utils'
import { useSalvarPerfil } from './api'

afterEach(() => configurarToken(async () => null))

describe('salvar perfil', () => {
  it('no primeiro salvamento (201), renova o token para receber empresa e papel', async () => {
    const renovar = vi.fn(async () => {})
    configurarToken(async () => 'token', renovar)
    banco.perfil = { empresaId: null, ufs: [], termosChave: [] }
    const { result } = renderizarHook(() => useSalvarPerfil())

    await act(() => result.current.mutateAsync({ empresaId: null, ufs: ['DF'], termosChave: ['notebook'] }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(renovar).toHaveBeenCalledOnce()
    expect(result.current.data?.empresaId).toBe('empresa-demo')
  })

  it('nos salvamentos seguintes (200), não renova o token', async () => {
    const renovar = vi.fn(async () => {})
    configurarToken(async () => 'token', renovar)
    const { result } = renderizarHook(() => useSalvarPerfil())

    await act(() => result.current.mutateAsync({ ufs: ['GO'], termosChave: ['software'] }))

    expect(renovar).not.toHaveBeenCalled()
  })
})
