import { AlertTriangle } from 'lucide-react'

/** Página mostrada no lugar do app quando falta variável do Firebase neste ambiente. */
export function PaginaSemConfiguracao({ faltando }: { faltando: string[] }) {
  return (
    <section role="alert" className="mx-auto max-w-lg space-y-4 px-4 py-10 text-center">
      <AlertTriangle aria-hidden className="mx-auto size-10 text-destructive" />
      <h1 className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
        O login não está configurado
      </h1>
      <p className="text-muted-foreground">
        Este ambiente do LicitaRadar está sem a configuração do login, por isso ninguém consegue entrar. Avise o
        responsável pelo sistema.
      </p>
      <p className="text-sm break-words text-muted-foreground">Variáveis faltando: {faltando.join(', ')}</p>
    </section>
  )
}
