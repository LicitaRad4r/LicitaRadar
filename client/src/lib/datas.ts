/**
 * O contrato conta prazos e validades em dias de calendário no horário de Brasília.
 * Estas funções fazem a mesma conta no front, para a tela e a API não discordarem perto da meia-noite.
 */
const FUSO = 'America/Sao_Paulo'

const partes = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Dia (yyyy-mm-dd) em Brasília de um instante. */
export function diaEmBrasilia(instante: Date | string): string {
  return partes.format(typeof instante === 'string' ? new Date(instante) : instante)
}

/** Hoje em Brasília (yyyy-mm-dd). */
export function hojeEmBrasilia(agora = new Date()): string {
  return diaEmBrasilia(agora)
}

const DIA_MS = 24 * 60 * 60 * 1000
const meiaNoiteUtc = (dia: string) => Date.parse(`${dia}T00:00:00Z`)

/** Dias de calendário de `de` até `ate` (ambos yyyy-mm-dd). Negativo se `ate` já passou. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((meiaNoiteUtc(ate) - meiaNoiteUtc(de)) / DIA_MS)
}

/** Soma dias a um dia yyyy-mm-dd. */
export function somarDias(dia: string, dias: number): string {
  return new Date(meiaNoiteUtc(dia) + dias * DIA_MS).toISOString().slice(0, 10)
}
