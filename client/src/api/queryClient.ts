import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, mensagemAmigavel } from './erros'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
    mutationMeta: {
      /** Mensagem do aviso de sucesso. */
      sucesso?: string
      /** Não mostra o aviso de erro global (a tela trata o erro sozinha, por exemplo num formulário). */
      silenciarErro?: boolean
    }
  }
}

export function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Não repete erros 4xx (dado inválido, sem login, não encontrado): repetir não muda nada.
        retry: (tentativas, erro) => !(erro instanceof ApiError && erro.ehDoCliente) && tentativas < 2,
      },
      mutations: { retry: false },
    },
    // Avisos padrão das ações (salvar, excluir, marcar). Cada tela não precisa repetir isso.
    mutationCache: new MutationCache({
      onSuccess: (_dados, _variaveis, _contexto, mutation) => {
        const mensagem = mutation.meta?.sucesso
        if (mensagem) toast.success(mensagem)
      },
      onError: (erro, _variaveis, _contexto, mutation) => {
        if (!mutation.meta?.silenciarErro) toast.error(mensagemAmigavel(erro))
      },
    }),
  })
}
