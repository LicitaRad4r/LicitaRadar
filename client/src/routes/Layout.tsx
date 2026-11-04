import { Link, NavLink, Outlet } from 'react-router'
import { API_MOCK } from '@/services/config'
import { useQuery } from '@tanstack/react-query'
import { chaves } from '@/lib/chaves'
import { obterSaude } from '@/services/saude'
import { cn } from '@/lib/utils'

function StatusApi() {
  const saude = useQuery({ queryKey: chaves.saude, queryFn: obterSaude, refetchInterval: 60_000, retry: false })
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

function ItemDoMenu({ para, children }: { para: string; children: string }) {
  return (
    <NavLink
      to={para}
      end
      className={({ isActive }) =>
        cn(
          'rounded-md px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/50',
          isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:text-white',
        )
      }
    >
      {children}
    </NavLink>
  )
}

export function Layout() {
  return (
    <div className="min-h-svh bg-background">
      <header className="bg-tinta text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-white/50"
            >
              LicitaRadar
            </Link>
            <nav aria-label="Principal" className="flex items-center gap-1">
              <ItemDoMenu para="/">Editais</ItemDoMenu>
              <ItemDoMenu para="/certidoes">Certidões</ItemDoMenu>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <StatusApi />
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
