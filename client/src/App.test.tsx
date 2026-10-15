import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('mostra o nome do produto', () => {
    render(<App />)
    expect(screen.getByText('LicitaRadar')).toBeInTheDocument()
  })
})