import { useId, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, type Location } from 'react-router'
import { Button } from '@/components/ui/button'
import { ErroDeLogin, sessao, useSessao } from '@/lib/sessao'
import { cn } from '@/lib/utils'
import { API_MOCK } from '@/services/config'

type EstadoDaRota = { voltar?: Location } | null

const campo =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

/** Tela de login (Jornada 4). Depois de entrar, volta para a página que a pessoa tentou abrir. */
export function PaginaLogin() {
  const { carregando, usuario, motivoDaSaida } = useSessao()
  const local = useLocation()
  const navegar = useNavigate()
  const estado = local.state as EstadoDaRota
  const destino = estado?.voltar ? `${estado.voltar.pathname}${estado.voltar.search}` : '/'

  const ids = { email: useId(), senha: useId(), erro: useId() }
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  if (!carregando && usuario && !entrando) return <Navigate to={destino} replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEntrando(true)
    try {
      await sessao.entrar(email, senha)
      void navegar(destino, { replace: true })
    } catch (falha) {
      setErro(falha instanceof ErroDeLogin ? falha.message : 'Não foi possível entrar agora. Tente novamente.')
      setEntrando(false)
    }
  }

  return (
    <div className="grid min-h-svh bg-background md:grid-cols-[1fr_minmax(0,28rem)]">
      <aside className="flex flex-col justify-between bg-tinta p-8 text-white md:p-12">
        <p className="text-lg font-semibold tracking-tight">LicitaRadar</p>
        <div className="my-10 space-y-3 md:my-0">
          <p className="max-w-md text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
            A oportunidade certa, antes do prazo.
          </p>
          <p className="max-w-md text-white/70">
            Editais do PNCP ranqueados pelo perfil da sua empresa e as certidões de habilitação sempre em dia.
          </p>
        </div>
        <p className="hidden text-xs text-white/50 md:block">AI Lab / Makers, GovTech</p>
      </aside>

      <main className="flex items-center justify-center p-6 md:p-10">
        <form onSubmit={entrar} noValidate className="w-full max-w-sm space-y-5" aria-labelledby="titulo-login">
          <div className="space-y-1">
            <h1 id="titulo-login" className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
              Entrar
            </h1>
            <p className="text-sm text-muted-foreground">Use o e-mail e a senha da sua conta.</p>
          </div>

          {motivoDaSaida === 'sessao-expirada' && !erro && (
            <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
              Sua sessão expirou. Entre de novo para continuar de onde parou.
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor={ids.email} className="block text-sm font-medium">
              E-mail
            </label>
            <input
              id={ids.email}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? ids.erro : undefined}
              className={campo}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={ids.senha} className="block text-sm font-medium">
              Senha
            </label>
            <input
              id={ids.senha}
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? ids.erro : undefined}
              className={campo}
            />
          </div>

          {erro && (
            <p id={ids.erro} role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}

          <Button type="submit" size="lg" className="h-10 w-full" disabled={entrando || !email || !senha}>
            {entrando ? 'Entrando' : 'Entrar'}
          </Button>

          {API_MOCK && <ContasDeDemonstracao aoEscolher={(e, s) => (setEmail(e), setSenha(s))} />}
        </form>
      </main>
    </div>
  )
}

/** Só com a API simulada: atalhos para os usuários do seed do back. */
function ContasDeDemonstracao({ aoEscolher }: { aoEscolher: (email: string, senha: string) => void }) {
  const contas = [
    { email: 'decisor.a@licitaradar.local', papel: 'Decisor, empresa A' },
    { email: 'analista.a@licitaradar.local', papel: 'Analista, empresa A' },
  ]
  return (
    <div className="space-y-2 border-t pt-4">
      <p className="text-xs text-muted-foreground">API simulada: escolha uma conta de teste (senha senha-local-123).</p>
      <div className="flex flex-wrap gap-2">
        {contas.map((conta) => (
          <button
            key={conta.email}
            type="button"
            onClick={() => aoEscolher(conta.email, 'senha-local-123')}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
            )}
          >
            {conta.papel}
          </button>
        ))}
      </div>
    </div>
  )
}
