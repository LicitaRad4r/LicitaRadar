import { z } from 'zod'

export const SEGMENTOS = ['saude', 'educacao', 'ti', 'construcao_civil', 'servicos_gerais'] as const
export const MODALIDADES = ['pregao_eletronico', 'concorrencia', 'dispensa'] as const

const unicos = <T>(l: T[]) => new Set(l).size === l.length

export const PerfilEntrada = z
  .object({
    ufs: z.array(z.string().regex(/^[A-Z]{2}$/, 'UF inválida')).refine(unicos, 'UFs repetidas').default([]),
    termosChave: z.array(z.string().trim().min(2, 'Mínimo de 2 caracteres')).max(50).default([]),
    segmentos: z.array(z.enum(SEGMENTOS)).refine(unicos, 'Segmentos repetidos').default([]),
    modalidades: z.array(z.enum(MODALIDADES)).refine(unicos, 'Modalidades repetidas').default([]),
    valorMinimo: z.number().min(0).nullable().default(null),
    valorMaximo: z.number().min(0).nullable().default(null),
    prazoMinimoDiasUteis: z.number().int().min(0).nullable().default(null),
  })
  .refine((p) => p.valorMinimo === null || p.valorMaximo === null || p.valorMinimo <= p.valorMaximo, {
    path: ['valorMaximo'],
    message: 'O valor máximo deve ser maior ou igual ao mínimo',
  })

export type PerfilDados = z.infer<typeof PerfilEntrada>
export type Perfil = PerfilDados & { empresaId: string | null }

export const perfilVazio = (): PerfilDados => PerfilEntrada.parse({})

export type Segmento = (typeof SEGMENTOS)[number]
export type Modalidade = (typeof MODALIDADES)[number]
