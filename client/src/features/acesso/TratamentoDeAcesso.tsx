import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { sessao } from '@/lib/sessao'
import { aoErroDeAcesso } from '@/services/http'

/**
 * Tratamento central dos erros de acesso (Jornada 4). Ouve toda resposta da API, de qualquer tela:
 * - 401: encerra a sessão e leva ao login; depois de entrar, a pessoa volta para onde estava.
 * - 403 ACESSO_NEGADO: abre a página "Acesso Negado".
 * O 403 EMPRESA_NAO_CONFIGURADA não é falta de permissão e continua sendo mostrado na própria tela.
 */
export function useTratamentoDeAcesso() {
  const navegar = useNavigate()
  const local = useLocation()
  const queryClient = useQueryClient()
  // A página atual muda a cada navegação; o ouvinte lê sempre a mais recente sem se reinscrever.
  const localAtual = useRef(local)
  useEffect(() => {
    localAtual.current = local
  }, [local])

  useEffect(
    () =>
      aoErroDeAcesso((erro) => {
        const de = localAtual.current
        if (erro === 'NAO_AUTENTICADO') {
          // Vários pedidos podem voltar 401 juntos: só a primeira vez leva ao login.
          if (de.pathname === '/login') return
          queryClient.clear()
          void navegar('/login', { replace: true, state: { voltar: de } })
          void sessao.sair('sessao-expirada')
          return
        }
        if (de.pathname !== '/acesso-negado') {
          void navegar('/acesso-negado', { state: { de: de.pathname } })
        }
      }),
    [navegar, queryClient],
  )
}
