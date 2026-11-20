import { LoaderCircle, LogOut } from 'lucide-react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { API_MOCK } from '@/services/config'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chaves } from '@/lib/chaves'
import { obterSaude } from '@/services/saude'
import { useTratamentoDeAcesso } from '@/features/acesso/TratamentoDeAcesso'
import { useSaidaPorInatividade } from '@/features/acesso/useSaidaPorInatividade'
import { sessao, useSessao, type Usuario } from '@/lib/sessao'
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
          'shrink-0 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-white/50',
          isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:text-white',
        )
      }
    >
      {children}
    </NavLink>
  )
}

/** Quem está logado e o botão de sair. Ao sair, o cache da API é limpo (os dados eram da empresa dessa pessoa). */
function MenuDoUsuario({ usuario }: { usuario: Usuario }) {
  const navegar = useNavigate()
  const queryClient = useQueryClient()
  async function sair() {
    await sessao.sair()
    queryClient.clear()
    void navegar('/login', { replace: true })
  }
  return (
    <div className="flex items-center gap-3">
      <p className="hidden text-right text-xs leading-tight md:block">
        <span className="block text-white">{usuario.email}</span>
        {usuario.papel && <span className="text-white/60">{usuario.papel === 'decisor' ? 'Decisor' : 'Analista'}</span>}
      </p>
      <button
        type="button"
        onClick={sair}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-white/80 outline-none hover:text-white focus-visible:ring-3 focus-visible:ring-white/50"
      >
        <LogOut aria-hidden className="size-4" />
        <span className="sr-only sm:not-sr-only">Sair</span>
      </button>
    </div>
  )
}

/**
 * Moldura das páginas logadas: sem sessão, vai para o login (e volta para cá depois de entrar).
 * Aqui também ficam o tratamento central de 401 e 403 (Jornada 4) e a saída por inatividade (US02).
 */
export function Layout() {
  const { carregando, usuario } = useSessao()
  const local = useLocation()
  useTratamentoDeAcesso()
  useSaidaPorInatividade(usuario !== null)

  if (carregando) {
    return (
      <div role="status" className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          Abrindo o LicitaRadar
        </span>
      </div>
    )
  }
  if (!usuario) return <Navigate to="/login" replace state={{ voltar: local }} />

  return (
    <div className="min-h-svh bg-background">
      <header className="bg-tinta text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 sm:h-14 sm:flex-nowrap">
          <div className="contents sm:flex sm:items-center sm:gap-6">
            <Link
              to="/"
              className="rounded-md py-3 text-lg font-semibold tracking-tight outline-none sm:py-0 focus-visible:ring-3 focus-visible:ring-white/50"
            >
              LicitaRadar
            </Link>
            <nav
              aria-label="Principal"
              className="order-last -mx-2 flex w-full items-center gap-0.5 overflow-x-auto px-2 pb-2 sm:order-none sm:mx-0 sm:w-auto sm:gap-1 sm:overflow-visible sm:p-0"
            >
              <ItemDoMenu para="/">Editais</ItemDoMenu>
              <ItemDoMenu para="/acompanhamento">Acompanhamento</ItemDoMenu>
              {/* Certidões são só do decisor (RF03). Para o analista, o link nem aparece. */}
              {usuario.papel !== 'analista' && <ItemDoMenu para="/certidoes">Certidões</ItemDoMenu>}
              <ItemDoMenu para="/perfil">Perfil</ItemDoMenu>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <StatusApi />
            <MenuDoUsuario usuario={usuario} />
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
