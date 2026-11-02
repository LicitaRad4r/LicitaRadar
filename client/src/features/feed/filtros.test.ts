import { describe, expect, it } from 'vitest'
import { escreverFiltros, etiquetas, FILTROS_VAZIOS, lerFiltros, paraConsulta } from './filtros'

const ler = (busca: string) => lerFiltros(new URLSearchParams(busca))
// O formato de moeda usa espaço que não quebra linha entre R$ e o número.
const texto = (rotulo: string) => rotulo.replace(/\s/g, ' ')

describe('filtros na URL', () => {
  it('lê todos os filtros e escreve de volta o mesmo link', () => {
    const busca =
      'q=notebook&uf=DF&uf=GO&municipio=Goi%C3%A2nia&modalidade=pregao_eletronico&valorMin=50000&valorMax=1000000&prazo=7&publicado=15&page=2'
    const filtros = ler(busca)

    expect(filtros).toEqual({
      q: 'notebook',
      ufs: ['DF', 'GO'],
      municipio: 'Goiânia',
      modalidade: 'pregao_eletronico',
      valorMin: 50_000,
      valorMax: 1_000_000,
      prazo: 7,
      publicado: 15,
      page: 2,
    })
    expect(escreverFiltros(filtros).toString()).toBe(busca)
  })

  it('sem parâmetros, fica sem filtro nenhum', () => {
    expect(ler('')).toEqual(FILTROS_VAZIOS)
    expect(escreverFiltros(FILTROS_VAZIOS).toString()).toBe('')
  })

  it('aceita estados separados por vírgula, como a API', () => {
    expect(ler('uf=df,GO').ufs).toEqual(['DF', 'GO'])
  })

  it('ignora valores inválidos editados no link, sem quebrar a tela', () => {
    expect(ler('uf=XX&uf=df&modalidade=leilao&valorMin=abc&valorMax=-5&prazo=10&page=-3&q=')).toEqual({
      ...FILTROS_VAZIOS,
      ufs: ['DF'],
    })
  })

  it('troca mínimo e máximo quando vêm invertidos, para a API não responder 400', () => {
    const filtros = ler('valorMin=900&valorMax=100')
    expect([filtros.valorMin, filtros.valorMax]).toEqual([100, 900])
  })
})

describe('consulta para a API', () => {
  it('usa os nomes do contrato e converte as janelas em dias de Brasília', () => {
    const consulta = paraConsulta({ ...FILTROS_VAZIOS, q: 'pc', ufs: ['DF'], prazo: 7, publicado: 3 }, '2026-11-01')

    expect(consulta).toEqual({
      q: 'pc',
      uf: ['DF'],
      prazoDe: '2026-11-01',
      prazoAte: '2026-11-08',
      publicadoDe: '2026-10-29',
      page: 1,
      pageSize: 10,
    })
  })

  it('atravessa a virada do mês e do ano', () => {
    expect(paraConsulta({ ...FILTROS_VAZIOS, prazo: 7 }, '2026-12-28')).toMatchObject({ prazoAte: '2027-01-04' })
  })
})

describe('etiquetas', () => {
  it('cria uma etiqueta por filtro ativo, e cada uma remove só o seu', () => {
    const filtros = ler('q=notebook&uf=DF&uf=GO&municipio=Goiânia&modalidade=dispensa&valorMin=50000&prazo=15&publicado=7')
    const lista = etiquetas(filtros)

    expect(lista.map((e) => texto(e.rotulo))).toEqual([
      '"notebook"',
      'DF',
      'GO',
      'Goiânia',
      'Dispensa',
      'A partir de R$ 50.000',
      'Encerra em até 15 dias',
      'Publicado nos últimos 7 dias',
    ])
    expect(lista.find((e) => e.id === 'uf-DF')!.remover(filtros)).toEqual({ ufs: ['GO'] })
    expect(lista.find((e) => e.id === 'valor')!.remover(filtros)).toEqual({ valorMin: null, valorMax: null })
  })

  it('escreve a faixa de valor sem traço', () => {
    const [valor] = etiquetas(ler('valorMin=50000&valorMax=1000000'))
    expect(texto(valor.rotulo)).toBe('De R$ 50.000 a R$ 1.000.000')
  })
})
