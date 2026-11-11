/**
 * Seed de PRODUÇÃO (issue #54): 2 empresas, usuários de teste com claims e os dados golden,
 * no projeto Firebase real. Serve ao smoke e aos testes de autorização contra a API publicada.
 *
 * Nada de senha no repositório. Variáveis obrigatórias (só no seu terminal, nunca em arquivo versionado):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  JSON completo da conta de serviço do projeto
 *   SEED_PROD_SENHA                senha dos usuários de teste (mínimo 12 caracteres)
 *   SEED_PROD_CONFIRMO=sim         confirma que é para gravar no projeto real
 *
 * Uso: cd server && npm run seed:prod
 * Recusa rodar se houver variáveis de emulador (para não gravar no lugar errado).
 */
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { iniciarFirebase } from '../infra/firebase.js'
import { EMPRESAS, certidoesGolden, editaisGolden, scoresGolden } from './golden.js'
 
const USUARIOS = [
  { uid: 'u-decisor-a', email: 'decisor.a@licitaradar.local', empresaId: 'emp-a', role: 'decisor' },
  { uid: 'u-analista-a', email: 'analista.a@licitaradar.local', empresaId: 'emp-a', role: 'analista' },
  { uid: 'u-decisor-b', email: 'decisor.b@licitaradar.local', empresaId: 'emp-b', role: 'decisor' },
] as const
 
async function main() {
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Variáveis de emulador definidas: este seed é só para o projeto real. Use `npm run seed` no emulador.')
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('Defina FIREBASE_SERVICE_ACCOUNT_JSON (JSON da conta de serviço).')
  const senha = process.env.SEED_PROD_SENHA ?? ''
  if (senha.length < 12) throw new Error('Defina SEED_PROD_SENHA com pelo menos 12 caracteres.')
  if (process.env.SEED_PROD_CONFIRMO !== 'sim') throw new Error('Defina SEED_PROD_CONFIRMO=sim para gravar no projeto real.')
 
  iniciarFirebase()
  const auth = getAuth()
  const db = getFirestore()
  const agora = new Date()
 
  for (const u of USUARIOS) {
    await auth.deleteUser(u.uid).catch(() => {})
    await auth.createUser({ uid: u.uid, email: u.email, password: senha, emailVerified: true })
    await auth.setCustomUserClaims(u.uid, { empresaId: u.empresaId, role: u.role })
  }
 
  const editais = editaisGolden(agora)
  const scores = scoresGolden(agora, editais)
  const certidoes = certidoesGolden(agora)
  const lote = db.batch()
  for (const e of EMPRESAS) lote.set(db.collection('empresas').doc(e.id), { nome: e.nome, perfil: e.perfil })
  for (const { id, ...resto } of editais) lote.set(db.collection('editais').doc(id), resto)
  for (const s of scores) lote.set(db.collection('scores').doc(`${s.empresaId}_${s.editalId}`), s)
  for (const { id, ...resto } of certidoes) lote.set(db.collection('certidoes').doc(id), resto)
  await lote.commit()
 
  console.log(`Seed de produção ok: ${USUARIOS.length} usuários, ${EMPRESAS.length} empresas, ${editais.length} editais de teste, ${scores.length} scores, ${certidoes.length} certidões.`)
  console.log(`Logins: ${USUARIOS.map((u) => u.email).join(', ')} (a senha é a de SEED_PROD_SENHA)`)
}
 
main().catch((e) => {
  console.error(e)
  process.exit(1)
})