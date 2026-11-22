/** US02: sem atividade por 4 horas, a sessão termina. */
export const LIMITE_DE_INATIVIDADE_MS = 4 * 60 * 60 * 1000

// No localStorage para valer entre abas e depois de recarregar a página.
const CHAVE_DA_ULTIMA_ATIVIDADE = 'licitaradar:ultima-atividade'

// Usada só quando o navegador bloqueia o localStorage (aba anônima, dados do site bloqueados).
let ultimaAtividadeSemArmazenamento: number | null = null

export function registrarAtividade(agora = Date.now()) {
  ultimaAtividadeSemArmazenamento = agora
  try {
    localStorage.setItem(CHAVE_DA_ULTIMA_ATIVIDADE, String(agora))
  } catch {
    // Sem localStorage, a atividade vale só para esta aba.
  }
}

function lerUltimaAtividade(): number | null {
  try {
    const gravada = Number(localStorage.getItem(CHAVE_DA_ULTIMA_ATIVIDADE))
    return gravada > 0 ? gravada : null
  } catch {
    return ultimaAtividadeSemArmazenamento
  }
}

export function passouDoLimiteDeInatividade(agora = Date.now()) {
  const ultimaAtividade = lerUltimaAtividade()
  return ultimaAtividade !== null && agora - ultimaAtividade >= LIMITE_DE_INATIVIDADE_MS
}
