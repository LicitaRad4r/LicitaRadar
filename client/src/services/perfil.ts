import type { PerfilDTO } from './dto'
import { api, desembrulhar } from './http'

/** GET /v1/perfil. Antes do primeiro salvamento, os campos vêm vazios e `empresaId` vem nulo. */
export function obterPerfil(): Promise<PerfilDTO> {
  return desembrulhar(api.GET('/v1/perfil'))
}

/**
 * PUT /v1/perfil. `criado` é true no primeiro salvamento (201), quando o back cria a empresa
 * e grava a empresa e o papel no token do usuário.
 */
export async function salvarPerfil(perfil: PerfilDTO): Promise<{ perfil: PerfilDTO; criado: boolean }> {
  const { empresaId: _somenteLeitura, ...corpo } = perfil
  const resposta = await api.PUT('/v1/perfil', { body: corpo })
  const salvo = await desembrulhar(Promise.resolve(resposta))
  return { perfil: salvo, criado: resposta.response.status === 201 }
}
