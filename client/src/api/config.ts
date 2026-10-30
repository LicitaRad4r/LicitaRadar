/** Endereço base da API. Em desenvolvimento local é o container `api` do docker compose. */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333').replace(/\/$/, '')

/** Quando `true`, as chamadas são respondidas pelo mock (MSW) em vez da API real. */
export const API_MOCK = import.meta.env.VITE_API_MOCK === 'true'
