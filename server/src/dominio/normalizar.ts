const radical = (p: string) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p)

/**
 * Normalizador único (score e filtro de palavra-chave): sem acentos, sem maiúsculas,
 * plural simples removido ("Notébook" e "notebooks" viram "notebook").
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

/** Alguma palavra do termo aparece, igual ou como radical (prefixo de 4+ letras). */
export function contemParcial(texto: string[], termo: string[]): boolean {
  return termo.some((p) => texto.some((t) => t === p || (Math.min(t.length, p.length) >= 4 && (t.startsWith(p) || p.startsWith(t)))))
}
