/**
 * Tipos do contrato da API, gerados a partir de server/openapi.yaml (v0.3).
 * Para atualizar depois de uma mudança no contrato: `npm run gen:api`.
 */
import type { components, operations } from './schema'

type Schemas = components['schemas']

export type Perfil = Schemas['Perfil']
export type Uf = Schemas['Uf']
export type Segmento = Schemas['Segmento']
export type Modalidade = Schemas['Modalidade']
export type Faixa = Schemas['Faixa']

export type FeedItem = Schemas['FeedItem']
export type FeedPagina = Schemas['FeedPagina']
export type MotivoVazio = NonNullable<FeedPagina['motivoVazio']>
export type EditalDetalhe = Schemas['EditalDetalhe']

export type Certidao = Schemas['Certidao']
export type CertidaoStatus = Schemas['CertidaoStatus']

export type ErroApi = Schemas['Erro']
export type CodigoErroApi = ErroApi['codigo']

/** Filtros e paginação do GET /v1/feed (query string). */
export type FiltrosFeed = NonNullable<operations['listarFeed']['parameters']['query']>
