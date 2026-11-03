import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  pagina: number
  tamanho: number
  total: number
  aoMudar: (pagina: number) => void
}

/** Anterior / Próxima com a posição atual. Some quando tudo cabe numa página. */
export function Paginacao({ pagina, tamanho, total, aoMudar }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho))
  if (totalPaginas <= 1) return null

  const primeiro = (pagina - 1) * tamanho + 1
  const ultimo = Math.min(pagina * tamanho, total)

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 pt-4">
      <p className="text-sm text-muted-foreground">
        {primeiro} a {ultimo} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
          <ChevronLeft aria-hidden />
          Anterior
        </Button>
        <span className="text-sm tabular-nums" aria-current="page">
          {pagina} de {totalPaginas}
        </span>
        <Button variant="outline" disabled={pagina >= totalPaginas} onClick={() => aoMudar(pagina + 1)}>
          Próxima
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
