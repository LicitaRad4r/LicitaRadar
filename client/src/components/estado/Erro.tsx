import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { ApiError, mensagemAmigavel } from '@/services/erros'

type Props = {
  erro: unknown
  /** Normalmente o `refetch` da consulta. */
  aoTentarDeNovo?: () => void
  titulo?: string
}

/** Estado de erro: explica em linguagem simples e oferece tentar de novo. */
export function Erro({ erro, aoTentarDeNovo, titulo = 'Não foi possível carregar' }: Props) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
    >
      <AlertTriangle aria-hidden className="size-8 text-destructive" />
      <p className="font-medium">{titulo}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{mensagemAmigavel(erro)}</p>
      {erro instanceof ApiError && erro.codigo === 'EMPRESA_NAO_CONFIGURADA' ? (
        <Link to="/perfil" className={buttonVariants({ className: 'mt-2' })}>
          Configurar perfil
        </Link>
      ) : aoTentarDeNovo && (
        <Button variant="outline" className="mt-2" onClick={aoTentarDeNovo}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
