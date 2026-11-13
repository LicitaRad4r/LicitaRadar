import { z } from 'zod'
import { UFS } from '@/lib/ufs'
import type { Modalidade, PerfilDTO } from '@/services/dto'

export const MODALIDADES: Modalidade[] = ['pregao_eletronico', 'concorrencia', 'dispensa']
export const TAMANHO_MINIMO_DO_TERMO = 2
export const QUANTIDADE_MAXIMA_DE_TERMOS = 50

const valorEmReais = z.number({ error: 'Informe um número.' }).min(0, 'O valor não pode ser negativo.').nullable()

export const esquemaDoFormularioDePerfil = z
  .object({
    termosChave: z
      .array(z.string())
      .max(QUANTIDADE_MAXIMA_DE_TERMOS, `Use no máximo ${QUANTIDADE_MAXIMA_DE_TERMOS} termos.`),
    ufs: z.array(z.enum(UFS, { error: 'UF inválida.' })),
    modalidades: z.array(z.enum(MODALIDADES)),
    valorMinimo: valorEmReais,
    valorMaximo: valorEmReais,
    prazoMinimoDiasUteis: z
      .number({ error: 'Informe um número.' })
      .int('Use um número inteiro de dias.')
      .min(0, 'O prazo não pode ser negativo.')
      .nullable(),
  })
  .refine((perfil) => perfil.valorMinimo == null || perfil.valorMaximo == null || perfil.valorMaximo >= perfil.valorMinimo, {
    path: ['valorMaximo'],
    message: 'O valor máximo deve ser maior ou igual ao mínimo.',
  })

export type CamposDoFormularioDePerfil = z.infer<typeof esquemaDoFormularioDePerfil>

export function validarNovoTermo(termo: string, termosAtuais: string[]): string | null {
  const termoLimpo = termo.trim()
  if (termoLimpo.length < TAMANHO_MINIMO_DO_TERMO) return `O termo precisa de pelo menos ${TAMANHO_MINIMO_DO_TERMO} caracteres.`
  const jaExiste = termosAtuais.some((atual) => atual.toLocaleLowerCase('pt-BR') === termoLimpo.toLocaleLowerCase('pt-BR'))
  if (jaExiste) return 'Esse termo já está na lista.'
  if (termosAtuais.length >= QUANTIDADE_MAXIMA_DE_TERMOS) return `Use no máximo ${QUANTIDADE_MAXIMA_DE_TERMOS} termos.`
  return null
}

export function camposIniciaisDoPerfil(perfil: PerfilDTO): CamposDoFormularioDePerfil {
  return {
    termosChave: perfil.termosChave ?? [],
    ufs: (perfil.ufs ?? []).filter((uf): uf is (typeof UFS)[number] => (UFS as readonly string[]).includes(uf)),
    modalidades: perfil.modalidades ?? [],
    valorMinimo: perfil.valorMinimo ?? null,
    valorMaximo: perfil.valorMaximo ?? null,
    prazoMinimoDiasUteis: perfil.prazoMinimoDiasUteis ?? null,
  }
}
