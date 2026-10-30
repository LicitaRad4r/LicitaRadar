import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderizar } from '@/testes/utils'
import App from './App'

describe('App', () => {
  it('mostra o nome do produto e o feed na página inicial', async () => {
    renderizar(<App />)
    expect(screen.getByRole('link', { name: 'LicitaRadar' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Editais para você' })).toBeInTheDocument()
  })

  it('mostra quando a API responde', async () => {
    renderizar(<App />)
    expect(await screen.findByText(/API (no ar|simulada)/)).toBeInTheDocument()
  })
})
