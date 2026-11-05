import type { Edital, RegistroScore } from '../dominio/edital.js'
import type { PerfilDados } from '../perfil/schema.js'
import { PerfilEntrada } from '../perfil/schema.js'
import { calcularScore } from '../score/score.js'
import type { FontePncp } from './cliente-pncp.js'
import { normalizarContratacao, type MotivoIgnorado } from './pncp.js'

export interface EmpresaComPerfil {
  id: string
  perfil: PerfilDados
}

/** Escrita e leitura da ingestão. Implementação real em `infra/firestore-ingestao.ts`. */
export interface IngestaoRepo {
  empresas(): Promise<EmpresaComPerfil[]>
  gravarEditais(editais: Edital[]): Promise<void>
  gravarScores(scores: RegistroScore[]): Promise<void>
  /** Remove o score de pares que agora são descartados (o edital mudou, por exemplo). */
  removerScores(pares: Array<{ empresaId: string; editalId: string }>): Promise<void>
}

export interface ResultadoIngestao {
  /** Contratações devolvidas pela fonte. */
  recebidas: number
  /** Editais gravados (sem repetidos). */
  editaisGravados: number
  ignoradas: Record<MotivoIgnorado, number>
  /** Modalidades que falharam no PNCP (a ingestão segue com as demais). */
  falhasPncp: string[]
  empresas: number
  scoresGravados: number
  scoresRemovidos: number
}

export interface DependenciasIngestao {
  fonte: FontePncp
  repo: IngestaoRepo
  agora?: () => Date
}

/**
 * Busca no PNCP, grava os editais (globais) e recalcula o score de cada empresa para o lote.
 * Idempotente: o id do edital vem do número de controle do PNCP e o do score é `empresa_edital`.
 */
export async function executarIngestao(deps: DependenciasIngestao): Promise<ResultadoIngestao> {
  const agora = (deps.agora ?? (() => new Date()))()
  const { contratacoes, falhas } = await deps.fonte(agora)

  const ignoradas: Record<MotivoIgnorado, number> = { invalida: 0, modalidade: 0, sem_prazo: 0, sem_uf: 0, encerrada: 0 }
  const porId = new Map<string, Edital>()
  for (const bruta of contratacoes) {
    const r = normalizarContratacao(bruta, agora)
    if ('ignorada' in r) ignoradas[r.ignorada]++
    else porId.set(r.edital.id, r.edital)
  }
  const editais = [...porId.values()]
  await deps.repo.gravarEditais(editais)

  const empresas = (await deps.repo.empresas()).filter((e) => PerfilEntrada.safeParse(e.perfil).success)
  const scores: RegistroScore[] = []
  const descartados: Array<{ empresaId: string; editalId: string }> = []
  for (const empresa of empresas) {
    for (const edital of editais) {
      const r = calcularScore(empresa.perfil, edital, agora)
      if (r.descartado) descartados.push({ empresaId: empresa.id, editalId: edital.id })
      else scores.push({ empresaId: empresa.id, editalId: edital.id, nota: r.nota, faixa: r.faixa })
    }
  }
  await deps.repo.gravarScores(scores)
  await deps.repo.removerScores(descartados)

  return {
    recebidas: contratacoes.length,
    editaisGravados: editais.length,
    ignoradas,
    falhasPncp: falhas,
    empresas: empresas.length,
    scoresGravados: scores.length,
    scoresRemovidos: descartados.length,
  }
}
