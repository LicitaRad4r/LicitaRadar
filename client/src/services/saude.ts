import { api, desembrulhar } from './http'

/** GET /health: indica se a API está no ar (rota pública). */
export function obterSaude() {
  return desembrulhar(api.GET('/health'))
}
