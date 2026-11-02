import { randomUUID } from 'node:crypto'
import type { Multipart, MultipartFile } from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import { exigirMesmaEmpresa, exigirPapel } from '../auth.js'
import { diaBrasilia } from '../dominio/tempo.js'
import { acessoNegado, ErroApi, naoEncontrado, type DetalheErro } from '../erros.js'
import { detectarTipo, EXTENSAO, LIMITE_BYTES } from './arquivo.js'
import type { ArmazenamentoArquivos, CertidaoRegistro, CertidaoRepo } from './repositorio.js'
import { classificar } from './status.js'

const DATA = /^\d{4}-\d{2}-\d{2}$/

const dataValida = (s: string) => DATA.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s

const paraResposta = (c: CertidaoRegistro, agora: Date) => ({
  id: c.id,
  nome: c.nome,
  validade: c.validade,
  ...classificar(c.validade, agora),
})

const invalido = (...detalhes: DetalheErro[]) => new ErroApi(400, 'VALIDACAO', 'Dados inválidos.', detalhes)

interface Envio {
  validade?: string
  arquivo?: Buffer
  extras: Record<string, string>
}

/** Lê o multipart inteiro (limite de 5 MB por arquivo, 1 arquivo). */
async function lerEnvio(parts: AsyncIterableIterator<MultipartFile | Multipart>): Promise<Envio> {
  const envio: Envio = { extras: {} }
  try {
    for await (const p of parts) {
      if (p.type === 'file') {
        if (p.fieldname !== 'arquivo') {
          await p.toBuffer() // descarrega o fluxo
          continue
        }
        envio.arquivo = await p.toBuffer()
      } else if (p.fieldname === 'validade') {
        envio.validade = String(p.value).trim()
      } else if (typeof p.value === 'string') {
        envio.extras[p.fieldname] = p.value
      }
    }
  } catch (e) {
    const codigo = (e as { code?: string }).code
    if (codigo === 'FST_REQ_FILE_TOO_LARGE') throw invalido({ campo: 'arquivo', mensagem: 'O arquivo deve ter no máximo 5 MB.' })
    if (codigo === 'FST_FILES_LIMIT') throw invalido({ campo: 'arquivo', mensagem: 'Envie apenas um arquivo.' })
    throw e
  }
  return envio
}

export function rotasCertidoes(
  app: FastifyInstance,
  repo: CertidaoRepo,
  arquivos: ArmazenamentoArquivos,
  agora: () => Date,
) {
  // Certidões: somente `decisor`. O `analista` leva 403 ACESSO_NEGADO (CT-SEG-005).
  app.get('/certidoes', async (req) => {
    const { empresaId } = exigirPapel(req, 'decisor')
    const hora = agora()
    const itens = (await repo.listar(empresaId))
      .map((c) => paraResposta(c, hora))
      // Mais urgente primeiro: menos dias restantes (vencidas, negativas, vêm antes). Empate por nome e id.
      .sort((a, b) => a.diasRestantes - b.diasRestantes || a.nome.localeCompare(b.nome, 'pt-BR') || a.id.localeCompare(b.id))
    return { itens }
  })

  app.put<{ Params: { certidaoId: string } }>('/certidoes/:certidaoId/renovacao', async (req) => {
    const { empresaId } = exigirPapel(req, 'decisor')

    // Dono antes de qualquer leitura do corpo: certidão de outra empresa é 403 e nada é gravado.
    const atual = await repo.obter(req.params.certidaoId)
    if (!atual) throw naoEncontrado('Certidão não encontrada.')
    exigirMesmaEmpresa(req, atual.empresaId)

    if (!req.isMultipart()) throw invalido({ campo: 'arquivo', mensagem: 'Envie o formulário como multipart/form-data.' })
    const envio = await lerEnvio(req.parts())
    for (const chave of ['orgId', 'empresaId']) {
      if (envio.extras[chave] !== undefined && envio.extras[chave] !== empresaId) throw acessoNegado()
    }

    const hora = agora()
    const erros: DetalheErro[] = []
    let tipo: ReturnType<typeof detectarTipo> = null
    if (!envio.arquivo || envio.arquivo.length === 0) {
      erros.push({ campo: 'arquivo', mensagem: 'Envie o arquivo da certidão.' })
    } else if (envio.arquivo.length > LIMITE_BYTES) {
      erros.push({ campo: 'arquivo', mensagem: 'O arquivo deve ter no máximo 5 MB.' })
    } else if (!(tipo = detectarTipo(envio.arquivo))) {
      erros.push({ campo: 'arquivo', mensagem: 'Formato inválido. Envie PDF, JPG ou PNG.' })
    }
    if (!envio.validade) {
      erros.push({ campo: 'validade', mensagem: 'Informe a nova validade.' })
    } else if (!dataValida(envio.validade)) {
      erros.push({ campo: 'validade', mensagem: 'Data inválida. Use AAAA-MM-DD.' })
    } else if (envio.validade <= diaBrasilia(hora)) {
      erros.push({ campo: 'validade', mensagem: 'A nova validade deve ser uma data futura.' })
    } else if (envio.validade <= atual.validade) {
      erros.push({ campo: 'validade', mensagem: 'A nova validade deve ser posterior à validade atual.' })
    }
    if (erros.length > 0 || !envio.arquivo || !tipo || !envio.validade) throw invalido(...erros)

    const chave = `certidoes/${empresaId}/${atual.id}/${hora.getTime()}-${randomUUID().slice(0, 8)}.${EXTENSAO[tipo]}`
    // Arquivo primeiro, registro depois: se o registro falhar, o antigo continua valendo.
    await arquivos.salvar(chave, envio.arquivo, tipo)
    const renovada: CertidaoRegistro = {
      ...atual,
      validade: envio.validade,
      arquivo: { chave, tipo, tamanho: envio.arquivo.length },
      anteriores: [...atual.anteriores, atual.arquivo],
    }
    await repo.salvar(renovada)
    return paraResposta(renovada, hora)
  })
}
