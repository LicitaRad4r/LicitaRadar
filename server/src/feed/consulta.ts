import { z } from 'zod'

const lista = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(',')).map((s) => s.trim().toUpperCase()))
  .pipe(z.array(z.string().regex(/^[A-Z]{2}$/, 'UF inválida')))

const valor = z.coerce.number({ error: 'Valor inválido' }).min(0, 'Valor não pode ser negativo')
const dia = z.iso.date('Data inválida (use AAAA-MM-DD)')

export const ConsultaFeed = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().min(1, 'Palavra-chave vazia').optional(),
    uf: lista.optional(),
    municipio: z.string().trim().min(1).optional(),
    modalidade: z.enum(['pregao_eletronico', 'concorrencia', 'dispensa']).optional(),
    publicadoDe: dia.optional(),
    publicadoAte: dia.optional(),
    prazoDe: dia.optional(),
    prazoAte: dia.optional(),
    valorMin: valor.optional(),
    valorMax: valor.optional(),
  })
  .superRefine((c, ctx) => {
    const erro = (campo: string, mensagem: string) => ctx.addIssue({ code: 'custom', path: [campo], message: mensagem })
    if (c.valorMin !== undefined && c.valorMax !== undefined && c.valorMin > c.valorMax) erro('valorMax', 'O máximo deve ser maior ou igual ao mínimo')
    if (c.publicadoDe && c.publicadoAte && c.publicadoDe > c.publicadoAte) erro('publicadoAte', 'Data final antes da inicial')
    if (c.prazoDe && c.prazoAte && c.prazoDe > c.prazoAte) erro('prazoAte', 'Data final antes da inicial')
  })

export type Consulta = z.infer<typeof ConsultaFeed>
