import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Faixa, Uf } from '@/api/tipos'
import { Button } from '@/components/ui/button'
import { UFS } from '@/lib/ufs'
import { cn } from '@/lib/utils'
import type { FiltrosDaTela } from './useFiltrosDaUrl'

type Props = {
  filtros: FiltrosDaTela
  alterar: (mudancas: Partial<FiltrosDaTela>) => void
  limpar: () => void
  temFiltro: boolean
}

const OPCOES_FAIXA: { valor: Faixa | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'media', rotulo: 'Média' },
]

const campo =
  'h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/** Refina o feed sem alterar o perfil salvo. */
export function BarraDeFiltros({ filtros, alterar, limpar, temFiltro }: Props) {
  // O termo só vai para a URL (e para a API) depois que a pessoa para de digitar.
  const [termo, setTermo] = useState(filtros.termo)

  // Se o termo da URL mudar por fora (Limpar filtros, voltar no navegador), o campo acompanha.
  const [termoDaUrl, setTermoDaUrl] = useState(filtros.termo)
  if (filtros.termo !== termoDaUrl) {
    setTermoDaUrl(filtros.termo)
    setTermo(filtros.termo)
  }

  useEffect(() => {
    if (termo.trim() === filtros.termo) return
    const espera = setTimeout(() => alterar({ termo: termo.trim() }), 400)
    return () => clearTimeout(espera)
  }, [termo, filtros.termo, alterar])

  return (
    <form
      role="search"
      aria-label="Filtrar editais"
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        alterar({ termo: termo.trim() })
      }}
    >
      <label className="relative min-w-56 flex-1">
        <span className="sr-only">Buscar no objeto do edital</span>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar no objeto, ex.: notebook"
          className={cn(campo, 'w-full pl-9')}
        />
      </label>

      <label>
        <span className="sr-only">Estado</span>
        <select
          value={filtros.uf}
          onChange={(e) => alterar({ uf: e.target.value as Uf | '' })}
          className={campo}
        >
          <option value="">Todos os estados</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex rounded-lg border border-input p-0.5">
        <legend className="sr-only">Aderência</legend>
        {OPCOES_FAIXA.map((opcao) => (
          <button
            key={opcao.rotulo}
            type="button"
            aria-pressed={filtros.faixa === opcao.valor}
            onClick={() => alterar({ faixa: opcao.valor })}
            className={cn(
              'h-8 rounded-md px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              filtros.faixa === opcao.valor
                ? 'bg-tinta text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </fieldset>

      {temFiltro && (
        <Button type="button" variant="ghost" onClick={limpar}>
          <X aria-hidden />
          Limpar filtros
        </Button>
      )}
    </form>
  )
}
