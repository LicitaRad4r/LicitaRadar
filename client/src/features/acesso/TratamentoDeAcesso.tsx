import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { sessao } from '@/lib/sessao'
import { aoErroDeAcesso } from '@/services/http'

/**
 * Encerra a sessão com o aviso "Sua sessão expirou" e leva ao login; depois de entrar, a pessoa volta
 * para onde estava. Usado no 401 da API e na saída por inatividade (US02).
 */
export function useEncerrarSessaoExpirada() {
  const navegar = useNavigate()
  const local = useLocation()
  const queryClient = useQueryClient()
  // A página atual muda a cada navegação; a função lê sempre a mais recente sem mudar de identidade.
  const localAtual = useRef(local)
  useEffect(() => {
    localAtual.current = local
  }, [local])

  return useCallback(() => {
    const de = localAtual.current
    // Vários pedidos podem voltar 401 juntos: só a primeira vez leva ao login.
    if (de.pathname === '/login') return
    queryClient.clear()
    void navegar('/login', { replace: true, state: { voltar: de } })
    void sessao.sair('sessao-expirada')
  }, [navegar, queryClient])
}

/**
 * Tratamento central dos erros de acesso (Jornada 4). Ouve toda resposta da API, de qualquer tela:
 * - 401: encerra a sessão e leva ao login; depois de entrar, a pessoa volta para onde estava.
 * - 403 ACESSO_NEGADO: abre a página "Acesso Negado".
 * O 403 EMPRESA_NAO_CONFIGURADA não é falta de permissão e continua sendo mostrado na própria tela.
 */
export function useTratamentoDeAcesso() {
  const navegar = useNavigate()
  const local = useLocation()
  const encerrarSessaoExpirada = useEncerrarSessaoExpirada()
  const localAtual = useRef(local)
  useEffect(() => {
    localAtual.current = local
  }, [local])

  useEffect(
    () =>
      aoErroDeAcesso((erro) => {
        if (erro === 'NAO_AUTENTICADO') {
          encerrarSessaoExpirada()
          return
        }
        const de = localAtual.current
        if (de.pathname !== '/acesso-negado') {
          void navegar('/acesso-negado', { state: { de: de.pathname } })
        }
      }),
    [navegar, encerrarSessaoExpirada],
  )
}
