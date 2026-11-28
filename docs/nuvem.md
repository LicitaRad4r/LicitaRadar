# Configuração de nuvem

O que está publicado tem que coincidir com os arquivos deste repositório. Mudar regra ou índice é um pull request: com o CI verde na `main`, o workflow `Deploy` publica sozinho.

## Firebase

| Arquivo | Função |
| ------- | ------ |
| `.firebaserc` | Projeto `licitaradar-13047` |
| `firebase.json` | Hosting (`client/dist`, rewrite da SPA), emuladores, e o caminho das regras e dos índices |
| `firestore.rules` | Deny-all: o navegador não lê nem escreve no Firestore |
| `firestore.indexes.json` | Três índices de `acompanhamentos` usados pelo kanban |

O canal de preview não cabe no `firebase.json`. Cada pull request, depois do CI verde, cria um canal com `hosting:channel:deploy` e validade de 7 dias (`.github/workflows/hosting-preview.yml`). O link fica no comentário do PR. O site `https://licitaradar-13047.web.app` só muda no merge da `main`.

O workflow `Deploy` (`.github/workflows/deploy.yml`) roda depois do CI verde na `main` e publica duas coisas, com contas diferentes:

- Hosting, com o secret `FIREBASE_SERVICE_ACCOUNT_HOSTING` (papel Firebase Hosting Admin).
- `firestore.rules` e `firestore.indexes.json`, com o secret `FIREBASE_SERVICE_ACCOUNT_FIRESTORE` (papéis Firebase Rules Admin e Cloud Datastore Index Admin). O job usa `scripts/publicar-firestore.mjs`: a conta não consulta o Service Usage, que é o que o Firebase CLI exige antes de publicar.

Nenhuma dessas contas é o JSON do Admin SDK usado pela API. Um índice novo pode levar alguns minutos para ficar pronto; o job espera até 40 minutos.

## Render

O `render.yaml` na raiz descreve a API que já está no ar: imagem `server/Dockerfile.render`, contexto `server/`, plano free, health check `/healthz`, branch `main`. Ele não cria outro serviço. Aplicar este arquivo como blueprint novo abriria uma segunda API.

A imagem usa Node 22, a mesma versão dos jobs do server no CI, e o processo roda como o usuário `node`. O job `imagem (trivy)` constrói essa imagem e falha em vulnerabilidade `CRITICAL` ou `HIGH`. Os jobs do client e do server rodam `npm audit --omit=dev --audit-level=high`. O que a imagem base ainda carrega sem correção que a gente possa aplicar está em [`docs/Testes/excecoes-seguranca.md`](Testes/excecoes-seguranca.md) e no `.trivyignore`, com prazo para rever.

Variáveis no serviço:

| Variável | Valor |
| -------- | ----- |
| `GCLOUD_PROJECT` | `licitaradar-13047` |
| `INGEST_FONTE` | `pncp` |
| `CORS_ORIGENS` | `http://localhost:5173` (o código também aceita o `.web.app` deste projeto e os canais de preview) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON da conta Admin SDK. Só no painel do Render |
| `INGEST_JOB_TOKEN` | O mesmo valor do secret `INGEST_JOB_TOKEN` do GitHub. Só no painel |

`FIRESTORE_EMULATOR_HOST` e `FIREBASE_AUTH_EMULATOR_HOST` não existem neste serviço. Com elas definidas, a API fala com um emulador que não está lá e o `/readyz` responde 503.

O health check da plataforma é `/healthz`. O `/readyz` serve para o smoke test e para monitorar o Firestore; não use `/readyz` como health check do Render.

O front não roda no Render. O build de produção usa as variables do GitHub `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN` e `VITE_FIREBASE_PROJECT_ID`, com `VITE_API_MOCK=false`.

## Exemplos de ambiente

`.env.example` (raiz) e `client/.env.example` listam as variáveis. Os valores ativos são os do computador. Segredo fica vazio. Quem clona o repositório copia o exemplo da raiz para `.env` e sobe o Compose. O `.env` real não entra no Git.
