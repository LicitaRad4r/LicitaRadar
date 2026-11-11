import type { CertidaoDTO, EditalDetalheDTO, Faixa, Modalidade, PerfilDTO, Uf } from '@/services/dto'
import { diasEntre, hojeEmBrasilia, somarDias } from '@/lib/datas'

/**
 * "Banco" em memória do mock, no formato do contrato v0.3. As ações (salvar perfil, renovar certidão)
 * alteram estes dados enquanto a página estiver aberta; recarregar volta ao estado inicial.
 */

const HORA_MS = 60 * 60 * 1000
/** Instante `dias` à frente (ou atrás), sempre às 18h de Brasília para não cair na virada do dia. */
function instante(dias: number) {
  return new Date(`${somarDias(hojeEmBrasilia(), dias)}T18:00:00-03:00`).toISOString()
}

export function faixaDoScore(score: number): Faixa {
  if (score >= 80) return 'alta'
  if (score >= 50) return 'media'
  return 'baixa'
}

type EditalBase = {
  id: string
  titulo: string
  orgao: string
  uf: Uf
  municipio: string | null
  modalidade: Modalidade
  valorEstimado: number | null
  diasAtePrazo: number
  diasDesdePublicacao: number
  score: number
  descricao?: string
}

const editaisBase: EditalBase[] = [
  {
    id: '00394460000141-1-000123/2026',
    titulo: 'Aquisição de notebooks e monitores para unidades de atenção básica',
    orgao: 'Ministério da Saúde',
    uf: 'DF',
    municipio: 'Brasília',
    modalidade: 'pregao_eletronico',
    valorEstimado: 1_250_000,
    diasAtePrazo: 9,
    diasDesdePublicacao: 2,
    score: 94,
    descricao: 'Registro de preços para eventual aquisição de equipamentos de informática.',
  },
  {
    id: '26989350000116-1-000045/2026',
    titulo: 'Contratação de serviço de suporte técnico em TI (service desk)',
    orgao: 'Universidade de Brasília',
    uf: 'DF',
    municipio: 'Brasília',
    modalidade: 'pregao_eletronico',
    valorEstimado: 820_000,
    diasAtePrazo: 12,
    diasDesdePublicacao: 1,
    score: 88,
  },
  {
    id: '01409580000138-1-000310/2026',
    titulo: 'Aquisição de licenças de software de gestão escolar',
    orgao: 'Secretaria de Educação de Goiás',
    uf: 'GO',
    municipio: 'Goiânia',
    modalidade: 'concorrencia',
    valorEstimado: 2_400_000,
    diasAtePrazo: 20,
    diasDesdePublicacao: 4,
    score: 81,
  },
  {
    id: '00489828000155-1-000077/2026',
    titulo: 'Fornecimento de computadores para laboratórios de informática',
    orgao: 'Prefeitura de Anápolis',
    uf: 'GO',
    municipio: 'Anápolis',
    modalidade: 'pregao_eletronico',
    valorEstimado: 390_000,
    diasAtePrazo: 2,
    diasDesdePublicacao: 3,
    score: 80,
  },
  {
    id: '00360305000104-1-000512/2026',
    titulo: 'Manutenção preventiva e corretiva de impressoras',
    orgao: 'Caixa Econômica Federal',
    uf: 'DF',
    municipio: 'Brasília',
    modalidade: 'pregao_eletronico',
    valorEstimado: 180_000,
    diasAtePrazo: 5,
    diasDesdePublicacao: 6,
    score: 63,
  },
  {
    id: '08241739000105-1-000098/2026',
    titulo: 'Aquisição de nobreaks e estabilizadores',
    orgao: 'Tribunal Regional Eleitoral de Minas Gerais',
    uf: 'MG',
    municipio: 'Belo Horizonte',
    modalidade: 'dispensa',
    valorEstimado: 58_000,
    diasAtePrazo: 4,
    diasDesdePublicacao: 1,
    score: 55,
  },
  {
    id: '46395000000139-1-000204/2026',
    titulo: 'Serviço de digitalização de documentos do arquivo municipal',
    orgao: 'Prefeitura de São Paulo',
    uf: 'SP',
    municipio: 'São Paulo',
    modalidade: 'concorrencia',
    valorEstimado: 3_100_000,
    diasAtePrazo: 15,
    diasDesdePublicacao: 8,
    score: 47,
  },
  {
    id: '00038174000143-1-000031/2026',
    titulo: 'Locação de tablets para registro eletrônico de prontuário',
    orgao: 'Hospital Universitário de Brasília',
    uf: 'DF',
    municipio: 'Brasília',
    modalidade: 'pregao_eletronico',
    valorEstimado: null,
    diasAtePrazo: 7,
    diasDesdePublicacao: 5,
    score: 42,
  },
]

