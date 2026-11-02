import { describe, test, expect } from 'vitest'
import { aplicarPaginacao } from '../src/helpers/pagination'

describe('CT-FIN: Práticas Finops e Proteção de Consultas', () => {
  test('CT-FIN-001: helper nunca devolve limite maior que 100', () => {
    const resultadoExcedente = aplicarPaginacao({ limite: 500 })
    expect(resultadoExcedente.limit).toBe(100)

    const resultadoPadrao = aplicarPaginacao({})
    expect(resultadoPadrao.limit).toBeLessThanOrEqual(100)
  })

  test('CT-FIN-002: helper lida com valores negativos ou zerados com segurança', () => {
    const resultadoNegativo = aplicarPaginacao({ limite: -10, pagina: -1 })
    expect(resultadoNegativo.limit).toBeGreaterThan(0)
    expect(resultadoNegativo.pagina).toBe(1)
  })
})