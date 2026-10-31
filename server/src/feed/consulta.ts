import { z } from 'zod'

/** Jornada 1: só paginação. Os filtros entram na Jornada 2. */
export const ConsultaFeed = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type Consulta = z.infer<typeof ConsultaFeed>
