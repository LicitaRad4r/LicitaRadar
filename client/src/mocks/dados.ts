import type { Acompanhamento, Alerta, Certidao, EditalDetalhe, Feedback, Perfil } from '@/api/tipos'

/**
 * "Banco" em memória do mock. As ações (salvar perfil, cadastrar certidão...) alteram estes dados
 * enquanto a página estiver aberta; recarregar volta ao estado inicial.
 */

const DIA = 24 * 60 * 60 * 1000
const hoje = () => new Date()
const emDias = (dias: number) => new Date(hoje().getTime() + dias * DIA)
const dataIso = (d: Date) => d.toISOString().slice(0, 10)

type EditalBase = Omit<EditalDetalhe, 'diasParaEncerrar' | 'feedback' | 'acompanhando' | 'dataLimiteProposta'> & {
  diasAtePrazo: number
}

const editaisBase: EditalBase[] = [
  {
    id: '00394460000141-1-000123-2026',
    orgao: 'Ministério da Saúde',
    objeto: 'Aquisição de notebooks e monitores para unidades de atenção básica',
    modalidade: 'pregao_eletronico',
    uf: 'DF',
    municipio: 'Brasília',
    valorEstimado: 1_250_000,
    dataPublicacao: emDias(-2).toISOString(),
    diasAtePrazo: 9,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 94,
    faixa: 'alta',
    criteriosAtendidos: ['termo', 'uf', 'valor', 'segmento', 'modalidade'],
    descricao: 'Registro de preços para eventual aquisição de equipamentos de informática.',
  },
  {
    id: '26989350000116-1-000045-2026',
    orgao: 'Universidade de Brasília',
    objeto: 'Contratação de serviço de suporte técnico em TI (service desk)',
    modalidade: 'pregao_eletronico',
    uf: 'DF',
    municipio: 'Brasília',
    valorEstimado: 820_000,
    dataPublicacao: emDias(-1).toISOString(),
    diasAtePrazo: 12,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 88,
    faixa: 'alta',
    criteriosAtendidos: ['termo', 'uf', 'segmento'],
    descricao: 'Serviço continuado de atendimento de primeiro e segundo nível.',
  },
  {
    id: '01409580000138-1-000310-2026',
    orgao: 'Secretaria de Educação de Goiás',
    objeto: 'Aquisição de licenças de software de gestão escolar',
    modalidade: 'concorrencia',
    uf: 'GO',
    municipio: 'Goiânia',
    valorEstimado: 2_400_000,
    dataPublicacao: emDias(-4).toISOString(),
    diasAtePrazo: 20,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 81,
    faixa: 'alta',
    criteriosAtendidos: ['termo', 'segmento', 'prazo'],
    descricao: 'Licenciamento e implantação de sistema de gestão para 300 escolas.',
  },
  {
    id: '00489828000155-1-000077-2026',
    orgao: 'Prefeitura de Anápolis',
    objeto: 'Fornecimento de computadores para laboratórios de informática',
    modalidade: 'pregao_eletronico',
    uf: 'GO',
    municipio: 'Anápolis',
    valorEstimado: 390_000,
    dataPublicacao: emDias(-3).toISOString(),
    diasAtePrazo: 2,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 76,
    faixa: 'alta',
    criteriosAtendidos: ['termo', 'valor'],
  },
  {
    id: '00360305000104-1-000512-2026',
    orgao: 'Caixa Econômica Federal',
    objeto: 'Manutenção preventiva e corretiva de impressoras',
    modalidade: 'pregao_eletronico',
    uf: 'DF',
    municipio: 'Brasília',
    valorEstimado: 180_000,
    dataPublicacao: emDias(-6).toISOString(),
    diasAtePrazo: 5,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 63,
    faixa: 'media',
    criteriosAtendidos: ['uf', 'segmento'],
  },
  {
    id: '08241739000105-1-000098-2026',
    orgao: 'Tribunal Regional Eleitoral de Minas Gerais',
    objeto: 'Aquisição de nobreaks e estabilizadores',
    modalidade: 'dispensa',
    uf: 'MG',
    municipio: 'Belo Horizonte',
    valorEstimado: 58_000,
    dataPublicacao: emDias(-1).toISOString(),
    diasAtePrazo: 4,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 55,
    faixa: 'media',
    criteriosAtendidos: ['valor', 'modalidade'],
  },
  {
    id: '46395000000139-1-000204-2026',
    orgao: 'Prefeitura de São Paulo',
    objeto: 'Serviço de digitalização de documentos do arquivo municipal',
    modalidade: 'concorrencia',
    uf: 'SP',
    municipio: 'São Paulo',
    valorEstimado: 3_100_000,
    dataPublicacao: emDias(-8).toISOString(),
    diasAtePrazo: 15,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 47,
    faixa: 'media',
    criteriosAtendidos: ['segmento'],
  },
  {
    id: '00038174000143-1-000031-2026',
    orgao: 'Hospital Universitário de Brasília',
    objeto: 'Locação de tablets para registro eletrônico de prontuário',
    modalidade: 'pregao_eletronico',
    uf: 'DF',
    municipio: 'Brasília',
    valorEstimado: null,
    dataPublicacao: emDias(-5).toISOString(),
    diasAtePrazo: 7,
    linkPncp: 'https://pncp.gov.br/app/editais',
    score: 42,
    faixa: 'media',
    criteriosAtendidos: ['uf'],
  },
]

