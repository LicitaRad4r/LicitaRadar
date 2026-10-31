import type { Edital, Faixa } from '../dominio/edital.js'
import { contemFrase, contemParcial, normalizar } from '../dominio/normalizar.js'
import { diaBrasilia, diasUteisEntre } from '../dominio/tempo.js'
import type { PerfilDados } from '../perfil/schema.js'

export type MotivoDescarte = 'termo' | 'categoria' | 'prazo' | 'modalidade' | 'valor'
export type ResultadoScore = { descartado: true; motivo: MotivoDescarte } | { descartado: false; nota: number; faixa: Faixa }

export const faixaDaNota = (nota: number): Faixa => (nota >= 80 ? 'alta' : nota >= 50 ? 'media' : 'baixa')

const TOLERANCIA_VALOR = 0.1
const PRAZO_MINIMO_PADRAO = 3

/**
 * Score de Aderência (ADR-0008 e página Score): funil eliminatório, pesos e reescala.
 * Função pura: o `agora` entra por parâmetro.
 */
export function calcularScore(perfil: PerfilDados, edital: Edital, agora: Date): ResultadoScore {
  const descarta = (motivo: MotivoDescarte): ResultadoScore => ({ descartado: true, motivo })

  // Termos-chave (obrigatório): frase no objeto = 40; frase só na descrição ou palavras/radical = 20.
  const objeto = normalizar(edital.objeto)
  const descricao = normalizar(edital.descricao)
  let pontosTermo = 0
  for (const termo of perfil.termosChave) {
    const t = normalizar(termo)
    if (contemFrase(objeto, t)) pontosTermo = Math.max(pontosTermo, 40)
    else if (contemFrase(descricao, t) || contemParcial(objeto, t) || contemParcial(descricao, t)) pontosTermo = Math.max(pontosTermo, 20)
  }
  if (pontosTermo === 0) return descarta('termo')

  // Categoria (PNCP): só descarta quando os dois lados informam.
  if (perfil.segmentos.length > 0 && edital.segmento && !perfil.segmentos.includes(edital.segmento)) return descarta('categoria')

  // Prazo (obrigatório): expirado ou abaixo do mínimo descarta.
  if (new Date(edital.dataLimite).getTime() < agora.getTime()) return descarta('prazo')
  const dias = diasUteisEntre(diaBrasilia(agora), diaBrasilia(new Date(edital.dataLimite)))
  if (dias < (perfil.prazoMinimoDiasUteis ?? PRAZO_MINIMO_PADRAO)) return descarta('prazo')
  const pontosPrazo = dias >= 8 ? 10 : dias >= 4 ? 5 : 0

  let obtidos = pontosTermo + pontosPrazo
  let base = 50

  // Modalidade (opcional): a primeira da lista é a prioritária.
  if (perfil.modalidades.length > 0) {
    const i = perfil.modalidades.indexOf(edital.modalidade)
    if (i < 0) return descarta('modalidade')
    obtidos += i === 0 ? 10 : 5
    base += 10
  }

  // Valor (opcional): mais de 10% fora da faixa descarta; edital sem valor pontua 0.
  const { valorMinimo: min, valorMaximo: max } = perfil
  if (min !== null || max !== null) {
    base += 15
    const v = edital.valorEstimado
    if (v !== null) {
      const fora = min !== null && v < min ? (min - v) / min : max !== null && v > max ? (v - max) / max : 0
      if (fora === 0) obtidos += 15
      else if (fora <= TOLERANCIA_VALOR + 1e-9) obtidos += 5
      else return descarta('valor')
    }
  }

  // Localidade (opcional).
  if (perfil.ufs.length > 0) {
    base += 25
    if (perfil.ufs.includes(edital.uf)) obtidos += 25
  }

  const nota = Math.round((100 * obtidos) / base)
  return { descartado: false, nota, faixa: faixaDaNota(nota) }
}
