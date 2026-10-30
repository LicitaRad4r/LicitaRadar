import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/api/chaves'
import { api, desembrulhar } from '@/api/client'
import type { Perfil } from '@/api/tipos'

/** Jornada 1. GET /v1/perfil. Se a empresa ainda não configurou, os campos vêm vazios. */
export function usePerfil() {
  return useQuery({
    queryKey: chaves.perfil,
    queryFn: () => desembrulhar(api.GET('/v1/perfil')),
  })
}

/** Perfil sem nenhum filtro preenchido: a tela deve convidar a configurar. */
export function perfilVazio(perfil: Perfil) {
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
 */
export function useSalvarPerfil() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (perfil: Perfil) => desembrulhar(api.PUT('/v1/perfil', { body: perfil })),
    meta: { sucesso: 'Perfil salvo. O feed foi atualizado.', silenciarErro: true },
    onSuccess: (perfil) => {
      queryClient.setQueryData(chaves.perfil, perfil)
      // O ranking depende do perfil.
      return queryClient.invalidateQueries({ queryKey: chaves.feed.todos })
    },
  })
}
