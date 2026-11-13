import { useId, useState, type KeyboardEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { Carregando, EstadoDaConsulta } from '@/components/estado'
import { Button } from '@/components/ui/button'
import { ROTULO_MODALIDADE } from '@/features/feed/rotulos'
import { UFS } from '@/lib/ufs'
import { cn } from '@/lib/utils'
import type { PerfilDTO } from '@/services/dto'
import { errosPorCampo, mensagemAmigavel } from '@/services/erros'
import { usePerfil, useSalvarPerfil } from './api'
import {
  camposIniciaisDoPerfil,
  esquemaDoFormularioDePerfil,
  MODALIDADES,
  validarNovoTermo,
  type CamposDoFormularioDePerfil,
} from './esquemaDoPerfil'

const classeDoCampo =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

const numeroOuNulo = (valorDigitado: string) => (valorDigitado === '' ? null : Number(valorDigitado))

export function PaginaPerfil() {
  const consultaDoPerfil = usePerfil()

  return (
    <section aria-labelledby="titulo-perfil" className="space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-perfil" className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
          Perfil da empresa
        </h1>
        <p className="text-sm text-muted-foreground">
          O feed usa estes critérios para escolher e ordenar os editais do PNCP para você.
        </p>
      </header>

      <EstadoDaConsulta
        consulta={consultaDoPerfil}
        tituloErro="Não foi possível carregar o perfil"
        carregando={<Carregando linhas={4} rotulo="Carregando perfil" />}
        estaVazio={() => false}
        vazio={null}
      >
        {(perfil) => <FormularioDePerfil perfilSalvo={perfil} />}
      </EstadoDaConsulta>
    </section>
  )
}

function FormularioDePerfil({ perfilSalvo }: { perfilSalvo: PerfilDTO }) {
  const navegar = useNavigate()
  const salvarPerfil = useSalvarPerfil()
  const ehPrimeiroSalvamento = !perfilSalvo.empresaId
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<CamposDoFormularioDePerfil>({
    resolver: zodResolver(esquemaDoFormularioDePerfil),
    defaultValues: camposIniciaisDoPerfil(perfilSalvo),
  })
  const termosChave = useWatch({ control, name: 'termosChave' })

  function enviar(campos: CamposDoFormularioDePerfil) {
    salvarPerfil.mutate(
      { ...campos, segmentos: perfilSalvo.segmentos ?? [] },
      {
        onSuccess: (perfilAtualizado) => {
          if (ehPrimeiroSalvamento) {
            void navegar('/', { replace: true })
            return
          }
          reset(camposIniciaisDoPerfil(perfilAtualizado))
        },
        onError: (erro) => {
          for (const [campo, mensagem] of Object.entries(errosPorCampo(erro))) {
            const campoDoFormulario = campo.split('.')[0] as keyof CamposDoFormularioDePerfil
            setError(campoDoFormulario, { message: mensagem })
          }
        },
      },
    )
  }

  const temErroSemCampo = salvarPerfil.isError && Object.keys(errosPorCampo(salvarPerfil.error)).length === 0

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="space-y-8">
      {ehPrimeiroSalvamento && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          Configure o perfil da sua empresa para começar a ver os editais ranqueados.
        </p>
      )}

      <CampoDeTermosChave
        termos={termosChave}
        erro={errors.termosChave?.message}
        aoAlterar={(novosTermos) => setValue('termosChave', novosTermos, { shouldDirty: true, shouldValidate: true })}
      />

      <GrupoDeOpcoes
        legenda="Estados"
        dica="Deixe todos desmarcados para buscar editais do Brasil inteiro."
        erro={errors.ufs?.message}
        colunas="grid-cols-4 sm:grid-cols-7 md:grid-cols-9"
        opcoes={UFS.map((uf) => ({ valor: uf, rotulo: uf }))}
        registro={register('ufs')}
      />

      <GrupoDeOpcoes
        legenda="Modalidades"
        dica="Deixe todas desmarcadas para aceitar qualquer modalidade."
        erro={errors.modalidades?.message}
        colunas="sm:grid-cols-3"
        opcoes={MODALIDADES.map((modalidade) => ({ valor: modalidade, rotulo: ROTULO_MODALIDADE[modalidade] }))}
        registro={register('modalidades')}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Faixa de valor estimado (R$)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumerico
            rotulo="Valor mínimo"
            erro={errors.valorMinimo?.message}
            registro={register('valorMinimo', { setValueAs: numeroOuNulo })}
          />
          <CampoNumerico
            rotulo="Valor máximo"
            erro={errors.valorMaximo?.message}
            registro={register('valorMaximo', { setValueAs: numeroOuNulo })}
          />
        </div>
      </fieldset>

      <div className="sm:w-1/2 sm:pr-2">
        <CampoNumerico
          rotulo="Prazo mínimo para a proposta (dias úteis)"
          dica="Editais com menos dias úteis até o prazo não aparecem no feed. Vazio usa 3 dias."
          erro={errors.prazoMinimoDiasUteis?.message}
          registro={register('prazoMinimoDiasUteis', { setValueAs: numeroOuNulo })}
        />
      </div>

      {temErroSemCampo && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {mensagemAmigavel(salvarPerfil.error)}
        </p>
      )}

      <Button type="submit" size="lg" className="h-10 px-4" disabled={salvarPerfil.isPending}>
        {salvarPerfil.isPending ? 'Salvando perfil' : 'Salvar perfil'}
      </Button>
    </form>
  )
}

