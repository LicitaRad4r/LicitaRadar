import { z } from 'zod'
import type { FiltrosFeedDTO, Modalidade, Uf } from '@/services/dto'
import { hojeEmBrasilia, somarDias } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formatar'
import { UFS } from '@/lib/ufs'
import { ROTULO_MODALIDADE } from './rotulos'

export const TAMANHO_PAGINA = 10

/** Opções de "encerra em até N dias" e "publicado nos últimos N dias". */
export const JANELAS_DE_DIAS = [3, 7, 15, 30] as const
export type JanelaDeDias = (typeof JANELAS_DE_DIAS)[number]

const MODALIDADES = Object.keys(ROTULO_MODALIDADE) as Modalidade[]

export type Filtros = {
  q: string
  ufs: Uf[]
  municipio: string
  modalidade: Modalidade | null
  valorMin: number | null
  valorMax: number | null
  /** Encerra em até N dias. */
  prazo: JanelaDeDias | null
  /** Publicado nos últimos N dias. */
  publicado: JanelaDeDias | null
  page: number
}

export const FILTROS_VAZIOS: Filtros = {
  q: '',
  ufs: [],
  municipio: '',
  modalidade: null,
  valorMin: null,
  valorMax: null,
  prazo: null,
  publicado: null,
  page: 1,
}

/*
 * Na URL, os nomes seguem os da API (q, uf, municipio, modalidade, valorMin, valorMax, page).
 * Prazo e publicação vão como janelas em dias, que viram datas só na hora da consulta,
 * assim um link guardado continua valendo amanhã:
 * /?q=notebook&uf=DF&uf=GO&modalidade=pregao_eletronico&valorMin=50000&prazo=7&page=2
 */

// Valores inválidos na URL (alguém editou o link na mão) são ignorados, nunca quebram a tela.
const valorEmReais = z.coerce.number().int().nonnegative().nullable().catch(null)
const janela = z.coerce
  .number()
  .refine((n): n is JanelaDeDias => (JANELAS_DE_DIAS as readonly number[]).includes(n))
  .nullable()
  .catch(null)

const esquemaUrl = z.object({
  q: z.string().trim().max(100).catch(''),
  ufs: z.array(z.string()).transform((ufs) =>
    [...new Set(ufs.flatMap((uf) => uf.split(',')).map((uf) => uf.trim().toUpperCase()))].filter(
      (uf): uf is Uf => (UFS as readonly string[]).includes(uf),
    ),
  ),
  municipio: z.string().trim().max(80).catch(''),
  modalidade: z.enum(MODALIDADES as [Modalidade, ...Modalidade[]]).nullable().catch(null),
  valorMin: valorEmReais,
  valorMax: valorEmReais,
  prazo: janela,
  publicado: janela,
  page: z.coerce.number().int().min(1).catch(1),
})

export function lerFiltros(params: URLSearchParams): Filtros {
  // Parâmetro vazio (?q=) conta como ausente.
  const valor = (nome: string) => params.get(nome) || null
  const lido = esquemaUrl.parse({
    q: valor('q') ?? '',
    ufs: params.getAll('uf'),
    municipio: valor('municipio') ?? '',
    modalidade: valor('modalidade'),
    valorMin: valor('valorMin'),
    valorMax: valor('valorMax'),
    prazo: valor('prazo'),
    publicado: valor('publicado'),
    page: valor('page') ?? 1,
  })

  let { valorMin, valorMax } = lido
  // Faixa invertida no link: troca as pontas em vez de a API responder 400.
  if (valorMin !== null && valorMax !== null && valorMin > valorMax) [valorMin, valorMax] = [valorMax, valorMin]

  return {
    ...lido,
    valorMin,
    valorMax,
    prazo: lido.prazo as JanelaDeDias | null,
    publicado: lido.publicado as JanelaDeDias | null,
  }
}

