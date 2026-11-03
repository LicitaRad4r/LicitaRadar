import { useId } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { errosPorCampo, mensagemAmigavel } from '@/api/erros'
import type { Certidao } from '@/api/tipos'
import { Button } from '@/components/ui/button'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { formatarDia } from '@/lib/formatar'
import { cn } from '@/lib/utils'
import { useRenovarCertidao } from './api'

/** Mesmas regras do contrato: PDF, JPG ou PNG, de 1 byte até 5 MB (5 MB exatos é aceito). */
export const LIMITE_ARQUIVO = 5 * 1024 * 1024
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png']
const EXTENSOES_ACEITAS = /\.(pdf|jpe?g|png)$/i

function esquema(certidao: Certidao) {
  const hoje = hojeEmBrasilia()
  return z.object({
    arquivo: z
      .custom<FileList>()
      .refine((lista) => lista?.length === 1, 'Escolha o arquivo da certidão nova.')
      .refine((lista) => {
        const arquivo = lista?.[0]
        return !arquivo || TIPOS_ACEITOS.includes(arquivo.type) || EXTENSOES_ACEITAS.test(arquivo.name)
      }, 'Envie um PDF, JPG ou PNG.')
      .refine((lista) => !lista?.[0] || lista[0].size > 0, 'O arquivo está vazio.')
      .refine((lista) => !lista?.[0] || lista[0].size <= LIMITE_ARQUIVO, 'O arquivo passa de 5 MB.'),
    validade: z
      .string()
      .min(1, 'Informe a nova validade.')
      .refine((dia) => dia > hoje, 'A nova validade precisa ser depois de hoje.')
      .refine((dia) => dia > certidao.validade, 'A nova validade precisa ser depois da validade atual.'),
  })
}

type Campos = z.infer<ReturnType<typeof esquema>>

type Props = {
  certidao: Certidao
  aoFechar: () => void
  aoRenovar: (renovada: Certidao) => void
}

/** Formulário de renovação (issue #17): arquivo novo e nova validade, enviados no PUT /renovacao. */
export function FormularioRenovacao({ certidao, aoFechar, aoRenovar }: Props) {
  const renovar = useRenovarCertidao()
  const ids = { arquivo: useId(), validade: useId(), dicaArquivo: useId(), erroGeral: useId() }
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Campos>({ resolver: zodResolver(esquema(certidao)) })

  // A nova validade mínima é o dia seguinte ao mais tarde entre hoje e a validade atual.
  const minimo = somarDias([hojeEmBrasilia(), certidao.validade].sort()[1], 1)

  function enviar({ arquivo, validade }: Campos) {
    renovar.mutate(
      { certidaoId: certidao.id, arquivo: arquivo[0], validade },
      {
        onSuccess: (renovada) => {
          aoRenovar(renovada)
          aoFechar()
        },
        onError: (erro) => {
          // Erro de validação do back aparece no campo certo; o resto vira mensagem geral.
          for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
            if (campo === 'arquivo' || campo === 'validade') setError(campo, { message: mensagem })
          }
        },
      },
    )
  }

  const erroGeral = renovar.isError && Object.keys(errosPorCampo(renovar.error)).length === 0

  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && !renovar.isPending && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-tinta/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-5 shadow-xl outline-none transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
          <Dialog.Title className="text-lg font-semibold text-tinta dark:text-foreground">Renovar certidão</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {certidao.nome}. Validade atual: {formatarDia(certidao.validade)}. O arquivo anterior fica guardado como
            inativo.
          </Dialog.Description>

          <form onSubmit={handleSubmit(enviar)} noValidate className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={ids.arquivo} className="block text-sm font-medium">
                Arquivo da certidão nova
              </label>
              <input
                id={ids.arquivo}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                aria-invalid={errors.arquivo ? true : undefined}
                aria-describedby={ids.dicaArquivo}
                {...register('arquivo')}
                className={cn(
                  'block w-full rounded-lg border border-input text-sm file:mr-3 file:h-9 file:border-0 file:border-r file:border-input file:bg-muted file:px-3 file:text-sm file:font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  errors.arquivo && 'border-destructive',
                )}
              />
              <p id={ids.dicaArquivo} className={cn('text-xs', errors.arquivo ? 'text-destructive' : 'text-muted-foreground')}>
                {errors.arquivo?.message ?? 'PDF, JPG ou PNG, até 5 MB.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={ids.validade} className="block text-sm font-medium">
                Nova validade
              </label>
              <input
                id={ids.validade}
                type="date"
                min={minimo}
                aria-invalid={errors.validade ? true : undefined}
                aria-describedby={errors.validade ? `${ids.validade}-erro` : undefined}
                {...register('validade')}
                className={cn(
                  'h-9 w-48 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                  errors.validade && 'border-destructive',
                )}
              />
              {errors.validade && (
                <p id={`${ids.validade}-erro`} className="text-xs text-destructive">
                  {errors.validade.message}
                </p>
              )}
            </div>

            {erroGeral && (
              <p id={ids.erroGeral} role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {mensagemAmigavel(renovar.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close render={<Button type="button" variant="ghost" size="lg" disabled={renovar.isPending} />}>
                Cancelar
              </Dialog.Close>
              <Button type="submit" size="lg" disabled={renovar.isPending}>
                {renovar.isPending ? 'Salvando renovação' : 'Salvar renovação'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
