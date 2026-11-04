import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/lib/chaves'
import { listarCertidoes, renovarCertidao, type RenovacaoDTO } from '@/services/certidoes'
import type { CertidaoDTO, CertidaoStatus } from '@/services/dto'

/**
 * GET /v1/certidoes. Só para o decisor: o analista recebe 403 ACESSO_NEGADO.
 * Vem da mais urgente para a menos urgente, com `diasRestantes` e `status` calculados no back.
 */
export function useCertidoes() {
  return useQuery({
    queryKey: chaves.certidoes,
    queryFn: listarCertidoes,
  })
}

/** Mesma ordem do back: menos dias restantes primeiro, empate pelo nome. */
export function ordenarPorUrgencia(certidoes: CertidaoDTO[]) {
  return [...certidoes].sort((a, b) => a.diasRestantes - b.diasRestantes || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Certidões que pedem ação: vencidas, urgentes ou em atenção. */
export const EM_ALERTA: CertidaoStatus[] = ['vencida', 'urgente', 'atencao']

/**
 * PUT /v1/certidoes/{id}/renovacao, com o arquivo novo e a nova validade (multipart).
 * Ao gravar, a certidão renovada substitui a antiga na lista na mesma hora, já reordenada,
 * e a lista é confirmada com o back em seguida.
 */
export function useRenovarCertidao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dados: RenovacaoDTO) => renovarCertidao(dados),
    meta: { sucesso: 'Certidão renovada.', silenciarErro: true },
    onSuccess: (renovada) => {
      queryClient.setQueryData<CertidaoDTO[]>(chaves.certidoes, (lista) =>
        lista && ordenarPorUrgencia(lista.map((c) => (c.id === renovada.id ? renovada : c))),
      )
      // Confirma com o back em segundo plano, sem segurar o formulário aberto até a lista voltar.
      void queryClient.invalidateQueries({ queryKey: chaves.certidoes })
    },
  })
}
