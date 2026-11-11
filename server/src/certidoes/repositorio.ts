export interface ArquivoCertidao {
  /** Chave no armazenamento (ex.: `certidoes/emp-a/cert-1/1760000000000.pdf`). */
  chave: string
  tipo: 'application/pdf' | 'image/jpeg' | 'image/png'
  tamanho: number
}

export interface CertidaoRegistro {
  id: string
  empresaId: string
  nome: string
  /** `AAAA-MM-DD`. */
  validade: string
  /** Arquivo ativo. */
  arquivo: ArquivoCertidao
  /** Arquivos substituídos por renovações: ficam inativos, nunca apagados (US15). */
  anteriores: ArquivoCertidao[]
}

export interface CertidaoRepo {
  listar(empresaId: string): Promise<CertidaoRegistro[]>
  obter(id: string): Promise<CertidaoRegistro | null>
  salvar(c: CertidaoRegistro): Promise<void>
}

/** Onde os arquivos ficam guardados. Em desenvolvimento, disco local; em produção depende de ADR. */
export interface ArmazenamentoArquivos {
  salvar(chave: string, conteudo: Buffer, tipo: string): Promise<void>
}
