import { Bell } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { API_MOCK } from '@/api/config'
import { useSaudeApi } from '@/api/saude'
import { useContagemAlertasNaoLidos } from '@/features/alertas/api'
import { cn } from '@/lib/utils'

function StatusApi() {
  const saude = useSaudeApi()
  const texto = saude.isPending
    ? 'Verificando a API'
    : saude.isError
      ? 'API fora do ar'
      : API_MOCK
        ? 'API simulada (mock)'
        : 'API no ar'
  return (
    <p role="status" className="hidden items-center gap-2 text-xs text-white/70 sm:flex">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full',
          saude.isError ? 'bg-red-400' : saude.isPending ? 'bg-white/40' : 'bg-emerald-400',
        )}
      />
      {texto}
    </p>
  )
}

function SinoDeAlertas() {
  const { data: naoLidos = 0 } = useContagemAlertasNaoLidos()
  const rotulo = naoLidos > 0 ? `Alertas, ${naoLidos} não lidos` : 'Alertas'
  return (
    <span className="relative inline-flex size-9 items-center justify-center rounded-lg text-white/90" aria-label={rotulo} role="img">
      <Bell aria-hidden className="size-5" />
      {naoLidos > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-radar px-1 text-center text-xs leading-5 font-semibold text-white tabular-nums">
          {naoLidos}
        </span>
      )}
    </span>
  )
}

export function Layout() {
  return (
    <div className="min-h-svh bg-background">
      <header className="bg-tinta text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-white/50">
            LicitaRadar
          </Link>
          <div className="flex items-center gap-4">
            <StatusApi />
            <SinoDeAlertas />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function PaginaNaoEncontrada() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link to="/" className="text-radar underline underline-offset-4">
        Voltar para os editais
      </Link>
    </div>
  )
}
