import type { Edital, RegistroScore } from '../dominio/edital.js'
import { diaBrasilia, somarDias, somarDiasUteis } from '../dominio/tempo.js'
import type { PerfilDados } from '../perfil/schema.js'
import { PerfilEntrada } from '../perfil/schema.js'
import { calcularScore } from '../score/score.js'

/** Perfil A: TI no DF e GO. Perfil B: só notebook, no RS. Mesmos valor, modalidade e prazo. */
export const PERFIL_A: PerfilDados = PerfilEntrada.parse({
  ufs: ['DF', 'GO'],
  termosChave: ['notebook', 'impressora'],
  modalidades: ['pregao_eletronico'],
  valorMinimo: 50000,
  valorMaximo: 500000,
  prazoMinimoDiasUteis: 3,
})
export const PERFIL_B: PerfilDados = PerfilEntrada.parse({
  ufs: ['RS'],
  termosChave: ['notebook'],
  modalidades: ['pregao_eletronico'],
  valorMinimo: 50000,
  valorMaximo: 500000,
  prazoMinimoDiasUteis: 3,
})

export const EMPRESAS = [
  { id: 'emp-a', nome: 'Empresa A (TI no DF)', perfil: PERFIL_A },
  { id: 'emp-b', nome: 'Empresa B (RS)', perfil: PERFIL_B },
] as const

/**
 * Golden Set (página Score, casos A a F). Os prazos são relativos a `agora`,
 * em dias úteis, para o seed valer em qualquer dia.
 */
export function editaisGolden(agora: Date): Edital[] {
  const hoje = diaBrasilia(agora)
  const limite = (diasUteis: number) => `${somarDiasUteis(hoje, diasUteis)}T15:00:00-03:00`
  const publicado = (n: number) => `${somarDias(hoje, -n)}T08:00:00-03:00`
  const base = { municipio: null, segmento: null, modalidade: 'pregao_eletronico' as const }
  return [
    { ...base, id: 'golden-A', objeto: 'Aquisição de notebooks', descricao: 'Notebooks para a rede de ensino.', orgao: 'Secretaria de Educação do DF', uf: 'DF', valorEstimado: 180000, dataPublicacao: publicado(1), dataLimite: limite(9) },
    { ...base, id: 'golden-B', objeto: 'Contratação de serviços de TI', descricao: 'Inclui fornecimento de notebook para a equipe.', orgao: 'Prefeitura de Goiânia', uf: 'GO', valorEstimado: 520000, dataPublicacao: publicado(2), dataLimite: limite(5) },
    { ...base, id: 'golden-C', objeto: 'Aquisição de notebooks', descricao: 'Notebooks para a rede de ensino.', orgao: 'Secretaria de Educação do RS', uf: 'RS', valorEstimado: 180000, dataPublicacao: publicado(3), dataLimite: limite(9) },
    { ...base, id: 'golden-D', objeto: 'Aquisição de notebooks', descricao: 'Lote grande.', orgao: 'Ministério da Defesa', uf: 'DF', valorEstimado: 700000, dataPublicacao: publicado(4), dataLimite: limite(9) },
    { ...base, id: 'golden-E', objeto: 'Aquisição de notebooks', descricao: 'Compra urgente.', orgao: 'Prefeitura de Brasília', uf: 'DF', valorEstimado: 180000, dataPublicacao: publicado(5), dataLimite: limite(2) },
    { ...base, id: 'golden-F', objeto: 'Serviços de limpeza predial', descricao: 'Limpeza e conservação.', orgao: 'Tribunal Regional', uf: 'DF', valorEstimado: 180000, dataPublicacao: publicado(6), dataLimite: limite(9) },
  ]
}

/** Calcula e devolve o score de cada par empresa × edital (descartados ficam de fora). */
export function scoresGolden(agora: Date, editais: Edital[]): RegistroScore[] {
  const registros: RegistroScore[] = []
  for (const empresa of EMPRESAS) {
    for (const e of editais) {
      const r = calcularScore(empresa.perfil, e, agora)
      if (!r.descartado) registros.push({ empresaId: empresa.id, editalId: e.id, nota: r.nota, faixa: r.faixa })
    }
  }
  return registros
}
