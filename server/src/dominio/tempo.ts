const FUSO = 'America/Sao_Paulo'
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

export type Relogio = () => Date

/** Dia do calendário no horário de Brasília, como `AAAA-MM-DD`. */
export const diaBrasilia = (d: Date): string => formato.format(d)

const utc = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number)
  return Date.UTC(a!, m! - 1, d!)
}
const DIA = 86_400_000

/** Dias de calendário de `de` até `ate` (negativo se `ate` já passou). */
export const diasCorridos = (de: string, ate: string): number => Math.round((utc(ate) - utc(de)) / DIA)

/** Quantos dias úteis (seg a sex) existem depois de `de`, até `ate` inclusive. Feriados não entram. */
export function diasUteisEntre(de: string, ate: string): number {
  let n = 0
  for (let t = utc(de) + DIA; t <= utc(ate); t += DIA) {
    const sem = new Date(t).getUTCDay()
    if (sem !== 0 && sem !== 6) n++
  }
  return n
}

/** Dia que fica `n` dias úteis depois de `dia`. */
export function somarDiasUteis(dia: string, n: number): string {
  let t = utc(dia)
  let falta = n
  while (falta > 0) {
    t += DIA
    const sem = new Date(t).getUTCDay()
    if (sem !== 0 && sem !== 6) falta--
  }
  return new Date(t).toISOString().slice(0, 10)
}

export const somarDias = (dia: string, n: number): string => new Date(utc(dia) + n * DIA).toISOString().slice(0, 10)
