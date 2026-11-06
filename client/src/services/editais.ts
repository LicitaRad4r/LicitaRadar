import type { EditalDetalheDTO } from './dto'
import { api, desembrulhar } from './http'

/** GET /v1/editais/{id}. O id do PNCP pode ter "/"; o cliente HTTP codifica o parâmetro na URL. */
export function obterEdital(editalId: string): Promise<EditalDetalheDTO> {
  return desembrulhar(api.GET('/v1/editais/{editalId}', { params: { path: { editalId } } }))
}