const perfilInicial: Perfil = {
  ufs: ['DF', 'GO'],
  termosChave: ['notebook', 'computador', 'suporte técnico', 'software'],
  segmentos: ['ti'],
  modalidades: ['pregao_eletronico'],
  valorMinimo: 50_000,
  valorMaximo: 3_000_000,
  prazoMinimoDiasUteis: 3,
}

function statusPorValidade(dataValidade: string): Certidao['status'] {
  const dias = (new Date(`${dataValidade}T23:59:59`).getTime() - hoje().getTime()) / DIA
  if (dias < 0) return 'vencida'
  if (dias <= 30) return 'vence_em_breve'
  return 'valida'
}

function criarEstadoInicial() {
  const certidoes: Certidao[] = [
    { id: 'cert-1', tipo: 'federal', descricao: 'CND Receita Federal e PGFN', dataValidade: dataIso(emDias(120)) },
    { id: 'cert-2', tipo: 'fgts', descricao: 'CRF do FGTS', dataValidade: dataIso(emDias(12)) },
    { id: 'cert-3', tipo: 'trabalhista', descricao: 'CNDT', dataValidade: dataIso(emDias(-3)) },
    { id: 'cert-4', tipo: 'estadual', descricao: 'Certidão negativa do DF', dataValidade: dataIso(emDias(60)) },
  ].map((c) => ({ ...c, tipo: c.tipo as Certidao['tipo'], status: statusPorValidade(c.dataValidade) }))

  const alertas: Alerta[] = [
    {
      id: 'alerta-1',
      tipo: 'nova_oportunidade',
      titulo: 'Novo edital de alta aderência',
      mensagem: 'Ministério da Saúde: aquisição de notebooks e monitores.',
      editalId: editaisBase[0].id,
      certidaoId: null,
      criadoEm: emDias(-0.1).toISOString(),
      lido: false,
    },
    {
      id: 'alerta-2',
      tipo: 'certidao_vencendo',
      titulo: 'CRF do FGTS vence em 12 dias',
      mensagem: 'Renove antes para não ser inabilitado.',
      editalId: null,
      certidaoId: 'cert-2',
      criadoEm: emDias(-1).toISOString(),
      lido: false,
    },
    {
      id: 'alerta-3',
      tipo: 'prazo_edital',
      titulo: 'Prazo de proposta em 48 horas',
      mensagem: 'Prefeitura de Anápolis: computadores para laboratórios.',
      editalId: editaisBase[3].id,
      certidaoId: null,
      criadoEm: emDias(-2).toISOString(),
      lido: true,
    },
  ]

  return {
    perfil: structuredClone(perfilInicial),
    certidoes,
    alertas,
    feedbacks: new Map<string, Feedback>(),
    acompanhamentos: new Map<string, Pick<Acompanhamento, 'etapas' | 'atualizadoEm'>>(),
    proximoId: 100,
  }
}

export let banco = criarEstadoInicial()

/** Volta ao estado inicial (usado entre um teste e outro). */
export function reiniciarBanco() {
  banco = criarEstadoInicial()
}

export const ETAPAS_PADRAO = [
  'Ler o edital e anexos',
  'Separar documentos de habilitação',
  'Montar a proposta de preço',
  'Enviar a proposta no portal',
]

export function editais(): EditalDetalhe[] {
  return editaisBase.map(({ diasAtePrazo, ...edital }) => ({
    ...edital,
    dataLimiteProposta: emDias(diasAtePrazo).toISOString(),
    diasParaEncerrar: diasAtePrazo,
    feedback: banco.feedbacks.get(edital.id) ?? null,
    acompanhando: banco.acompanhamentos.has(edital.id),
  }))
}

export { statusPorValidade }
