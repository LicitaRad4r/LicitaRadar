import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { criarQueryClient } from '@/api/queryClient'
import { Toaster } from '@/components/ui/sonner'

/** Tudo que a aplicação inteira precisa em volta: cache da API e avisos (toasts). */
export function Provedores({ children }: { children: ReactNode }) {
  const [queryClient] = useState(criarQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
