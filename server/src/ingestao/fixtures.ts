import { diaBrasilia, somarDias, somarDiasUteis } from '../dominio/tempo.js'
import type { FontePncp } from './cliente-pncp.js'

/**
 * Fixtures da demo: contratações no MESMO formato da API de consulta do PNCP, para o adapter
 * rodar o caminho real (validação, normalização, score). Os prazos são relativos a `agora`.
 * Inclui casos que a ingestão deve ignorar (pregão presencial, sem prazo) e um valor sigiloso.
 */
export function contratacoesFixture(agora: Date) {
  const hoje = diaBrasilia(agora)
  const limite = (diasUteis: number) => `${somarDiasUteis(hoje, diasUteis)}T15:00:00`
  const publicada = (diasAtras: number) => `${somarDias(hoje, -diasAtras)}T09:30:00`
  const item = (n: number, o: {
    modalidadeId: number
    objeto: string
    complemento?: string
    orgao: string
    uf: string
    municipio: string
    valor: number
    diasUteis: number | null
    diasAtras: number
  }) => ({
    numeroControlePNCP: `00394460000141-1-${String(n).padStart(6, '0')}/2026`,
    numeroCompra: String(n),
    anoCompra: 2026,
    modalidadeId: o.modalidadeId,
    objetoCompra: o.objeto,
    informacaoComplementar: o.complemento ?? '',
    valorTotalEstimado: o.valor,
    dataPublicacaoPncp: publicada(o.diasAtras),
    dataEncerramentoProposta: o.diasUteis === null ? null : limite(o.diasUteis),
    orgaoEntidade: { razaoSocial: o.orgao },
    unidadeOrgao: { nomeUnidade: o.orgao, municipioNome: o.municipio, ufSigla: o.uf },
  })

  return [
    item(101, { modalidadeId: 6, objeto: 'Aquisição de notebooks para a rede de ensino', complemento: 'Notebooks com garantia de 36 meses.', orgao: 'Secretaria de Educação do DF', uf: 'DF', municipio: 'Brasília', valor: 180000, diasUteis: 9, diasAtras: 1 }),
    item(102, { modalidadeId: 6, objeto: 'Contratação de serviços de TI', complemento: 'Inclui fornecimento de notebook para a equipe.', orgao: 'Prefeitura de Goiânia', uf: 'GO', municipio: 'Goiânia', valor: 420000, diasUteis: 6, diasAtras: 2 }),
    item(103, { modalidadeId: 6, objeto: 'Aquisição de notebooks', complemento: 'Notebooks para a rede estadual.', orgao: 'Secretaria de Educação do RS', uf: 'RS', municipio: 'Porto Alegre', valor: 250000, diasUteis: 9, diasAtras: 3 }),
    item(104, { modalidadeId: 4, objeto: 'Registro de preços de impressoras multifuncionais', orgao: 'Tribunal Regional do Trabalho', uf: 'DF', municipio: 'Brasília', valor: 320000, diasUteis: 12, diasAtras: 2 }),
    item(105, { modalidadeId: 8, objeto: 'Compra de notebook para a diretoria', orgao: 'Fundação Hospitalar de Goiás', uf: 'GO', municipio: 'Goiânia', valor: 0, diasUteis: 5, diasAtras: 1 }),
    item(106, { modalidadeId: 6, objeto: 'Serviços de limpeza e conservação predial', orgao: 'Tribunal de Contas', uf: 'DF', municipio: 'Brasília', valor: 180000, diasUteis: 9, diasAtras: 4 }),
    item(107, { modalidadeId: 6, objeto: 'Aquisição de notebooks (lote grande)', orgao: 'Ministério da Defesa', uf: 'DF', municipio: 'Brasília', valor: 900000, diasUteis: 9, diasAtras: 4 }),
    item(108, { modalidadeId: 6, objeto: 'Aquisição de notebooks com prazo curto', orgao: 'Prefeitura de Brasília', uf: 'DF', municipio: 'Brasília', valor: 180000, diasUteis: 1, diasAtras: 5 }),
    // Ignoradas pela ingestão:
    item(109, { modalidadeId: 7, objeto: 'Aquisição de notebooks (pregão presencial)', orgao: 'Prefeitura de Anápolis', uf: 'GO', municipio: 'Anápolis', valor: 150000, diasUteis: 9, diasAtras: 2 }),
    item(110, { modalidadeId: 6, objeto: 'Aquisição de notebooks sem prazo informado', orgao: 'Câmara Municipal', uf: 'DF', municipio: 'Brasília', valor: 150000, diasUteis: null, diasAtras: 2 }),
  ]
}

/** Fonte de demonstração: não acessa a internet. */
export const fonteFixture: FontePncp = async (agora) => ({ contratacoes: contratacoesFixture(agora), falhas: [] })