function CampoDeTermosChave({
  termos,
  erro,
  aoAlterar,
}: {
  termos: string[]
  erro?: string
  aoAlterar: (novosTermos: string[]) => void
}) {
  const ids = { campo: useId(), dica: useId(), erro: useId() }
  const [termoDigitado, setTermoDigitado] = useState('')
  const [erroDoTermo, setErroDoTermo] = useState<string | null>(null)
  const erroVisivel = erroDoTermo ?? erro

  function adicionarTermo() {
    const problema = validarNovoTermo(termoDigitado, termos)
    if (problema) {
      setErroDoTermo(problema)
      return
    }
    aoAlterar([...termos, termoDigitado.trim()])
    setTermoDigitado('')
    setErroDoTermo(null)
  }

  function adicionarAoApertarEnter(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    adicionarTermo()
  }

  return (
    <div className="space-y-2">
      <label htmlFor={ids.campo} className="block text-sm font-medium">
        Termos-chave
      </label>
      <p id={ids.dica} className="text-xs text-muted-foreground">
        Palavras que aparecem no objeto dos editais que interessam à empresa, como "notebook" ou "manutenção predial".
      </p>
      <div className="flex gap-2">
        <input
          id={ids.campo}
          value={termoDigitado}
          onChange={(evento) => {
            setTermoDigitado(evento.target.value)
            setErroDoTermo(null)
          }}
          onKeyDown={adicionarAoApertarEnter}
          aria-invalid={erroVisivel ? true : undefined}
          aria-describedby={cn(ids.dica, erroVisivel && ids.erro)}
          className={cn(classeDoCampo, 'sm:max-w-sm')}
        />
        <Button type="button" variant="outline" size="lg" className="h-10" onClick={adicionarTermo}>
          Adicionar termo
        </Button>
      </div>
      {erroVisivel && (
        <p id={ids.erro} className="text-xs text-destructive">
          {erroVisivel}
        </p>
      )}
      {termos.length > 0 && (
        <ul aria-label="Termos-chave adicionados" className="flex flex-wrap gap-2 pt-1">
          {termos.map((termo) => (
            <li key={termo} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-1 pl-3 text-sm">
              {termo}
              <button
                type="button"
                onClick={() => aoAlterar(termos.filter((atual) => atual !== termo))}
                aria-label={`Remover termo ${termo}`}
                className="rounded-full p-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GrupoDeOpcoes({
  legenda,
  dica,
  erro,
  colunas,
  opcoes,
  registro,
}: {
  legenda: string
  dica: string
  erro?: string
  colunas: string
  opcoes: Array<{ valor: string; rotulo: string }>
  registro: UseFormRegisterReturn
}) {
  const idDaDica = useId()
  return (
    <fieldset className="space-y-2" aria-describedby={idDaDica}>
      <legend className="text-sm font-medium">{legenda}</legend>
      <p id={idDaDica} className="text-xs text-muted-foreground">
        {dica}
      </p>
      <div className={cn('grid gap-2', colunas)}>
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm has-checked:border-radar has-checked:bg-radar-suave has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input type="checkbox" value={opcao.valor} className="size-4 accent-radar" {...registro} />
            {opcao.rotulo}
          </label>
        ))}
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </fieldset>
  )
}

function CampoNumerico({
  rotulo,
  dica,
  erro,
  registro,
}: {
  rotulo: string
  dica?: string
  erro?: string
  registro: UseFormRegisterReturn
}) {
  const ids = { campo: useId(), dica: useId(), erro: useId() }
  return (
    <div className="space-y-1.5">
      <label htmlFor={ids.campo} className="block text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={ids.campo}
        type="number"
        inputMode="numeric"
        min={0}
        aria-invalid={erro ? true : undefined}
        aria-describedby={cn(dica && ids.dica, erro && ids.erro) || undefined}
        className={classeDoCampo}
        {...registro}
      />
      {dica && (
        <p id={ids.dica} className="text-xs text-muted-foreground">
          {dica}
        </p>
      )}
      {erro && (
        <p id={ids.erro} className="text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  )
}
