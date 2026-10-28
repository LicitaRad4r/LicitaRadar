/**
 * Tipos do contrato da API, gerados a partir de server/openapi.yaml.
 * Para atualizar depois de uma mudança no contrato: `npm run gen:api`.
 */
import type { components, operations } from './schema'

type Schemas = components['schemas']

export type Perfil = Schemas['Perfil']
export type Uf = Schemas['Uf']
export type Segmento = Schemas['Segmento']
export type Modalidade = Schemas['Modalidade']
export type Faixa = Schemas['Faixa']
export type Criterio = Schemas['Criterio']
export type Feedback = Schemas['Feedback']

export type EditalResumo = Schemas['EditalResumo']
export type FeedItem = Schemas['FeedItem']
export type FeedPagina = Schemas['FeedPagina']
export type EditalDetalhe = Schemas['EditalDetalhe']
export type Etapa = Schemas['Etapa']
export type Acompanhamento = Schemas['Acompanhamento']

export type CertidaoTipo = Schemas['CertidaoTipo']
export type CertidaoStatus = Schemas['CertidaoStatus']
export type Certidao = Schemas['Certidao']
export type CertidaoEntrada = Schemas['CertidaoEntrada']
export type CertidaoAtualizacao = Schemas['CertidaoAtualizacao']

export type AlertaTipo = Schemas['AlertaTipo']
export type Alerta = Schemas['Alerta']

export type ErroApi = Schemas['Erro']

/** Filtros de refinamento do feed (query string de GET /v1/feed). */
export type FiltrosFeed = NonNullable<operations['listarFeed']['parameters']['query']>
export type FiltrosAlertas = NonNullable<operations['listarAlertas']['parameters']['query']>
export type AcompanhamentosPagina =
  operations['listarAcompanhamentos']['responses'][200]['content']['application/json']
export type AlertasPagina = operations['listarAlertas']['responses'][200]['content']['application/json']
