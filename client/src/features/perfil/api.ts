import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/lib/chaves'
import { renovarTokenAgora } from '@/services/http'
import { obterPerfil, salvarPerfil } from '@/services/perfil'
import type { PerfilDTO } from '@/services/dto'

/** GET /v1/perfil. Antes do primeiro salvamento, os campos vêm vazios e `empresaId` vem nulo. */
export function usePerfil() {
  return useQuery({
    queryKey: chaves.perfil,
    queryFn: obterPerfil,
  })
}

/** Perfil sem nenhum filtro preenchido: a tela deve convidar a configurar. */
export function perfilVazio(perfil: PerfilDTO) {
  return (
    !perfil.termosChave?.length &&
    !perfil.ufs?.length &&
    !perfil.segmentos?.length &&
    !perfil.modalidades?.length &&
    perfil.valorMinimo == null &&
    perfil.valorMaximo == null
  )
}

/**
 * PUT /v1/perfil. O erro de validação não gera aviso global:
 * o formulário mostra nos campos com `errosPorCampo(error)`.
 *
 * No primeiro salvamento a API responde 201 e grava a empresa e o papel no token.
 * Por isso o token é renovado antes de recarregar o resto da tela.
 */
export function useSalvarPerfil() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (perfil: PerfilDTO) => {
      const { perfil: salvo, criado } = await salvarPerfil(perfil)
      if (criado) await renovarTokenAgora()
      return salvo
    },
    meta: { sucesso: 'Perfil salvo. O feed foi atualizado.', silenciarErro: true },
    onSuccess: (perfil) => {
      queryClient.setQueryData(chaves.perfil, perfil)
      // O ranking depende do perfil, e as outras rotas dependem da empresa no token.
      return queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'perfil' })
    },
  })
}
