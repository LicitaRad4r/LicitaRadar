import { describe, expect, it } from 'vitest'
import type { Edital, RegistroScore } from '../../src/dominio/edital.js'
import { contemFrase, contemParcial, normalizar, palavraUtil } from '../../src/dominio/normalizar.js'
import { ConsultaFeed } from '../../src/feed/consulta.js'
import { montarFeed } from '../../src/feed/servico.js'
import { PerfilEntrada } from '../../src/perfil/schema.js'
import { calcularScore } from '../../src/score/score.js'

/**
 * Revisão do QA (Kauan) sobre a busca textual: stopwords, falsos positivos por prefixo e plural.
 * O mesmo normalizador alimenta o score (termos-chave) e o filtro `q` do feed.
 */
const agora = new Date('2026-11-03T13:00:00Z')
const edital = (id: string, objeto: string, descricao = ''): Edital => ({
  id,
  objeto,
  descricao,
  orgao: 'Órgão',
  uf: 'DF',
  municipio: null,
  modalidade: 'pregao_eletronico',
  segmento: null,
  valorEstimado: null,
  dataPublicacao: '2026-11-02T12:00:00.000Z',
  dataLimite: '2026-11-20T15:00:00-03:00',
})
const termo = (t: string) => PerfilEntrada.parse({ termosChave: [t] })
const resultado = (t: string, e: Edital) => calcularScore(termo(t), e, agora)

describe('plural e singular caem na mesma forma', () => {
  it.each([
    ['computador', 'computadores'],
    ['licitação', 'licitações'],
    ['material', 'materiais'],
    ['item', 'itens'],
    ['papel', 'papéis'],
    ['notebook', 'notebooks'],
    ['impressora', 'impressoras'],
    ['cidadão', 'cidadãos'],
    ['serviço', 'serviços'],
    ['hospital', 'hospitais'],
    ['vez', 'vezes'],
    ['pão', 'pães'],
  ])('"%s" e "%s"', (singular, plural) => {
    expect(normalizar(plural)).toEqual(normalizar(singular))
  })

  it('computadores × computador agora é frase exata (40 pontos), e licitação × licitações não é mais descartado', () => {
    expect(resultado('computador', edital('a', 'Aquisição de computadores'))).toMatchObject({ descartado: false, nota: 100 })
    expect(resultado('licitação', edital('b', 'Serviços de licitações'))).toMatchObject({ descartado: false, nota: 100 })
    expect(resultado('material', edital('c', 'Compra de materiais'))).toMatchObject({ descartado: false, nota: 100 })
  })
})

describe('stopwords não casam', () => {
  it('"de", "para" e palavras de 1 ou 2 letras não são palavras úteis', () => {
    for (const p of ['de', 'para', 'a', 'e', 'do', 'ao', 'um']) expect(palavraUtil(p), p).toBe(false)
    for (const p of ['material', 'ti', 'obra'].filter((x) => x.length >= 3)) expect(palavraUtil(p), p).toBe(true)
  })

  it('"material de escritório" não casa com um edital de notebooks só por causa do "de"', () => {
    const notebooks = edital('n', 'Aquisição de notebooks')
    expect(contemParcial(normalizar(notebooks.objeto), normalizar('material de escritório'))).toBe(false)
    expect(resultado('material de escritório', notebooks)).toEqual({ descartado: true, motivo: 'termo' })
  })

  it('a frase exata vale 40; as palavras úteis em outra ordem valem 20; nenhuma é descartado', () => {
    const exato = resultado('material de escritório', edital('e', 'Compra de material de escritório'))
    const solto = resultado('material de escritório', edital('s', 'Compra de material para o escritório'))
    expect(exato).toMatchObject({ descartado: false, nota: 100 }) // 40 + 10 prazo, base 50 → 100
    expect(solto).toMatchObject({ descartado: false, nota: 60 }) // 20 + 10, base 50
    expect(resultado('material de escritório', edital('x', 'Contratação de vigilância'))).toEqual({ descartado: true, motivo: 'termo' })
  })

  it('termo-chave só de stopwords não identifica nada (nem frase exata)', () => {
    expect(resultado('de', edital('d', 'Aquisição de notebooks'))).toEqual({ descartado: true, motivo: 'termo' })
    expect(contemFrase(normalizar('Aquisição de notebooks'), normalizar('de'))).toBe(true) // a frase em si existe; quem ignora é o score
  })
})

describe('falsos positivos por prefixo', () => {
  it('"agua" não casa com "aguardar" e "sala" não casa com "salario"', () => {
    expect(contemParcial(normalizar('Aguardar entrega do lote'), normalizar('agua'))).toBe(false)
    expect(contemParcial(normalizar('Pagamento de salario'), normalizar('sala'))).toBe(false)
    expect(resultado('agua', edital('a', 'Aguardar entrega do lote'))).toEqual({ descartado: true, motivo: 'termo' })
    expect(resultado('sala', edital('b', 'Pagamento de salario'))).toEqual({ descartado: true, motivo: 'termo' })
  })

  it('o radical legítimo continua casando (prefixo de 4+ letras que cobre 75% da palavra maior)', () => {
    expect(contemParcial(normalizar('Serviço hospitalar'), normalizar('hospital'))).toBe(true) // 8/10
    expect(contemParcial(normalizar('Equipamento hospitalar'), normalizar('hospital'))).toBe(true)
    expect(contemParcial(normalizar('Água potável'), normalizar('agua'))).toBe(true) // igual
  })
})

describe('filtro q do feed', () => {
  const editais = [edital('esc', 'Compra de material de escritório'), edital('nb', 'Aquisição de notebooks'), edital('ag', 'Aguardar entrega do lote')]
  const scores: RegistroScore[] = editais.map((e) => ({ empresaId: 'emp-a', editalId: e.id, nota: 80, faixa: 'alta' }))
  const repo = { editais: async () => editais, scores: async () => scores }
  const ids = async (q: string) => (await montarFeed(repo, 'emp-a', ConsultaFeed.parse({ q }))).itens.map((i) => i.id).sort()

  it('"material de escritório" acha só o edital certo (o "de" não ajuda ninguém)', async () => {
    expect(await ids('material de escritório')).toEqual(['esc'])
  })
  it('stopword sozinha não restringe a busca', async () => {
    expect(await ids('de')).toEqual(['ag', 'esc', 'nb'])
  })
  it('plural e prefixo: "notebook" e "notebooks" acham o mesmo; "agua" não acha "aguardar"', async () => {
    expect(await ids('notebooks')).toEqual(['nb'])
    expect(await ids('notebook')).toEqual(['nb'])
    expect(await ids('agua')).toEqual([])
  })
})
