import { useEffect, useId, useState, type FormEvent } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { Modalidade, Uf } from '@/services/dto'
import { Button } from '@/components/ui/button'
import { UFS } from '@/lib/ufs'
import { cn } from '@/lib/utils'
import { JANELAS_DE_DIAS, type Etiqueta, type Filtros, type JanelaDeDias } from './filtros'
import { ROTULO_MODALIDADE } from './rotulos'

type Props = {
  filtros: Filtros
  etiquetas: Etiqueta[]
  alterar: (mudancas: Partial<Filtros>) => void
  limpar: () => void
}

const campo =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive'

const rotuloCampo = 'block text-xs font-medium text-muted-foreground'

const comoJanela = (valor: string) => (valor ? (Number(valor) as JanelaDeDias) : null)

/**
 * Barra de refinamento do feed (issue #16). Restringe a lista sem alterar o perfil salvo nem o score.
 * Linha principal com busca, estados e modalidade; município, valor, prazo e publicação ficam em "Mais filtros".
 */
export function BarraDeFiltros({ filtros, etiquetas, alterar, limpar }: Props) {
  const idPainel = useId()
  const avancadosAtivos = [
    filtros.municipio !== '',
    filtros.valorMin !== null || filtros.valorMax !== null,
    filtros.prazo !== null,
    filtros.publicado !== null,
  ].filter(Boolean).length
  const [maisFiltros, setMaisFiltros] = useState(avancadosAtivos > 0)

  return (
    <div className="space-y-3">
      <div role="search" aria-label="Filtrar editais" className="flex flex-wrap items-center gap-2">
        <CampoComEspera
          valor={filtros.q}
          aoMudar={(q) => alterar({ q })}
          rotulo="Buscar no objeto do edital"
          placeholder="Buscar no objeto, ex.: notebook"
          icone
          className="min-w-56 flex-1"
        />

        <label>
          <span className="sr-only">Adicionar estado</span>
          <select
            value=""
            onChange={(e) => alterar({ ufs: [...filtros.ufs, e.target.value as Uf] })}
            className={campo}
          >
            <option value="">{filtros.ufs.length > 0 ? 'Mais um estado' : 'Todos os estados'}</option>
            {UFS.filter((uf) => !filtros.ufs.includes(uf)).map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Modalidade</span>
          <select
            value={filtros.modalidade ?? ''}
            onChange={(e) => alterar({ modalidade: (e.target.value || null) as Modalidade | null })}
            className={campo}
          >
            <option value="">Todas as modalidades</option>
            {Object.entries(ROTULO_MODALIDADE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>

        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-expanded={maisFiltros}
          aria-controls={idPainel}
          onClick={() => setMaisFiltros((aberto) => !aberto)}
        >
          <SlidersHorizontal aria-hidden />
          Mais filtros
          {avancadosAtivos > 0 && (
            <span className="rounded-full bg-radar px-1.5 text-xs leading-5 text-white tabular-nums">
              {avancadosAtivos}
              <span className="sr-only"> ativos</span>
            </span>
          )}
        </Button>
      </div>

      {maisFiltros && (
        <div id={idPainel} className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg bg-muted/60 p-3">
          <div className="space-y-1">
            <span aria-hidden className={rotuloCampo}>
              Município
            </span>
            <CampoComEspera
              valor={filtros.municipio}
              aoMudar={(municipio) => alterar({ municipio })}
              rotulo="Município"
              placeholder="Ex.: Goiânia"
              className="w-44"
            />
          </div>
          <FaixaDeValor
            minimo={filtros.valorMin}
            maximo={filtros.valorMax}
            aoAplicar={(valorMin, valorMax) => alterar({ valorMin, valorMax })}
          />
          <label className="space-y-1">
            <span className={rotuloCampo}>Prazo para proposta</span>
            <select
              value={filtros.prazo ?? ''}
              onChange={(e) => alterar({ prazo: comoJanela(e.target.value) })}
              className={campo}
            >
              <option value="">Qualquer prazo</option>
              {JANELAS_DE_DIAS.map((dias) => (
                <option key={dias} value={dias}>
                  Encerra em até {dias} dias
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={rotuloCampo}>Publicação</span>
            <select
              value={filtros.publicado ?? ''}
              onChange={(e) => alterar({ publicado: comoJanela(e.target.value) })}
              className={campo}
            >
              <option value="">Qualquer data</option>
              {JANELAS_DE_DIAS.map((dias) => (
                <option key={dias} value={dias}>
                  Nos últimos {dias} dias
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <ul aria-label="Filtros ativos" className="contents">
            {etiquetas.map((etiqueta) => (
              <li key={etiqueta.id}>
                <button
                  type="button"
                  aria-label={`Remover filtro ${etiqueta.rotulo}`}
                  onClick={() => alterar(etiqueta.remover(filtros))}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-radar-suave pr-1.5 pl-3 text-sm text-radar outline-none hover:bg-radar/15 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {etiqueta.rotulo}
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" size="sm" onClick={limpar}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}

/** Campo de texto que só vai para a URL quando a pessoa para de digitar (ou aperta Enter). */
function CampoComEspera({
  valor: termoDaUrl,
  aoMudar: aoBuscar,
  rotulo,
  placeholder,
  icone = false,
  className,
}: {
  valor: string
  aoMudar: (valor: string) => void
  rotulo: string
  placeholder: string
  icone?: boolean
  className?: string
}) {
  const [termo, setTermo] = useState(termoDaUrl)

  // Se a URL mudar por fora (remover a etiqueta, Limpar filtros, voltar no navegador), o campo acompanha.
  const [ultimoDaUrl, setUltimoDaUrl] = useState(termoDaUrl)
  if (termoDaUrl !== ultimoDaUrl) {
    setUltimoDaUrl(termoDaUrl)
    setTermo(termoDaUrl)
  }

  useEffect(() => {
    if (termo.trim() === termoDaUrl) return
    const espera = setTimeout(() => aoBuscar(termo.trim()), 400)
    return () => clearTimeout(espera)
  }, [termo, termoDaUrl, aoBuscar])

  return (
    <form
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault()
        aoBuscar(termo.trim())
      }}
    >
      <label>
        <span className="sr-only">{rotulo}</span>
        {icone && (
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder={placeholder}
          className={cn(campo, 'w-full', icone && 'pl-9')}
        />
      </label>
    </form>
  )
}

/** "50.000" ou "R$ 50.000" vira 50000. Campo vazio vira null. */
function lerValor(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '')
  return digitos ? Number(digitos) : null
}

const mostrarValor = (valor: number | null) => (valor === null ? '' : valor.toLocaleString('pt-BR'))

function FaixaDeValor({
  minimo,
  maximo,
  aoAplicar,
}: {
  minimo: number | null
  maximo: number | null
  aoAplicar: (minimo: number | null, maximo: number | null) => void
}) {
  const idErro = useId()
  const [textoMin, setTextoMin] = useState(mostrarValor(minimo))
  const [textoMax, setTextoMax] = useState(mostrarValor(maximo))
  const [erro, setErro] = useState('')

  // Acompanha a URL quando o filtro é removido pela etiqueta ou pelo Limpar filtros.
  const [ultimos, setUltimos] = useState([minimo, maximo])
  if (ultimos[0] !== minimo || ultimos[1] !== maximo) {
    setUltimos([minimo, maximo])
    setTextoMin(mostrarValor(minimo))
    setTextoMax(mostrarValor(maximo))
    setErro('')
  }

  function aplicar(e: FormEvent) {
    e.preventDefault()
    const novoMin = lerValor(textoMin)
    const novoMax = lerValor(textoMax)
    if (novoMin !== null && novoMax !== null && novoMin > novoMax) {
      setErro('O valor mínimo não pode ser maior que o máximo.')
      return
    }
    setErro('')
    aoAplicar(novoMin, novoMax)
  }

  return (
    <form onSubmit={aplicar} className="space-y-1" aria-label="Valor estimado">
      <fieldset className="flex flex-wrap items-end gap-2">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Valor estimado (R$)</legend>
        <label>
          <span className="sr-only">Valor mínimo</span>
          <input
            inputMode="numeric"
            placeholder="Mínimo"
            value={textoMin}
            onChange={(e) => setTextoMin(e.target.value)}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? idErro : undefined}
            className={cn(campo, 'w-32 tabular-nums')}
          />
        </label>
        <span aria-hidden className="pb-2 text-sm text-muted-foreground">
          a
        </span>
        <label>
          <span className="sr-only">Valor máximo</span>
          <input
            inputMode="numeric"
            placeholder="Máximo"
            value={textoMax}
            onChange={(e) => setTextoMax(e.target.value)}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? idErro : undefined}
            className={cn(campo, 'w-32 tabular-nums')}
          />
        </label>
        <Button type="submit" variant="outline" size="lg">
          Aplicar valor
        </Button>
      </fieldset>
      {erro && (
        <p id={idErro} role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      )}
    </form>
  )
}
