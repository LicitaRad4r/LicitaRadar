import { Check, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAcompanharEdital } from './api'

export function BotaoAcompanhar({ editalId, tituloDoEdital, className }: { editalId: string; tituloDoEdital: string; className?: string }) {
  const acompanharEdital = useAcompanharEdital()

  if (acompanharEdital.isSuccess) {
    return (
      <Link
        to="/acompanhamento"
        aria-label={`Acompanhando: ${tituloDoEdital}. Ver no quadro de acompanhamento`}
        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), className)}
      >
        <Check aria-hidden />
        Acompanhando
      </Link>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Acompanhar: ${tituloDoEdital}`}
      disabled={acompanharEdital.isPending}
      onClick={() => acompanharEdital.mutate(editalId)}
      className={className}
    >
      <Plus aria-hidden />
      {acompanharEdital.isPending ? 'Acompanhando' : 'Acompanhar'}
    </Button>
  )
}
