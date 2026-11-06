import { describe, expect, it } from 'vitest'
import { somarDiasUteis, diaBrasilia } from '../../src/dominio/tempo.js'
import type { Edital } from '../../src/dominio/edital.js'
import { PerfilEntrada } from '../../src/perfil/schema.js'
import { calcularScore } from '../../src/score/score.js'

/** Casos tabelados do Caderno (docs: Regra de negócio > Score, "Casos tabelados"). */
const agora = new Date('2026-10-15T13:00:00Z') // quinta, 15/10/2026, 10:00 em Brasília
const hoje = diaBrasilia(agora)

const perfil = PerfilEntrada.parse({
  termosChave: ['notebook'],
  ufs: ['DF'],
  modalidades: ['pregao_eletronico', 'concorrencia'],
  valorMinimo: 10_000,
  valorMaximo: 100_000,
  prazoMinimoDiasUteis: 3,
})

const base: Edital = {
  id: 'tab-base',
  objeto: 'Aquisição de notebooks para a rede',
  descricao: 'Equipamentos de informática.',
  orgao: 'Secretaria de Educação do DF',
  uf: 'DF',
  municipio: 'Brasília',
  modalidade: 'pregao_eletronico',
  segmento: null,
  valorEstimado: 50_000,
  dataPublicacao: '2026-10-14T12:00:00-03:00',
  dataLimite: `${somarDiasUteis(hoje, 10)}T15:00:00-03:00`,
}

const calcular = (variacao: Partial<Edital>) => {
  const r = calcularScore(perfil, { ...base, ...variacao }, agora)
  return r.descartado ? `descartado:${r.motivo}` : `${r.nota}:${r.faixa}`
}

describe('Score: casos tabelados do Caderno', () => {
  it.each([
    [1, 'edital ideal', {}, '100:alta'],
    [2, 'valor = R$ 100.000,00 (limite da faixa)', { valorEstimado: 100_000 }, '100:alta'],
    [3, 'valor = R$ 100.000,01 (limite + R$ 0,01)', { valorEstimado: 100_000.01 }, '90:alta'],
    [4, 'valor = R$ 110.000,00 (limite + 10%, tolerância)', { valorEstimado: 110_000 }, '90:alta'],
    [5, 'valor = R$ 110.000,01 (tolerância + R$ 0,01)', { valorEstimado: 110_000.01 }, 'descartado:valor'],
    [6, 'valor = R$ 9.999,99 (mínimo − R$ 0,01)', { valorEstimado: 9_999.99 }, '90:alta'],
    [7, 'sem valor estimado', { valorEstimado: null }, '85:alta'],
    [8, 'termo só na descrição', { objeto: 'Contratação de serviços de TI', descricao: 'Inclui notebook para a equipe.' }, '80:alta'],
    [9, 'UF = SP', { uf: 'SP' }, '75:media'],
    [10, 'sem nenhum termo do perfil', { objeto: 'Serviços de limpeza predial', descricao: 'Limpeza e conservação.' }, 'descartado:termo'],
  ] as const)('caso %i: %s', (_n, _titulo, variacao, esperado) => {
    expect(calcular(variacao)).toBe(esperado)
  })
})
