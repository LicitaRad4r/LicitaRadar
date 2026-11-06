import { describe, expect, it } from 'vitest'
import { ErroDeConfiguracao, lerConfigFirebase } from './configFirebase'

const completo = {
  VITE_FIREBASE_API_KEY: 'chave',
  VITE_FIREBASE_AUTH_DOMAIN: 'licitaradar.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'licitaradar',
}

describe('lerConfigFirebase', () => {
  it('fora do emulador, usa as variáveis informadas', () => {
    expect(lerConfigFirebase(completo)).toEqual({
      apiKey: 'chave',
      authDomain: 'licitaradar.firebaseapp.com',
      projectId: 'licitaradar',
    })
  })

  it.each(Object.keys(completo))('fora do emulador, recusa quando falta %s', (nome) => {
    const env = { ...completo, [nome]: '' }
    expect(() => lerConfigFirebase(env)).toThrow(ErroDeConfiguracao)
    try {
      lerConfigFirebase(env)
    } catch (erro) {
      expect((erro as ErroDeConfiguracao).faltando).toEqual([nome])
    }
  })

  it('fora do emulador, lista todas as variáveis que faltam', () => {
    try {
      lerConfigFirebase({})
      expect.unreachable('deveria recusar')
    } catch (erro) {
      expect((erro as ErroDeConfiguracao).faltando).toEqual(Object.keys(completo))
    }
  })

  it('no emulador, aceita os valores de demonstração', () => {
    expect(lerConfigFirebase({ VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://localhost:9099' })).toEqual({
      apiKey: 'demo-api-key',
      authDomain: undefined,
      projectId: 'demo-licitaradar',
    })
  })
})
