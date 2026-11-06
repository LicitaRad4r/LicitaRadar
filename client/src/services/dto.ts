/**
 * DTOs da API: o formato exato do que vai e volta no HTTP, gerado a partir de server/openapi.yaml (v0.3).
 * As telas usam estes tipos; nunca declaram à mão o formato de uma resposta.
 * Para atualizar depois de uma mudança no contrato: `npm run gen:api`.
 */
import type { components, operations } from './schema'

type Schemas = components['schemas']

export type PerfilDTO = Schemas['Perfil']
export type Uf = Schemas['Uf']
export type Segmento = Schemas['Segmento']
export type Modalidade = Schemas['Modalidade']
export type Faixa = Schemas['Faixa']

export type FeedItemDTO = Schemas['FeedItem']
export type FeedPaginaDTO = Schemas['FeedPagina']
export type MotivoVazio = NonNullable<FeedPaginaDTO['motivoVazio']>
export type EditalDetalheDTO = Schemas['EditalDetalhe']

export type CertidaoDTO = Schemas['Certidao']
export type CertidaoStatus = Schemas['CertidaoStatus']

export type ErroDTO = Schemas['Erro']
export type CodigoErroApi = ErroDTO['codigo']

/** Filtros e paginação do GET /v1/feed (query string). */
export type FiltrosFeedDTO = NonNullable<operations['listarFeed']['parameters']['query']>
