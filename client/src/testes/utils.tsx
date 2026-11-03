import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import { criarQueryClient } from '@/api/queryClient'

/** QueryClient igual ao da aplicação, mas sem repetir chamadas que falham (deixa os testes rápidos). */
export function criarQueryClientDeTeste() {
  const queryClient = criarQueryClient()
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } })
  return queryClient
}

function envoltorio(queryClient = criarQueryClientDeTeste()) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

export function renderizar(ui: ReactNode) {
  const { queryClient, wrapper } = envoltorio()
  return { queryClient, ...render(ui, { wrapper }) }
}

export function renderizarHook<T>(hook: () => T) {
  const { queryClient, wrapper } = envoltorio()
  return { queryClient, ...renderHook(hook, { wrapper }) }
}
