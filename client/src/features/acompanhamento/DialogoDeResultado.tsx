import { useId, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AcompanhamentoDTO, ResultadoAcompanhamento } from '@/services/dto'
import { ROTULO_DO_RESULTADO } from './etapas'

const RESULTADOS: ResultadoAcompanhamento[] = ['venceu', 'nao_venceu']

type Props = {
  acompanhamento: AcompanhamentoDTO
  aoConfirmar: (resultado: ResultadoAcompanhamento) => void
  aoCancelar: () => void
}

export function DialogoDeResultado({ acompanhamento, aoConfirmar, aoCancelar }: Props) {
  const [resultadoEscolhido, setResultadoEscolhido] = useState<ResultadoAcompanhamento | null>(null)
  const nomeDoGrupo = useId()

  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && aoCancelar()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-tinta/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-5 shadow-xl outline-none">
          <Dialog.Title className="text-lg font-semibold text-tinta dark:text-foreground">Resultado da licitação</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {acompanhamento.titulo}. Depois de salvo, o resultado não muda mais.
          </Dialog.Description>

          <form
            className="mt-5 space-y-5"
            onSubmit={(evento) => {
              evento.preventDefault()
              if (resultadoEscolhido) aoConfirmar(resultadoEscolhido)
            }}
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">A empresa venceu?</legend>
              <div className="grid grid-cols-2 gap-2">
                {RESULTADOS.map((resultado) => (
                  <label
                    key={resultado}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm',
                      'has-checked:border-radar has-checked:bg-radar-suave has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                    )}
                  >
                    <input
                      type="radio"
                      name={nomeDoGrupo}
                      value={resultado}
                      checked={resultadoEscolhido === resultado}
                      onChange={() => setResultadoEscolhido(resultado)}
                      className="size-4 accent-radar"
                    />
                    {ROTULO_DO_RESULTADO[resultado]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex justify-end gap-2">
              <Dialog.Close render={<Button type="button" variant="ghost" size="lg" />}>Cancelar</Dialog.Close>
              <Button type="submit" size="lg" disabled={!resultadoEscolhido}>
                Salvar resultado
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
