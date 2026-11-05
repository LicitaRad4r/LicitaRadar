/**
 * Ingestão pela linha de comando (sem passar pela API), útil para a demo e para testar no emulador:
 *   npm run ingest                     (PNCP real; precisa de internet e do emulador ou credenciais)
 *   npm run ingest -- --fonte=fixtures (dados de demonstração, sem internet)
 */
import { ingestaoRepoFirestore } from '../infra/firestore-ingestao.js'
import { criarFontePncp, opcoesPncpDoAmbiente } from './cliente-pncp.js'
import { fonteFixture } from './fixtures.js'
import { executarIngestao } from './servico.js'

const arg = process.argv.find((a) => a.startsWith('--fonte='))?.split('=')[1]
const fonte = arg ?? process.env.INGEST_FONTE ?? 'pncp'
if (fonte !== 'pncp' && fonte !== 'fixtures') throw new Error(`Fonte inválida: ${fonte} (use pncp ou fixtures).`)
if (!process.env.FIRESTORE_EMULATOR_HOST && process.env.INGEST_PERMITIR_ESCRITA_REAL !== 'true') {
  throw new Error('Defina FIRESTORE_EMULATOR_HOST (emulador). Para gravar no Firestore real, defina INGEST_PERMITIR_ESCRITA_REAL=true.')
}

const resultado = await executarIngestao({ repo: ingestaoRepoFirestore(), fonte: fonte === 'fixtures' ? fonteFixture : criarFontePncp(opcoesPncpDoAmbiente()) })
console.log(JSON.stringify(resultado, null, 2))
