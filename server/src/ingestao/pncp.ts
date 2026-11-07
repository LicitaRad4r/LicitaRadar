import { z } from 'zod'
import type { Edital } from '../dominio/edital.js'
import type { Modalidade } from '../perfil/schema.js'

/**
 * Adapter do PNCP: converte uma contratação da API de consulta (`/v1/contratacoes/proposta`)
 * no `Edital` do domínio. Campos conforme o Manual das APIs de Consultas do PNCP.
 */
const textoOpcional = z.string().nullish()

export const ContratacaoPncpSchema = z.object({
  numeroControlePNCP: z.string().min(1),
  objetoCompra: textoOpcional,
  informacaoComplementar: textoOpcional,
  modalidadeId: z.number(),
  valorTotalEstimado: z.number().nullish(),
  dataPublicacaoPncp: textoOpcional,
  dataEncerramentoProposta: textoOpcional,
  // A API real devolve `razaoSocial`; o manual escreve `razaosocial`. Aceita os dois.
  orgaoEntidade: z.object({ razaoSocial: textoOpcional, razaosocial: textoOpcional }).nullish(),
  unidadeOrgao: z
    .object({
      nomeUnidade: textoOpcional,
      municipioNome: textoOpcional,
      ufSigla: textoOpcional,
    })
    .nullish(),
})

export type ContratacaoPncp = z.infer<typeof ContratacaoPncpSchema>

/**
 * Modalidades do PNCP que o perfil sabe filtrar. As demais (leilão, concurso, pregão presencial,
 * inexigibilidade…) ficam de fora: o perfil só tem pregão eletrônico, concorrência e dispensa.
 */
export const MODALIDADES_PNCP: Readonly<Record<number, Modalidade>> = {
  6: 'pregao_eletronico',
  4: 'concorrencia',
  5: 'concorrencia',
  8: 'dispensa',
}

export const CODIGOS_MODALIDADE_PADRAO = Object.keys(MODALIDADES_PNCP).map(Number)

export type MotivoIgnorado = 'invalida' | 'modalidade' | 'sem_prazo' | 'sem_uf' | 'encerrada'

export type ResultadoNormalizacao = { edital: Edital } | { ignorada: MotivoIgnorado }

/** O PNCP devolve data e hora sem fuso (horário de Brasília, UTC-03:00, sem horário de verão). */
export function dataComFuso(valor: string | null | undefined): string | null {
  if (!valor) return null
  const texto = valor.trim()
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(texto) ? texto : `${texto.length === 10 ? `${texto}T00:00:00` : texto}-03:00`
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? null : t.toISOString()
}

/** O id do edital vira id de documento no Firestore e parâmetro de rota: sem `/` nem caracteres especiais. */
export const idDoEdital = (numeroControlePNCP: string): string => numeroControlePNCP.trim().replace(/[^A-Za-z0-9_-]+/g, '-')

const limpar = (texto: string | null | undefined): string => (texto ?? '').replace(/\s+/g, ' ').trim()

/**
 * Normaliza uma contratação. Devolve `ignorada` (com o motivo) quando não dá para pontuar:
 * sem prazo, sem UF, modalidade fora do perfil ou proposta já encerrada.
 */
export function normalizarContratacao(bruta: unknown, agora: Date): ResultadoNormalizacao {
  const lida = ContratacaoPncpSchema.safeParse(bruta)
  if (!lida.success) return { ignorada: 'invalida' }
  const c = lida.data

  const modalidade = MODALIDADES_PNCP[c.modalidadeId]
  if (!modalidade) return { ignorada: 'modalidade' }

  const dataLimite = dataComFuso(c.dataEncerramentoProposta)
  if (!dataLimite) return { ignorada: 'sem_prazo' }
  if (new Date(dataLimite).getTime() < agora.getTime()) return { ignorada: 'encerrada' }

  const uf = (c.unidadeOrgao?.ufSigla ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(uf)) return { ignorada: 'sem_uf' }

  const objeto = limpar(c.objetoCompra)
  if (!objeto) return { ignorada: 'invalida' }

  const valor = c.valorTotalEstimado
  return {
    edital: {
      id: idDoEdital(c.numeroControlePNCP),
      objeto,
      descricao: limpar(c.informacaoComplementar),
      orgao: limpar(c.orgaoEntidade?.razaoSocial) || limpar(c.orgaoEntidade?.razaosocial) || limpar(c.unidadeOrgao?.nomeUnidade) || 'Órgão não informado',
      uf,
      municipio: limpar(c.unidadeOrgao?.municipioNome) || null,
      modalidade,
      // A API de consulta não traz o segmento (saúde, TI…): o score só descarta por segmento quando os dois lados informam.
      segmento: null,
      // Valor 0 ou ausente = orçamento sigiloso ou não informado: fica `null` (o score trata como "sem valor").
      valorEstimado: typeof valor === 'number' && valor > 0 ? valor : null,
      dataPublicacao: dataComFuso(c.dataPublicacaoPncp) ?? agora.toISOString(),
      dataLimite,
    },
  }
}
