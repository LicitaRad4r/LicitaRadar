import { describe, expect, it } from 'vitest'
import { ApiError } from '@/services/erros'
import { criarQueryClient } from './cache'

describe('Política de repetição automática (CT-FEED-008)', () => {
  const retry = criarQueryClient().getDefaultOptions().queries!.retry as (n: number, e: Error) => boolean
  const erro500 = new ApiError(500, undefined)

  it('erro 5xx repete até 2 vezes: 0 e 1 tentativas já feitas repetem, 2 não', () => {
    expect([retry(0, erro500), retry(1, erro500), retry(2, erro500)]).toEqual([true, true, false])
  })
  it('erro de conexão também repete', () => {
    expect(retry(0, new ApiError(0, { codigo: 'SEM_CONEXAO' }))).toBe(true)
  })
  it.each([400, 401, 403, 404])('erro %i nunca repete (repetir não muda nada)', (status) => {
    expect(retry(0, new ApiError(status, undefined))).toBe(false)
  })
})
