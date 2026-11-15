import type { AcompanhamentoDTO, AcompanhamentoPaginaDTO, Etapa, ResultadoAcompanhamento } from './dto'
import { api, desembrulhar } from './http'

export function listarAcompanhamentosDaEtapa(etapa: Etapa, page: number, pageSize: number): Promise<AcompanhamentoPaginaDTO> {
  return desembrulhar(api.GET('/v1/acompanhamentos', { params: { query: { etapa, page, pageSize } } }))
}

export function acompanharEdital(editalId: string): Promise<AcompanhamentoDTO> {
  return desembrulhar(api.POST('/v1/acompanhamentos', { body: { editalId } }))
}

export type MudancaDeEtapaDTO = { acompanhamentoId: string; etapa: Etapa; resultado?: ResultadoAcompanhamento }

export function mudarEtapaDoAcompanhamento({ acompanhamentoId, etapa, resultado }: MudancaDeEtapaDTO): Promise<AcompanhamentoDTO> {
  return desembrulhar(
    api.PATCH('/v1/acompanhamentos/{acompanhamentoId}', {
      params: { path: { acompanhamentoId } },
      body: resultado ? { etapa, resultado } : { etapa },
    }),
  )
}

export async function deixarDeAcompanhar(acompanhamentoId: string): Promise<void> {
  await desembrulhar(api.DELETE('/v1/acompanhamentos/{acompanhamentoId}', { params: { path: { acompanhamentoId } } }))
}
