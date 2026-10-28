import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

type Props = {
  titulo: string
  descricao?: string
  /** Próximo passo para o usuário sair do vazio (ex.: botão "Configurar perfil"). */
  acao?: ReactNode
  icone?: ReactNode
}

/** Estado vazio: a consulta deu certo, mas não há nada para mostrar. Sempre diga o que fazer a seguir. */
export function Vazio({ titulo, descricao, acao, icone }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
      <div className="text-muted-foreground [&_svg]:size-8">{icone ?? <Inbox aria-hidden />}</div>
      <p className="font-medium">{titulo}</p>
      {descricao && <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}
