import type { Edital, RegistroScore } from '../dominio/edital.js'

/**
 * Leitura do feed. Os scores são gravados antes (seed no CP2) e a API só lê;
 * editais são globais e scores pertencem a uma empresa.
 */
export interface FeedRepo {
  editais(): Promise<Edital[]>
  scores(empresaId: string): Promise<RegistroScore[]>
}
