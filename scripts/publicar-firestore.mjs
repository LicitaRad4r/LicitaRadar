// Publica firestore.rules e firestore.indexes.json sem o Firebase CLI.
// O CLI consulta o Service Usage antes de publicar, e a conta deste job não tem esse papel.
// Os papéis dela (regras e índices) bastam para estas duas APIs.

import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const projeto = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default
const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'))
const regras = readFileSync(firebase.firestore.rules, 'utf8')
const indices = JSON.parse(readFileSync(firebase.firestore.indexes, 'utf8'))

const credencial = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credencial) {
  console.error('Defina GOOGLE_APPLICATION_CREDENTIALS.')
  process.exit(1)
}
const conta = JSON.parse(readFileSync(credencial, 'utf8'))

function jwt() {
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const corpo = Buffer.from(JSON.stringify({
    iss: conta.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  })).toString('base64url')
  const assinatura = createSign('RSA-SHA256').update(`${cabecalho}.${corpo}`).sign(conta.private_key, 'base64url')
  return `${cabecalho}.${corpo}.${assinatura}`
}

async function token() {
  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt() }),
  })
  const corpo = await resposta.json()
  if (!resposta.ok) {
    console.error(`Falha ao obter token (${resposta.status}).`)
    process.exit(1)
  }
  return corpo.access_token
}

async function api(acesso, url, opcoes = {}) {
  const resposta = await fetch(url, {
    ...opcoes,
    headers: { authorization: `Bearer ${acesso}`, 'content-type': 'application/json', ...(opcoes.headers ?? {}) },
  })
  const texto = await resposta.text()
  let corpo = null
  if (texto) {
    try {
      corpo = JSON.parse(texto)
    } catch {
      corpo = texto
    }
  }
  return { ok: resposta.ok, status: resposta.status, corpo }
}

function falhar(etapa, resultado) {
  const detalhe = typeof resultado.corpo === 'string' ? resultado.corpo : JSON.stringify(resultado.corpo)
  console.error(`${etapa} falhou (${resultado.status}): ${detalhe}`)
  process.exit(1)
}

function assinatura(campos) {
  return (campos ?? [])
    .filter((campo) => campo.fieldPath !== '__name__')
    .map((campo) => `${campo.fieldPath}:${campo.order ?? campo.arrayConfig ?? ''}`)
    .join('|')
}

async function publicarRegras(acesso) {
  const criado = await api(acesso, `https://firebaserules.googleapis.com/v1/projects/${projeto}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: regras }] } }),
  })
  if (!criado.ok) falhar('Criar ruleset', criado)
  const ruleset = criado.corpo.name
  const release = `projects/${projeto}/releases/cloud.firestore`
  const atualizado = await api(acesso, `https://firebaserules.googleapis.com/v1/${release}`, {
    method: 'PATCH',
    body: JSON.stringify({ release: { name: release, rulesetName: ruleset } }),
  })
  if (atualizado.ok) {
    console.log(`Regras publicadas: ${ruleset}`)
    return
  }
  if (atualizado.status !== 404) falhar('Atualizar release das regras', atualizado)
  const novo = await api(acesso, `https://firebaserules.googleapis.com/v1/projects/${projeto}/releases`, {
    method: 'POST',
    body: JSON.stringify({ name: release, rulesetName: ruleset }),
  })
  if (!novo.ok) falhar('Criar release das regras', novo)
  console.log(`Regras publicadas: ${ruleset}`)
}

async function indicesExistentes(acesso, grupo) {
  const achados = []
  let pagina = ''
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/collectionGroups/${grupo}/indexes`)
    if (pagina) url.searchParams.set('pageToken', pagina)
    const lista = await api(acesso, url)
    if (!lista.ok) falhar(`Listar índices de ${grupo}`, lista)
    achados.push(...(lista.corpo.indexes ?? []))
    pagina = lista.corpo.nextPageToken ?? ''
  } while (pagina)
  return new Set(achados.map((indice) => `${indice.queryScope ?? 'COLLECTION'} ${assinatura(indice.fields)}`))
}

async function esperarIndice(acesso, operacao) {
  const limite = Date.now() + 35 * 60 * 1000
  while (Date.now() < limite) {
    const estado = await api(acesso, `https://firestore.googleapis.com/v1/${operacao}`)
    if (!estado.ok) falhar('Acompanhar criação do índice', estado)
    if (estado.corpo.done) {
      if (estado.corpo.error) falhar('Criação do índice', { status: estado.corpo.error.code, corpo: estado.corpo.error })
      return
    }
    await new Promise((resolver) => setTimeout(resolver, 10_000))
  }
  console.error(`A criação do índice não terminou: ${operacao}`)
  process.exit(1)
}

async function publicarIndices(acesso) {
  const porGrupo = new Map()
  for (const indice of indices.indexes ?? []) {
    const grupo = indice.collectionGroup
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, await indicesExistentes(acesso, grupo))
    const chave = `${indice.queryScope ?? 'COLLECTION'} ${assinatura(indice.fields)}`
    if (porGrupo.get(grupo).has(chave)) {
      console.log(`Índice já existe: ${grupo} ${chave}`)
      continue
    }
    const criado = await api(acesso, `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/collectionGroups/${grupo}/indexes`, {
      method: 'POST',
      body: JSON.stringify({ queryScope: indice.queryScope ?? 'COLLECTION', fields: indice.fields }),
    })
    if (criado.status === 409) {
      console.log(`Índice já existe: ${grupo} ${chave}`)
      continue
    }
    if (!criado.ok) falhar(`Criar índice ${grupo}`, criado)
    console.log(`Índice em criação: ${grupo} ${chave}`)
    if (criado.corpo.name) await esperarIndice(acesso, criado.corpo.name)
  }
}

const acesso = await token()
await publicarRegras(acesso)
await publicarIndices(acesso)
console.log('Firestore publicado.')
