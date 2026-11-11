import { describe, expect, it } from 'vitest'
import { diaBrasilia, diasUteisEntre, somarDiasUteis } from '../../src/dominio/tempo.js'
import { normalizar } from '../../src/dominio/normalizar.js'
import { calcularScore } from '../../src/score/score.js'
import { editaisGolden, PERFIL_A, PERFIL_B } from '../../src/seed/golden.js'

const agora = new Date('2026-10-15T13:00:00Z') // 15/10/2026 10:00 em Brasília (quinta)
const golden = Object.fromEntries(editaisGolden(agora).map((e) => [e.id.replace('golden-', ''), e]))

const nota = (perfil: typeof PERFIL_A, id: string) => {
  const r = calcularScore(perfil, golden[id]!, agora)
  return r.descartado ? `descartado:${r.motivo}` : r.nota
}

describe('Score de Aderência: Golden Set (perfil A)', () => {
  it('A vale 100 (alta)', () => {
    const r = calcularScore(PERFIL_A, golden.A!, agora)
    expect(r).toEqual({ descartado: false, nota: 100, faixa: 'alta' })
  })
  it('B vale 65 (média): termo só na descrição, valor 4% acima, 5 dias úteis', () => {
    expect(calcularScore(PERFIL_A, golden.B!, agora)).toEqual({ descartado: false, nota: 65, faixa: 'media' })
  })
  it('C vale 75 (média): igual a A, mas no RS', () => expect(nota(PERFIL_A, 'C')).toBe(75))
  it('D, E e F são descartados por valor, prazo e termo', () => {
    expect(nota(PERFIL_A, 'D')).toBe('descartado:valor')
    expect(nota(PERFIL_A, 'E')).toBe('descartado:prazo')
    expect(nota(PERFIL_A, 'F')).toBe('descartado:termo')
  })
})

describe('Isolamento de perfil (CT-FEED-003)', () => {
  it('A vale 100 para a A e 75 para a B; C vale 75 para a A e 100 para a B', () => {
    expect([nota(PERFIL_A, 'A'), nota(PERFIL_B, 'A')]).toEqual([100, 75])
    expect([nota(PERFIL_A, 'C'), nota(PERFIL_B, 'C')]).toEqual([75, 100])
  })
})

describe('Regras do score', () => {
  it('é determinístico', () => {
    expect(calcularScore(PERFIL_A, golden.A!, agora)).toEqual(calcularScore(PERFIL_A, golden.A!, agora))
  })
  it('reescala quando UF, valor e modalidade não são configurados', () => {
    const perfil = { ...PERFIL_A, ufs: [], modalidades: [], valorMinimo: null, valorMaximo: null }
    // só termo (40) + prazo (10) sobre base 50 = 100
    expect(calcularScore(perfil, golden.A!, agora)).toMatchObject({ nota: 100 })
  })
  it('edital sem valor não é descartado e pontua 0 no critério', () => {
    const sem = { ...golden.A!, valorEstimado: null }
    expect(calcularScore(PERFIL_A, sem, agora)).toMatchObject({ nota: 85 })
  })
  it('prazo já expirado descarta', () => {
    const vencido = { ...golden.A!, dataLimite: '2026-10-14T10:00:00-03:00' }
    expect(calcularScore(PERFIL_A, vencido, agora)).toEqual({ descartado: true, motivo: 'prazo' })
  })
  it('faixas: 80 ou mais alta, 50 a 79 média, abaixo de 50 baixa', () => {
    const perfil = { ...PERFIL_A, ufs: [], modalidades: [], valorMinimo: null, valorMaximo: null }
    const parcial = { ...golden.B!, dataLimite: golden.A!.dataLimite } // termo parcial 20 + prazo 10 sobre 50
    expect(calcularScore(perfil, parcial, agora)).toMatchObject({ nota: 60, faixa: 'media' })
  })
})

describe('Normalizador e tempo', () => {
  it('"NOTEBOOK", "Notébook" e "notebooks" são iguais', () => {
    expect(normalizar('NOTEBOOK')).toEqual(normalizar('Notébook'))
    expect(normalizar('notebooks')).toEqual(normalizar('notebook'))
  })
  it('dias úteis ignoram fim de semana', () => {
    expect(diasUteisEntre('2026-10-15', '2026-10-19')).toBe(2) // sex 16 e seg 19
    expect(somarDiasUteis('2026-10-15', 9)).toBe('2026-10-28')
  })
  it('o dia vem do fuso de Brasília', () => {
    expect(diaBrasilia(new Date('2026-10-16T02:59:59Z'))).toBe('2026-10-15')
    expect(diaBrasilia(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-16')
  })
})
