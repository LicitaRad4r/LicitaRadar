import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/api/chaves'
import { api, desembrulhar } from '@/api/client'
import type { Certidao, CertidaoStatus } from '@/api/tipos'

type ListaCertidoes = { itens: Certidao[] }

/**
 * GET /v1/certidoes. Só para o decisor: o analista recebe 403 ACESSO_NEGADO.
 * Vem da mais urgente para a menos urgente, com `diasRestantes` e `status` calculados no back.
 */
export function useCertidoes() {
  return useQuery({
    queryKey: chaves.certidoes,
    queryFn: () => desembrulhar(api.GET('/v1/certidoes')),
    select: (resposta) => resposta.itens,
  })
}

/** Mesma ordem do back: menos dias restantes primeiro, empate pelo nome. */
export function ordenarPorUrgencia(certidoes: Certidao[]) {
  return [...certidoes].sort((a, b) => a.diasRestantes - b.diasRestantes || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Certidões que pedem ação: vencidas, urgentes ou em atenção. */
export const EM_ALERTA: CertidaoStatus[] = ['vencida', 'urgente', 'atencao']

export type DadosRenovacao = { certidaoId: string; arquivo: File; validade: string }

/**
 * PUT /v1/certidoes/{id}/renovacao, com o arquivo novo e a nova validade (multipart).
 * Ao gravar, a certidão renovada substitui a antiga na lista na mesma hora, já reordenada,
 * e a lista é confirmada com o back em seguida.
 */
export function useRenovarCertidao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ certidaoId, arquivo, validade }: DadosRenovacao) =>
      desembrulhar(
        api.PUT('/v1/certidoes/{certidaoId}/renovacao', {
          params: { path: { certidaoId } },
          // O contrato descreve o arquivo como binário; no navegador ele é um File dentro de um FormData.
          body: { arquivo: arquivo as unknown as string, validade },
          bodySerializer: (corpo) => {
            const dados = new FormData()
            dados.append('arquivo', corpo.arquivo as unknown as Blob)
            dados.append('validade', corpo.validade)
            return dados
          },
        }),
      ),
    meta: { sucesso: 'Certidão renovada.', silenciarErro: true },
    onSuccess: (renovada) => {
      queryClient.setQueryData<ListaCertidoes>(chaves.certidoes, (lista) =>
        lista && { itens: ordenarPorUrgencia(lista.itens.map((c) => (c.id === renovada.id ? renovada : c))) },
      )
      // Confirma com o back em segundo plano, sem segurar o formulário aberto até a lista voltar.
      void queryClient.invalidateQueries({ queryKey: chaves.certidoes })
    },
  })
}
