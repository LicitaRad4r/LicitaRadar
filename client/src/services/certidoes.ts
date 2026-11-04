import type { CertidaoDTO } from './dto'
import { api, desembrulhar } from './http'

/** GET /v1/certidoes. Só para o decisor; vem da mais urgente para a menos urgente. */
export async function listarCertidoes(): Promise<CertidaoDTO[]> {
  const { itens } = await desembrulhar(api.GET('/v1/certidoes'))
  return itens
}

export type RenovacaoDTO = { certidaoId: string; arquivo: File; validade: string }

/** PUT /v1/certidoes/{id}/renovacao, com o arquivo novo e a nova validade (multipart). */
export function renovarCertidao({ certidaoId, arquivo, validade }: RenovacaoDTO): Promise<CertidaoDTO> {
  return desembrulhar(
    api.PUT('/v1/certidoes/{certidaoId}/renovacao', {
      params: { path: { certidaoId } },
      // O contrato descreve o arquivo como binário; no navegador ele é um File dentro de um FormData.
      body: { arquivo: arquivo as unknown as string, validade },
      bodySerializer: (corpo) => {
        const dados = new FormData()
        dados.append('arquivo', corpo.arquivo as unknown as Blob)
        dados.append('validade', corpo.validade)
        return dados
      },
    }),
  )
}
