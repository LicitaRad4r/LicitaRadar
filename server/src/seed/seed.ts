/**
 * Dados locais para o emulador (card #24): duas empresas com perfis diferentes, usuários com
 * claims, o Golden Set de editais e o score de cada par empresa × edital (a API só lê).
 *
 * Uso, com o Compose no ar: `docker compose exec api npm run seed`
 * (o container da API já aponta para os emuladores). As senhas abaixo valem só no emulador local.
 */
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { iniciarFirebase } from '../infra/firebase.js'
import { EMPRESAS, certidoesGolden, editaisGolden, scoresGolden } from './golden.js'

const SENHA_LOCAL = 'senha-local-123'

const USUARIOS = [
  { uid: 'u-decisor-a', email: 'decisor.a@licitaradar.local', empresaId: 'emp-a', role: 'decisor' },
  { uid: 'u-analista-a', email: 'analista.a@licitaradar.local', empresaId: 'emp-a', role: 'analista' },
  { uid: 'u-decisor-b', email: 'decisor.b@licitaradar.local', empresaId: 'emp-b', role: 'decisor' },
] as const

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Defina FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST: o seed só roda no emulador.')
  }
  iniciarFirebase()
  const auth = getAuth()
  const db = getFirestore()
  const agora = new Date()

  for (const u of USUARIOS) {
    await auth.deleteUser(u.uid).catch(() => {})
    await auth.createUser({ uid: u.uid, email: u.email, password: SENHA_LOCAL, emailVerified: true })
    await auth.setCustomUserClaims(u.uid, { empresaId: u.empresaId, role: u.role })
  }

  const editais = editaisGolden(agora)
  const scores = scoresGolden(agora, editais)
  const lote = db.batch()
  for (const e of EMPRESAS) lote.set(db.collection('empresas').doc(e.id), { nome: e.nome, perfil: e.perfil })
  for (const { id, ...resto } of editais) lote.set(db.collection('editais').doc(id), resto)
  for (const s of scores) lote.set(db.collection('scores').doc(`${s.empresaId}_${s.editalId}`), s)
  const certidoes = certidoesGolden(agora)
  for (const { id, ...resto } of certidoes) lote.set(db.collection('certidoes').doc(id), resto)
  await lote.commit()

  console.log(`Seed ok: ${USUARIOS.length} usuários, ${EMPRESAS.length} empresas, ${editais.length} editais, ${scores.length} scores, ${certidoes.length} certidões.`)
  console.log(`Logins locais: ${USUARIOS.map((u) => u.email).join(', ')} (senha ${SENHA_LOCAL})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
