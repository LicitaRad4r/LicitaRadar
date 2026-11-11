/** Palavras sem valor de busca: "de" ou "para" não podem fazer um edital casar com um termo-chave. */
const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'para', 'pra', 'com', 'sem', 'ao', 'aos', 'e', 'ou', 'que', 'se', 'ate', 'sob', 'sobre', 'entre',
])

/** Palavra que vale como evidência de busca: não é stopword e tem 3+ letras. */
export const palavraUtil = (p: string): boolean => p.length >= 3 && !STOPWORDS.has(p)

/**
 * Singular simples do português. Os dois lados da comparação passam pela mesma regra, então basta
 * que singular e plural caiam na mesma forma: computadores/computador, licitações/licitação,
 * materiais/material, itens/item, notebooks/notebook.
 */
function radical(p: string): string {
  if (p.length <= 3) return p
  if (p.endsWith('oes') || p.endsWith('aes')) return `${p.slice(0, -3)}ao` // licitações → licitacao, pães → pao
  if (p.endsWith('aos')) return p.slice(0, -1) // cidadãos → cidadao
  if (p.endsWith('ais')) return `${p.slice(0, -3)}al` // materiais → material
  if (p.endsWith('eis')) return `${p.slice(0, -3)}el` // papéis → papel
  if (p.endsWith('ois')) return `${p.slice(0, -3)}ol` // lençóis → lencol
  if (p.endsWith('res') || p.endsWith('zes')) return p.slice(0, -2) // computadores → computador, vezes → vez
  if (p.endsWith('ns')) return `${p.slice(0, -2)}m` // itens → item
  if (p.endsWith('s')) return p.slice(0, -1) // notebooks → notebook
  return p
}

/**
 * Normalizador único (score e filtro de palavra-chave): sem acentos, sem maiúsculas,
 * plural trocado pelo singular ("Notébook" e "notebooks" viram "notebook").
 */
export function normalizar(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(radical)
}

/** A sequência `termo` aparece inteira e em ordem dentro de `texto`. */
export function contemFrase(texto: string[], termo: string[]): boolean {
  if (termo.length === 0) return false
  for (let i = 0; i + termo.length <= texto.length; i++) {
    if (termo.every((p, j) => texto[i + j] === p)) return true
  }
  return false
}

/** Os dois tokens são a mesma palavra, ou um é o radical do outro (prefixo de 4+ letras que cobre 75% da maior). */
const mesmaPalavra = (t: string, p: string): boolean => {
  if (t === p) return true
  const [curta, longa] = t.length <= p.length ? [t, p] : [p, t]
  return curta.length >= 4 && longa.startsWith(curta) && curta.length / longa.length >= 0.75
}

/**
 * Alguma palavra do termo (ignorando stopwords e palavras de 1 ou 2 letras) aparece no texto,
 * igual ou como radical: "hospital" casa com "hospitalar", mas "agua" não casa com "aguardar".
 */
export function contemParcial(texto: string[], termo: string[]): boolean {
  return termo.filter(palavraUtil).some((p) => texto.some((t) => mesmaPalavra(t, p)))
}
