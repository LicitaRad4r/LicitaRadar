import { useState, type ReactNode } from 'react'
import { FileCheck2, ShieldAlert } from 'lucide-react'
import { ApiError } from '@/api/erros'
import type { Certidao } from '@/api/tipos'
import { EstadoDaConsulta, Vazio } from '@/components/estado'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatarDia } from '@/lib/formatar'
import { cn } from '@/lib/utils'
import { EM_ALERTA, useCertidoes } from './api'
import { FormularioRenovacao } from './FormularioRenovacao'
import { COR_STATUS, ROTULO_STATUS, textoValidade } from './rotulos'

/**
 * Painel do decisor com as certidões da empresa (issue #17).
 * As que pedem ação (vencidas, urgentes e em atenção) vêm primeiro, na ordem de urgência do back.
 */
export function PaginaCertidoes() {
  const certidoes = useCertidoes()
  const [renovando, setRenovando] = useState<Certidao | null>(null)
  const [recemRenovada, setRecemRenovada] = useState<string | null>(null)

  // Só o decisor acessa certidões. O analista recebe 403 e vê uma explicação, sem "tentar de novo".
  if (certidoes.error instanceof ApiError && certidoes.error.codigo === 'ACESSO_NEGADO') {
    return (
      <PaginaComTitulo>
        <Vazio
          icone={<ShieldAlert aria-hidden />}
          titulo="As certidões ficam com o decisor da empresa"
          descricao="O seu perfil de acesso é de analista, que não vê documentos legais nem financeiros. Se precisar de uma certidão, peça ao decisor."
        />
      </PaginaComTitulo>
    )
  }

  return (
    <PaginaComTitulo>
      <EstadoDaConsulta
        consulta={certidoes}
        tituloErro="Não foi possível carregar as certidões"
        carregando={<EsqueletoDeCertidoes />}
        vazio={
          <Vazio
            icone={<FileCheck2 aria-hidden />}
            titulo="Nenhuma certidão cadastrada"
            descricao="Quando a sua empresa enviar as certidões de habilitação, elas aparecem aqui com o prazo de validade de cada uma."
          />
        }
      >
        {(lista) => {
          const emAlerta = lista.filter((c) => EM_ALERTA.includes(c.status))
          const emDia = lista.filter((c) => !EM_ALERTA.includes(c.status))
          return (
            <div className="space-y-8">
              <Grupo
                titulo={emAlerta.length > 0 ? `Precisam de atenção (${emAlerta.length})` : 'Precisam de atenção'}
                certidoes={emAlerta}
                vazio="Nenhuma certidão vence nos próximos 30 dias."
                recemRenovada={recemRenovada}
                aoRenovar={setRenovando}
              />
              {emDia.length > 0 && (
                <Grupo
                  titulo={`Em dia (${emDia.length})`}
                  certidoes={emDia}
                  recemRenovada={recemRenovada}
                  aoRenovar={setRenovando}
                />
              )}
            </div>
          )
        }}
      </EstadoDaConsulta>

      {renovando && (
        <FormularioRenovacao
          certidao={renovando}
          aoFechar={() => setRenovando(null)}
          aoRenovar={(renovada) => setRecemRenovada(renovada.id)}
        />
      )}
    </PaginaComTitulo>
  )
}

function PaginaComTitulo({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="titulo-certidoes" className="space-y-6">
      <header className="space-y-1">
        <h1 id="titulo-certidoes" className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
          Certidões
        </h1>
        <p className="text-sm text-muted-foreground">
          Documentos de habilitação da sua empresa, dos mais urgentes para os em dia. Uma certidão vencida pode
          tirar a empresa de uma licitação.
        </p>
      </header>
      {children}
    </section>
  )
}

function Grupo({
  titulo,
  certidoes,
  vazio,
  recemRenovada,
  aoRenovar,
}: {
  titulo: string
  certidoes: Certidao[]
  vazio?: string
  recemRenovada: string | null
  aoRenovar: (certidao: Certidao) => void
}) {
  const id = `grupo-${titulo.split(' ')[0].toLowerCase()}`
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="text-sm font-semibold text-muted-foreground">
        {titulo}
      </h2>
      {certidoes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {certidoes.map((certidao) => (
            <LinhaCertidao
              key={certidao.id}
              certidao={certidao}
              destacar={certidao.id === recemRenovada}
              aoRenovar={() => aoRenovar(certidao)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function LinhaCertidao({
  certidao,
  destacar,
  aoRenovar,
}: {
  certidao: Certidao
  destacar: boolean
  aoRenovar: () => void
}) {
  const cor = COR_STATUS[certidao.status]
  const pedeAcao = certidao.status === 'vencida' || certidao.status === 'urgente'
  return (
    <li
      // A certidão que acabou de ser renovada aparece no lugar novo com um destaque breve.
      className={cn('relative flex flex-wrap items-center gap-x-4 gap-y-2 py-4 pr-4 pl-6', destacar && 'animate-destaque')}
      aria-labelledby={`certidao-${certidao.id}`}
    >
      <span aria-hidden className={cn('absolute inset-y-3 left-2 w-1 rounded-full', cor.trilho)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`certidao-${certidao.id}`} className="font-medium">
            {certidao.nome}
          </h3>
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', cor.selo)}>
            {ROTULO_STATUS[certidao.status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className={cn(pedeAcao && 'font-medium text-foreground')}>{textoValidade(certidao.diasRestantes)}</span>
          {', '}
          validade {formatarDia(certidao.validade)}
        </p>
      </div>
      <Button
        variant={pedeAcao ? 'default' : 'outline'}
        size="lg"
        onClick={aoRenovar}
        aria-label={`Renovar certidão ${certidao.nome}`}
      >
        Renovar certidão
      </Button>
    </li>
  )
}

function EsqueletoDeCertidoes() {
  return (
    <div role="status" aria-label="Carregando certidões" aria-busy="true" className="divide-y rounded-xl border">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 pr-4 pl-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      ))}
    </div>
  )
}
