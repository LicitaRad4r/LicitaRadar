import { ArrowLeft, ExternalLink, FileQuestion, LoaderCircle } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'
import { EstadoDaConsulta, Vazio } from '@/components/estado'
import { buttonVariants } from '@/components/ui/button'
import { SeloDeScore } from '@/features/feed/SeloDeScore'
import { ROTULO_MODALIDADE } from '@/features/feed/rotulos'
import { diaEmBrasilia, diasEntre, hojeEmBrasilia } from '@/lib/datas'
import { formatarDia, formatarMoeda, textoPrazo } from '@/lib/formatar'
import type { EditalDetalheDTO } from '@/services/dto'
import { ApiError } from '@/services/erros'
import { useEdital } from './api'

export type EstadoDaRotaDoDetalhe = { buscaDoFeed?: string } | null

export function PaginaDetalheEdital() {
  const { editalId = '' } = useParams()
  const estadoDaRota = useLocation().state as EstadoDaRotaDoDetalhe
  const enderecoDoFeed = `/${estadoDaRota?.buscaDoFeed ?? ''}`
  const consultaDoEdital = useEdital(editalId)
  const editalNaoExiste = consultaDoEdital.error instanceof ApiError && consultaDoEdital.error.status === 404

  return (
    <div className="space-y-6">
      <Link
        to={enderecoDoFeed}
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Voltar para os editais
      </Link>

      {editalNaoExiste ? (
        <Vazio
          icone={<FileQuestion aria-hidden />}
          titulo="Edital não encontrado"
          descricao="Este edital não existe ou foi removido do PNCP. Volte para a lista e escolha outro."
        />
      ) : (
        <EstadoDaConsulta
          consulta={consultaDoEdital}
          tituloErro="Não foi possível carregar o edital"
          carregando={
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              Carregando edital
            </p>
          }
          estaVazio={() => false}
          vazio={null}
        >
          {(edital) => <DetalheDoEdital edital={edital} />}
        </EstadoDaConsulta>
      )}
    </div>
  )
}

function DetalheDoEdital({ edital }: { edital: EditalDetalheDTO }) {
  const diasAtePrazo = diasEntre(hojeEmBrasilia(), diaEmBrasilia(edital.prazo))
  const local = [edital.municipio, edital.uf].filter(Boolean).join(', ')

  return (
    <article aria-labelledby="titulo-edital" className="space-y-6">
      <header className="space-y-3">
        <SeloDeScore score={edital.score} faixa={edital.faixa} />
        <h1 id="titulo-edital" className="text-2xl leading-tight font-semibold tracking-tight text-tinta dark:text-foreground">
          {edital.titulo}
        </h1>
        {edital.descricao && <p className="text-muted-foreground">{edital.descricao}</p>}
      </header>

      <dl className="grid gap-x-6 gap-y-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <InformacaoDoEdital rotulo="Órgão" valor={edital.orgao} />
        <InformacaoDoEdital rotulo="Local" valor={local} />
        <InformacaoDoEdital rotulo="Modalidade" valor={ROTULO_MODALIDADE[edital.modalidade]} />
        <InformacaoDoEdital
          rotulo="Valor estimado"
          valor={edital.valorEstimado != null ? formatarMoeda(edital.valorEstimado) : 'Não informado'}
        />
        <InformacaoDoEdital
          rotulo="Prazo para proposta"
          valor={`${formatarDia(diaEmBrasilia(edital.prazo))} (${textoPrazo(diasAtePrazo).toLowerCase()})`}
        />
        <InformacaoDoEdital rotulo="Publicado em" valor={formatarDia(diaEmBrasilia(edital.dataPublicacao))} />
      </dl>

      {edital.linkPncp && (
        <a
          href={edital.linkPncp}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          Ver edital original no PNCP
          <ExternalLink aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      )}
    </article>
  )
}

function InformacaoDoEdital({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  )
}
