import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { mensagemAmigavel } from '@/api/erros'
import { Carregando } from './Carregando'
import { Erro } from './Erro'

type Props<T> = {
  consulta: UseQueryResult<T>
  /** Diz quando o resultado conta como vazio. Padrão: lista vazia ou `{ itens: [] }`. */
  estaVazio?: (dados: T) => boolean
  /** Substitui o esqueleto padrão. */
  carregando?: ReactNode
  /** O que mostrar quando não há dados (use o componente Vazio). Obrigatório: cada tela tem a sua mensagem. */
  vazio: ReactNode
  tituloErro?: string
  children: (dados: T) => ReactNode
}

function vazioPadrao(dados: unknown) {
  if (Array.isArray(dados)) return dados.length === 0
  if (dados && typeof dados === 'object' && 'itens' in dados && Array.isArray(dados.itens)) {
    return dados.itens.length === 0
  }
  return false
}

/**
 * Resolve os quatro estados de uma consulta no mesmo lugar:
 * carregando, erro, vazio e sucesso. Toda tela que lista dados deve passar por aqui.
 *
 * Se uma atualização em segundo plano falhar e já houver dados, mantém os dados
 * e mostra um aviso discreto, em vez de trocar a tela inteira por erro.
 */
export function EstadoDaConsulta<T>({
  consulta,
  estaVazio = vazioPadrao,
  carregando,
  vazio,
  tituloErro,
  children,
}: Props<T>) {
  if (consulta.isPending) return <>{carregando ?? <Carregando />}</>

  if (consulta.isError && consulta.data === undefined) {
    return <Erro erro={consulta.error} titulo={tituloErro} aoTentarDeNovo={() => consulta.refetch()} />
  }

  const dados = consulta.data as T
  return (
    <>
      {consulta.isError && (
        <p role="status" className="mb-3 text-sm text-muted-foreground">
          Mostrando dados salvos. {mensagemAmigavel(consulta.error)}
        </p>
      )}
      {estaVazio(dados) ? vazio : children(dados)}
    </>
  )
}
