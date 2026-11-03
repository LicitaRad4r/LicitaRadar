import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { ArmazenamentoArquivos } from '../certidoes/repositorio.js'

/**
 * Guarda os arquivos em disco (pasta `ARQUIVOS_DIR`, padrão `./.arquivos`, ignorada pelo git).
 * Serve ao desenvolvimento e ao CP2. Produção (ex.: Cloud Storage) depende de ADR / Tech Lead.
 */
export function armazenamentoLocal(raiz = process.env.ARQUIVOS_DIR ?? './.arquivos'): ArmazenamentoArquivos {
  const base = resolve(raiz)
  return {
    async salvar(chave, conteudo) {
      const destino = resolve(join(base, chave))
      if (!destino.startsWith(base + sep)) throw new Error('chave inválida') // sem escapar da pasta
      await mkdir(dirname(destino), { recursive: true })
      await writeFile(destino, conteudo)
    },
  }
}
