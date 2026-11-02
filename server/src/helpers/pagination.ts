export interface PaginationParams {
  limite?: number
  pagina?: number
}

export interface PaginatedResult<T> {
  dados: T[]
  limite: number
  pagina: number
}

export function aplicarPaginacao(params: PaginationParams) {
  const limiteMaximo = 100
  const limiteBruto = params.limite ?? 20
  const limite = Math.min(Math.max(limiteBruto, 1), limiteMaximo)
  const pagina = Math.max(params.pagina ?? 1, 1)
  const offset = (pagina - 1) * limite

  return {
    limit: limite,
    offset,
    pagina,
  }
}