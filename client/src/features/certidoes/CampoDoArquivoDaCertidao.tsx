import { useId } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { cn } from '@/lib/utils'

/** Campo do arquivo da certidão, com a dica de formato que vira a mensagem de erro quando há erro. */
export function CampoDoArquivoDaCertidao({ erro, registro }: { erro?: string; registro: UseFormRegisterReturn }) {
  const ids = { campo: useId(), dica: useId() }
  return (
    <div className="space-y-1.5">
      <label htmlFor={ids.campo} className="block text-sm font-medium">
        Arquivo da certidão nova
      </label>
      <input
        id={ids.campo}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        aria-invalid={erro ? true : undefined}
        aria-describedby={ids.dica}
        {...registro}
        className={cn(
          'block w-full rounded-lg border border-input text-sm file:mr-3 file:h-9 file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:text-sm file:font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          erro && 'border-destructive',
        )}
      />
      <p id={ids.dica} className={cn('text-xs', erro ? 'text-destructive' : 'text-muted-foreground')}>
        {erro ?? 'PDF, JPG ou PNG, até 5 MB.'}
      </p>
    </div>
  )
}