export function escreverFiltros(filtros: Filtros): URLSearchParams {
  const params = new URLSearchParams()
  if (filtros.q) params.set('q', filtros.q)
  filtros.ufs.forEach((uf) => params.append('uf', uf))
  if (filtros.municipio) params.set('municipio', filtros.municipio)
  if (filtros.modalidade) params.set('modalidade', filtros.modalidade)
  if (filtros.valorMin !== null) params.set('valorMin', String(filtros.valorMin))
  if (filtros.valorMax !== null) params.set('valorMax', String(filtros.valorMax))
  if (filtros.prazo !== null) params.set('prazo', String(filtros.prazo))
  if (filtros.publicado !== null) params.set('publicado', String(filtros.publicado))
  if (filtros.page > 1) params.set('page', String(filtros.page))
  return params
}

/** Converte os filtros da tela para os parâmetros do GET /v1/feed. Datas em dias de Brasília, como no contrato. */
export function paraConsulta(filtros: Filtros, hoje = hojeEmBrasilia()): FiltrosFeedDTO {
  return {
    ...(filtros.q && { q: filtros.q }),
    ...(filtros.ufs.length > 0 && { uf: filtros.ufs }),
    ...(filtros.municipio && { municipio: filtros.municipio }),
    ...(filtros.modalidade && { modalidade: filtros.modalidade }),
    ...(filtros.valorMin !== null && { valorMin: filtros.valorMin }),
    ...(filtros.valorMax !== null && { valorMax: filtros.valorMax }),
    ...(filtros.prazo !== null && { prazoDe: hoje, prazoAte: somarDias(hoje, filtros.prazo) }),
    ...(filtros.publicado !== null && { publicadoDe: somarDias(hoje, -filtros.publicado) }),
    page: filtros.page,
    pageSize: TAMANHO_PAGINA,
  }
}

export type Etiqueta = {
  /** Chave estável para o React e para os testes. */
  id: string
  rotulo: string
  /** Mudança que remove só este filtro. */
  remover: (filtros: Filtros) => Partial<Filtros>
}

export function textoValor(minimo: number | null, maximo: number | null) {
  if (minimo !== null && maximo !== null) return `De ${formatarMoeda(minimo)} a ${formatarMoeda(maximo)}`
  if (minimo !== null) return `A partir de ${formatarMoeda(minimo)}`
  if (maximo !== null) return `Até ${formatarMoeda(maximo)}`
  return ''
}

/** Uma etiqueta removível para cada filtro ativo, na ordem em que aparecem na barra. */
export function etiquetas(filtros: Filtros): Etiqueta[] {
  const lista: Etiqueta[] = []
  if (filtros.q) lista.push({ id: 'q', rotulo: `"${filtros.q}"`, remover: () => ({ q: '' }) })
  for (const uf of filtros.ufs) {
    lista.push({ id: `uf-${uf}`, rotulo: uf, remover: (f) => ({ ufs: f.ufs.filter((u) => u !== uf) }) })
  }
  if (filtros.municipio) {
    lista.push({ id: 'municipio', rotulo: filtros.municipio, remover: () => ({ municipio: '' }) })
  }
  if (filtros.modalidade) {
    lista.push({
      id: 'modalidade',
      rotulo: ROTULO_MODALIDADE[filtros.modalidade],
      remover: () => ({ modalidade: null }),
    })
  }
  if (filtros.valorMin !== null || filtros.valorMax !== null) {
    lista.push({
      id: 'valor',
      rotulo: textoValor(filtros.valorMin, filtros.valorMax),
      remover: () => ({ valorMin: null, valorMax: null }),
    })
  }
  if (filtros.prazo !== null) {
    lista.push({ id: 'prazo', rotulo: `Encerra em até ${filtros.prazo} dias`, remover: () => ({ prazo: null }) })
  }
  if (filtros.publicado !== null) {
    lista.push({
      id: 'publicado',
      rotulo: `Publicado nos últimos ${filtros.publicado} dias`,
      remover: () => ({ publicado: null }),
    })
  }
  return lista
}
