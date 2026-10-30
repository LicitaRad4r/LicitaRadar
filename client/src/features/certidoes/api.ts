import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/api/chaves'
import { api, desembrulhar } from '@/api/client'
import type { CertidaoAtualizacao, CertidaoEntrada } from '@/api/tipos'

/** Jornada 4. GET /v1/certidoes. O `status` (valida, vence_em_breve, vencida) vem calculado do back. */
export function useCertidoes() {
  return useQuery({
    queryKey: chaves.certidoes,
    queryFn: () => desembrulhar(api.GET('/v1/certidoes')),
    select: (resposta) => resposta.itens,
  })
}

/** Mudar certidões pode gerar ou resolver alertas de vencimento. */
function useAoMudarCertidoes() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: chaves.certidoes }),
      queryClient.invalidateQueries({ queryKey: chaves.alertas.todos }),
    ])
}

export function useCriarCertidao() {
  const aoMudar = useAoMudarCertidoes()
  return useMutation({
    mutationFn: (certidao: CertidaoEntrada) =>
      desembrulhar(api.POST('/v1/certidoes', { body: certidao })),
    meta: { sucesso: 'Certidão cadastrada.', silenciarErro: true },
    onSuccess: aoMudar,
  })
}

export function useAtualizarCertidao() {
  const aoMudar = useAoMudarCertidoes()
  return useMutation({
    mutationFn: ({ certidaoId, campos }: { certidaoId: string; campos: CertidaoAtualizacao }) =>
      desembrulhar(
        api.PATCH('/v1/certidoes/{certidaoId}', {
          params: { path: { certidaoId } },
          body: campos,
        }),
      ),
    meta: { sucesso: 'Certidão atualizada.', silenciarErro: true },
    onSuccess: aoMudar,
  })
}

export function useRemoverCertidao() {
  const aoMudar = useAoMudarCertidoes()
  return useMutation({
    mutationFn: (certidaoId: string) =>
      desembrulhar(api.DELETE('/v1/certidoes/{certidaoId}', { params: { path: { certidaoId } } })),
    meta: { sucesso: 'Certidão removida.' },
    onSuccess: aoMudar,
  })
}
