import type { ArquivoCertidao } from './repositorio.js'

export const LIMITE_BYTES = 5 * 1024 * 1024

/**
 * Tipo pelo conteúdo (assinatura do arquivo), não pelo que o cliente declarou:
 * PDF (`%PDF`), JPG (`FF D8 FF`) e PNG (`89 50 4E 47 0D 0A 1A 0A`).
 */
export function detectarTipo(b: Buffer): ArquivoCertidao['tipo'] | null {
  if (b.length >= 4 && b.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  return null
}

export const EXTENSAO: Record<ArquivoCertidao['tipo'], string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}
