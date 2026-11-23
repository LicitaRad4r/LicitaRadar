import { useId } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { cn } from '@/lib/utils'
import type { CertidaoDTO } from '@/services/dto'
import { errosPorCampo, mensagemAmigavel } from '@/services/erros'
import { useCriarCertidao } from './api'
import { esquemaDoArquivoDaCertidao } from './arquivoDaCertidao'
import { CampoDoArquivoDaCertidao } from './CampoDoArquivoDaCertidao'

const classeDoCampo =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

function esquemaDaNovaCertidao() {
  const hoje = hojeEmBrasilia()
  return z.object({
    nome: z.string().trim().min(1, 'Informe o tipo da certidão.'),
    arquivo: esquemaDoArquivoDaCertidao,
    validade: z
      .string()
      .min(1, 'Informe a validade.')
      .refine((dia) => dia > hoje, 'A validade precisa ser depois de hoje.'),
  })
}

type CamposDaNovaCertidao = z.infer<ReturnType<typeof esquemaDaNovaCertidao>>
const CAMPOS_DA_API = ['nome', 'arquivo', 'validade'] as const

type Props = {
  aoFechar: () => void
  aoCriar: (criada: CertidaoDTO) => void
}

/** Envio de uma certidão que a empresa ainda não tem (US14), pelo POST /v1/certidoes. Só para o decisor. */
export function FormularioNovaCertidao({ aoFechar, aoCriar }: Props) {
  const criarCertidao = useCriarCertidao()
  const ids = { nome: useId(), dicaNome: useId(), validade: useId(), erroNome: useId(), erroValidade: useId() }
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CamposDaNovaCertidao>({ resolver: zodResolver(esquemaDaNovaCertidao()) })

  function enviar({ nome, arquivo, validade }: CamposDaNovaCertidao) {
    criarCertidao.mutate(
      { nome, arquivo: arquivo[0], validade },
      {
        onSuccess: (criada) => {
          aoCriar(criada)
          aoFechar()
        },
        onError: (erro) => {
          for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
            const campoDaApi = CAMPOS_DA_API.find((nomeDoCampo) => nomeDoCampo === campo)
            if (campoDaApi) setError(campoDaApi, { message: mensagem })
          }
        },
      },
    )
  }

  const erroGeral = criarCertidao.isError && Object.keys(errosPorCampo(criarCertidao.error)).length === 0
  const textoDoBotao = criarCertidao.isPending ? 'Enviando certidão' : erroGeral ? 'Tentar de novo' : 'Enviar certidão'

  return (
    <Dialog.Root open onOpenChange={(aberto) => !aberto && !criarCertidao.isPending && aoFechar()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-tinta/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-5 shadow-xl outline-none transition-[scale,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none">
          <Dialog.Title className="text-lg font-semibold text-tinta dark:text-foreground">Nova certidão</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Envie uma certidão que ainda não está na lista. Para atualizar uma que já está, use "Renovar certidão".
          </Dialog.Description>

          <form onSubmit={handleSubmit(enviar)} noValidate className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor={ids.nome} className="block text-sm font-medium">
                Tipo da certidão
              </label>
              <input
                id={ids.nome}
                aria-invalid={errors.nome ? true : undefined}
                aria-describedby={cn(ids.dicaNome, errors.nome && ids.erroNome)}
                {...register('nome')}
                className={cn(classeDoCampo, 'w-full')}
              />
              <p id={ids.dicaNome} className="text-xs text-muted-foreground">
                Por exemplo, "CND Receita Federal e PGFN" ou "CRF do FGTS".
              </p>
              {errors.nome && (
                <p id={ids.erroNome} className="text-xs text-destructive">
                  {errors.nome.message}
                </p>
              )}
            </div>

            <CampoDoArquivoDaCertidao erro={errors.arquivo?.message} registro={register('arquivo')} />

            <div className="space-y-1.5">
              <label htmlFor={ids.validade} className="block text-sm font-medium">
                Validade
              </label>
              <input
                id={ids.validade}
                type="date"
                min={somarDias(hojeEmBrasilia(), 1)}
                aria-invalid={errors.validade ? true : undefined}
                aria-describedby={errors.validade ? ids.erroValidade : undefined}
                {...register('validade')}
                className={cn(classeDoCampo, 'w-48')}
              />
              {errors.validade && (
                <p id={ids.erroValidade} className="text-xs text-destructive">
                  {errors.validade.message}
                </p>
              )}
            </div>

            {erroGeral && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {mensagemAmigavel(criarCertidao.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close render={<Button type="button" variant="ghost" size="lg" disabled={criarCertidao.isPending} />}>
                Cancelar
              </Dialog.Close>
              <Button type="submit" size="lg" disabled={criarCertidao.isPending}>
                {textoDoBotao}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