/** Mais editais gerados para o feed ter mais de uma página. */
const orgaosExtras = [
  ['Ministério da Educação', 'DF', 'Brasília'],
  ['Prefeitura de Aparecida de Goiânia', 'GO', 'Aparecida de Goiânia'],
  ['Instituto Federal de Goiás', 'GO', 'Goiânia'],
  ['Secretaria de Saúde do DF', 'DF', 'Brasília'],
  ['Prefeitura de Uberlândia', 'MG', 'Uberlândia'],
  ['Universidade Federal de Goiás', 'GO', 'Goiânia'],
  ['Câmara Legislativa do DF', 'DF', 'Brasília'],
  ['Prefeitura de Luziânia', 'GO', 'Luziânia'],
] as const

const titulosExtras = [
  'Aquisição de switches e roteadores para a rede corporativa',
  'Contratação de solução de backup em nuvem',
  'Fornecimento de licenças de antivírus corporativo',
  'Aquisição de projetores multimídia para salas de aula',
  'Serviço de desenvolvimento e manutenção de sistemas web',
  'Aquisição de leitores de código de barras e impressoras térmicas',
  'Locação de computadores com suporte técnico incluso',
  'Contratação de link de internet dedicado',
  'Aquisição de tablets para agentes comunitários de saúde',
  'Serviço de cabeamento estruturado em prédio administrativo',
  'Fornecimento de cartuchos e toners',
  'Aquisição de servidores de rack e storage',
  'Contratação de treinamento em segurança da informação',
  'Aquisição de webcams e headsets para teleatendimento',
  'Implantação de sistema de protocolo eletrônico',
  'Aquisição de nobreaks para o data center',
] as const

const modalidades: Modalidade[] = ['pregao_eletronico', 'concorrencia', 'dispensa']

titulosExtras.forEach((titulo, i) => {
  const [orgao, uf, municipio] = orgaosExtras[i % orgaosExtras.length]
  editaisBase.push({
    id: `${String(10_000_000_000_000 + i * 7_919_311).padStart(14, '0')}-1-${String(400 + i).padStart(6, '0')}/2026`,
    titulo,
    orgao,
    uf,
    municipio,
    modalidade: modalidades[i % modalidades.length],
    valorEstimado: i % 5 === 4 ? null : 40_000 + ((i * 137_000) % 1_900_000),
    diasAtePrazo: 3 + ((i * 5) % 25),
    diasDesdePublicacao: (i % 9) + 1,
    score: 78 - i * 4,
  })
})

const perfilInicial: PerfilDTO = {
  empresaId: 'empresa-demo',
  ufs: ['DF', 'GO'],
  termosChave: ['notebook', 'computador', 'suporte técnico', 'software'],
  segmentos: ['ti'],
  modalidades: ['pregao_eletronico'],
  valorMinimo: 50_000,
  valorMaximo: 3_000_000,
  prazoMinimoDiasUteis: 3,
}

/** Mesma regra do contrato: dias de calendário em Brasília até a validade. */
export function calcularCertidao(dados: { id: string; nome: string; validade: string }): CertidaoDTO {
  const diasRestantes = diasEntre(hojeEmBrasilia(), dados.validade)
  const status: CertidaoDTO['status'] =
    diasRestantes < 0 ? 'vencida' : diasRestantes <= 15 ? 'urgente' : diasRestantes <= 30 ? 'atencao' : 'em_dia'
  return { ...dados, diasRestantes, status }
}

function criarEstadoInicial() {
  const hoje = hojeEmBrasilia()
  const certidoes = [
    { id: 'cert-trabalhista', nome: 'CNDT (débitos trabalhistas)', validade: somarDias(hoje, -3) },
    { id: 'cert-fgts', nome: 'CRF do FGTS', validade: somarDias(hoje, 6) },
    { id: 'cert-municipal', nome: 'Certidão negativa municipal', validade: somarDias(hoje, 22) },
    { id: 'cert-federal', nome: 'CND Receita Federal e PGFN', validade: somarDias(hoje, 120) },
    { id: 'cert-estadual', nome: 'Certidão negativa do DF', validade: somarDias(hoje, 60) },
  ].map(calcularCertidao)

  return { perfil: structuredClone(perfilInicial), certidoes }
}

export let banco = criarEstadoInicial()

/** Volta ao estado inicial (usado entre um teste e outro). */
export function reiniciarBanco() {
  banco = criarEstadoInicial()
}

export function editais(): EditalDetalheDTO[] {
  return editaisBase.map(({ diasAtePrazo, diasDesdePublicacao, ...edital }) => ({
    ...edital,
    faixa: faixaDoScore(edital.score),
    prazo: instante(diasAtePrazo),
    dataPublicacao: new Date(Date.parse(instante(-diasDesdePublicacao)) - 6 * HORA_MS).toISOString(),
    linkPncp: 'https://pncp.gov.br/app/editais',
  }))
}
