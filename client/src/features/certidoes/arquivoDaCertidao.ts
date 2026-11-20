import { z } from 'zod'

/** Mesmas regras do contrato: PDF, JPG ou PNG, de 1 byte até 5 MB (5 MB exatos é aceito). */
export const LIMITE_ARQUIVO = 5 * 1024 * 1024
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png']
const EXTENSOES_ACEITAS = /\.(pdf|jpe?g|png)$/i

export const esquemaDoArquivoDaCertidao = z
  .custom<FileList>()
  .refine((lista) => lista?.length === 1, 'Escolha o arquivo da certidão nova.')
  .refine((lista) => {
    const arquivo = lista?.[0]
    return !arquivo || TIPOS_ACEITOS.includes(arquivo.type) || EXTENSOES_ACEITAS.test(arquivo.name)
  }, 'Envie um PDF, JPG ou PNG.')
  .refine((lista) => !lista?.[0] || lista[0].size > 0, 'O arquivo está vazio.')
  .refine((lista) => !lista?.[0] || lista[0].size <= LIMITE_ARQUIVO, 'O arquivo passa de 5 MB.')
