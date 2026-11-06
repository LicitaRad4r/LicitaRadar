import { describe, expect, it } from 'vitest'
import { somarDiasUteis, diaBrasilia } from '../../src/dominio/tempo.js'
import type { Edital } from '../../src/dominio/edital.js'
import { ConsultaFeed } from '../../src/feed/consulta.js'
import { PerfilEntrada } from '../../src/perfil/schema.js'
import { calcularScore } from '../../src/score/score.js'

/** Testes de caixa branca: ramos de score.ts e consulta.ts que os demais testes não alcançam. */
const agora = new Date('2026-10-15T13:00:00Z')
const hoje = diaBrasilia(agora)
const edital = (v: Partial<Edital> = {}): Edital => ({
  id: 'r1',
  objeto: 'Aquisição de notebooks',
  descricao: 'Equipamentos.',
  orgao: 'Órgão',
  uf: 'DF',
  municipio: null,
  modalidade: 'pregao_eletronico',
  segmento: null,
  valorEstimado: 50_000,
  dataPublicacao: '2026-10-14T12:00:00-03:00',
  dataLimite: `${somarDiasUteis(hoje, 10)}T15:00:00-03:00`,
  ...v,
})
const perfil = (v: object = {}) => PerfilEntrada.parse({ termosChave: ['notebook'], ...v })

describe('score.ts: ramos', () => {
  it('termo só com stopwords não identifica nada: ignora e descarta por termo', () => {
    expect(calcularScore(perfil({ termosChave: ['de para'] }), edital(), agora)).toEqual({ descartado: true, motivo: 'termo' })
  })
  it('categoria: descarta quando os dois lados informam e diferem; passa se o edital não informa', () => {
    const p = perfil({ segmentos: ['ti'] })
    expect(calcularScore(p, edital({ segmento: 'saude' }), agora)).toEqual({ descartado: true, motivo: 'categoria' })
    expect(calcularScore(p, edital({ segmento: null }), agora).descartado).toBe(false)
    expect(calcularScore(p, edital({ segmento: 'ti' }), agora).descartado).toBe(false)
  })
  it('prazo: expirado descarta; abaixo do mínimo do perfil descarta; mínimo personalizado vale no lugar do padrão', () => {
    expect(calcularScore(perfil(), edital({ dataLimite: '2026-10-14T10:00:00-03:00' }), agora)).toEqual({ descartado: true, motivo: 'prazo' })
    const em5 = edital({ dataLimite: `${somarDiasUteis(hoje, 5)}T15:00:00-03:00` })
    expect(calcularScore(perfil({ prazoMinimoDiasUteis: 6 }), em5, agora)).toEqual({ descartado: true, motivo: 'prazo' })
    expect(calcularScore(perfil({ prazoMinimoDiasUteis: 5 }), em5, agora).descartado).toBe(false)
  })
  it('pontos de prazo: 10 com 8 dias úteis ou mais, 5 de 4 a 7, 0 abaixo de 4', () => {
    const nota = (d: number) => {
      const r = calcularScore(perfil({ prazoMinimoDiasUteis: 0 }), edital({ dataLimite: `${somarDiasUteis(hoje, d)}T15:00:00-03:00` }), agora)
      return r.descartado ? -1 : r.nota
    }
    // só termo (40) + prazo sobre base 50
    expect([nota(8), nota(7), nota(4), nota(3)]).toEqual([100, 90, 90, 80])
  })
  it('modalidade: primeira vale 10, secundária 5, fora da lista descarta', () => {
    const p = perfil({ modalidades: ['pregao_eletronico', 'concorrencia'] })
    expect(calcularScore(p, edital({ modalidade: 'pregao_eletronico' }), agora)).toMatchObject({ nota: 100 })
    expect(calcularScore(p, edital({ modalidade: 'concorrencia' }), agora)).toMatchObject({ nota: 92 })
    expect(calcularScore(p, edital({ modalidade: 'dispensa' }), agora)).toEqual({ descartado: true, motivo: 'modalidade' })
  })
  it('valor: só máximo ou só mínimo configurado; acima do máximo além de 10% descarta', () => {
    expect(calcularScore(perfil({ valorMaximo: 100_000 }), edital({ valorEstimado: 200_000 }), agora)).toEqual({ descartado: true, motivo: 'valor' })
    expect(calcularScore(perfil({ valorMinimo: 10_000 }), edital({ valorEstimado: 5_000 }), agora)).toEqual({ descartado: true, motivo: 'valor' })
    expect(calcularScore(perfil({ valorMinimo: 10_000 }), edital({ valorEstimado: 20_000 }), agora).descartado).toBe(false)
  })
})

describe('consulta.ts: validação cruzada do feed', () => {
  const erros = (q: Record<string, string>) => {
    const r = ConsultaFeed.safeParse(q)
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  }
  it('valorMin maior que valorMax', () => expect(erros({ valorMin: '10', valorMax: '5' })).toEqual(['valorMax: O máximo deve ser maior ou igual ao mínimo']))
  it('publicadoDe depois de publicadoAte', () => expect(erros({ publicadoDe: '2026-10-10', publicadoAte: '2026-10-01' })).toEqual(['publicadoAte: Data final antes da inicial']))
  it('prazoDe depois de prazoAte', () => expect(erros({ prazoDe: '2026-10-10', prazoAte: '2026-10-01' })).toEqual(['prazoAte: Data final antes da inicial']))
  it('UF repetida em lista com vírgula é normalizada; UF inválida é recusada', () => {
    expect(ConsultaFeed.parse({ uf: 'df,go' }).uf).toEqual(['DF', 'GO'])
    expect(erros({ uf: 'DFX' })).toEqual(['uf.0: UF inválida'])
  })
  it('limites: page 0 e pageSize 101 são recusados; padrão é page 1 e pageSize 20', () => {
    expect(erros({ page: '0' }).length).toBe(1)
    expect(erros({ pageSize: '101' }).length).toBe(1)
    expect(ConsultaFeed.parse({})).toMatchObject({ page: 1, pageSize: 20 })
  })
})
