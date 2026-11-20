import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { passouDoLimiteDeInatividade, registrarAtividade } from '@/lib/inatividade'
import { useEncerrarSessaoExpirada } from './TratamentoDeAcesso'

const EVENTOS_DE_ATIVIDADE = ['pointerdown', 'keydown', 'scroll', 'wheel'] as const

// O navegador atrasa timers de abas paradas; por isso também se confere quando a aba volta a ficar visível.
const INTERVALO_DE_CONFERENCIA_MS = 60_000

// A rolagem dispara dezenas de eventos por segundo e não precisa gravar no localStorage a cada um.
const INTERVALO_MINIMO_ENTRE_REGISTROS_MS = 5_000

/** Encerra a sessão depois de 4 horas sem clique, tecla, rolagem ou troca de página, em qualquer aba (US02). */
export function useSaidaPorInatividade(logado: boolean) {
  const encerrarSessaoExpirada = useEncerrarSessaoExpirada()
  const encerrarAtual = useRef(encerrarSessaoExpirada)
  useEffect(() => {
    encerrarAtual.current = encerrarSessaoExpirada
  }, [encerrarSessaoExpirada])

  const { pathname } = useLocation()

  // Confere antes de registrar: quem reabre o app depois de 4 horas parado precisa sair, não renovar o prazo.
  useEffect(() => {
    if (!logado) return
    if (passouDoLimiteDeInatividade()) encerrarAtual.current()
    else registrarAtividade()
  }, [logado, pathname])

  useEffect(() => {
    if (!logado) return
    let ultimoRegistro = 0

    function aoInteragir() {
      const agora = Date.now()
      if (agora - ultimoRegistro < INTERVALO_MINIMO_ENTRE_REGISTROS_MS) return
      ultimoRegistro = agora
      if (passouDoLimiteDeInatividade(agora)) encerrarAtual.current()
      else registrarAtividade(agora)
    }
    function conferir() {
      if (passouDoLimiteDeInatividade()) encerrarAtual.current()
    }
    function conferirAoVoltarParaAba() {
      if (document.visibilityState === 'visible') conferir()
    }

    for (const evento of EVENTOS_DE_ATIVIDADE) {
      window.addEventListener(evento, aoInteragir, { capture: true, passive: true })
    }
    document.addEventListener('visibilitychange', conferirAoVoltarParaAba)
    const conferencia = setInterval(conferir, INTERVALO_DE_CONFERENCIA_MS)

    return () => {
      for (const evento of EVENTOS_DE_ATIVIDADE) window.removeEventListener(evento, aoInteragir, { capture: true })
      document.removeEventListener('visibilitychange', conferirAoVoltarParaAba)
      clearInterval(conferencia)
    }
  }, [logado])
}
