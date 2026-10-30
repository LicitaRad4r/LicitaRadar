import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  /** Quantas linhas de esqueleto mostrar (aproxime do tamanho real da lista). */
  linhas?: number
  /** Texto lido por leitores de tela. */
  rotulo?: string
}

/** Estado de carregando: esqueleto no formato de lista, para a tela não "pular" quando os dados chegam. */
export function Carregando({ linhas = 3, rotulo = 'Carregando' }: Props) {
  return (
    <div role="status" aria-label={rotulo} aria-busy="true" className="space-y-3">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
