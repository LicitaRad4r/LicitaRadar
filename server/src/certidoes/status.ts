import { diaBrasilia, diasCorridos } from '../dominio/tempo.js'

export type CertidaoStatus = 'vencida' | 'urgente' | 'atencao' | 'em_dia'

export interface Classificacao {
  diasRestantes: number
  status: CertidaoStatus
}

/**
 * Classificação da certidão (página de Certidões, RF09), em dias de calendário de Brasília:
 * < 0 vencida · 0 a 15 urgente · 16 a 30 atenção · 31 ou mais em dia (sem alerta).
 * Calculada na hora da consulta: nada de status gravado, então a virada do dia é sempre refletida.
 */
export function classificar(validade: string, agora: Date): Classificacao {
  const diasRestantes = diasCorridos(diaBrasilia(agora), validade)
  const status: CertidaoStatus =
    diasRestantes < 0 ? 'vencida' : diasRestantes <= 15 ? 'urgente' : diasRestantes <= 30 ? 'atencao' : 'em_dia'
  return { diasRestantes, status }
}
