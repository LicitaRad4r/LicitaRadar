# Server (API do LicitaRadar)

API em Node.js + TypeScript + Fastify.

## Rodando
Na raiz do repositório: `docker compose up --build`. Saúde da API: http://localhost:3333/healthz (e `/readyz`, que também checa o Firestore)

## Contrato da API
O contrato (OpenAPI 3.1, versão 0.3, Checkpoint 2) está em [`openapi.yaml`](./openapi.yaml).

- Validar (na raiz): `npx @redocly/cli lint server/openapi.yaml`
- Visualizar: cole o conteúdo em https://editor.swagger.io

Convenções: rotas de negócio sob `/v1`, autenticadas com Bearer (ID token do Firebase Auth); `/health`, `/healthz` e `/readyz` são públicos (sem dados); os dados são sempre da empresa do token; erros seguem o schema `Erro`.

Todo acesso a dados passa pela API: o navegador nunca lê nem escreve direto no Firestore (regras deny-all). O usuário se identifica pelos claims `empresaId` e `role` do ID token.

## Saúde (`/healthz` e `/readyz`)
Públicas, sem token e sem dados. `GET /healthz` diz que a API está de pé (use como *health check* da hospedagem). `GET /readyz` também consulta o Firestore e responde `503 {"status":"unavailable"}` se ele não responder em 3 s (o corpo nunca traz detalhes do erro). Ficam fora do contrato OpenAPI do front, assim como `/health`.

## Ingestão do PNCP
O workflow `.github/workflows/ingestao-pncp.yml` chama `POST /jobs/ingestao-pncp` todo dia. A rota é **interna** (fora do contrato do front) e **não usa token do Firebase**: exige `Authorization: Bearer <INGEST_JOB_TOKEN>`, comparado em tempo constante. Sem `INGEST_JOB_TOKEN` no servidor, a rota recusa tudo (401). O token do job não abre nenhuma outra rota, e o token de usuário não abre esta.

O que a ingestão faz, nesta ordem:
1. Consulta `GET /v1/contratacoes/proposta` do PNCP (propostas em aberto) para pregão eletrônico (6), concorrência eletrônica e presencial (4, 5) e dispensa (8), 50 por página, até `PNCP_MAX_PAGINAS` páginas por modalidade, com uma pausa de `PNCP_INTERVALO_MS` entre as requisições (o PNCP responde 429 depois de uma rajada de ~15 chamadas e não informa o limite). Repete em 429/5xx (respeitando `Retry-After`, com espera crescente) e não repete em 400/422. Se uma modalidade falha, as outras seguem e a falha aparece em `falhasPncp`; se todas falham, a rota responde 502.
2. Converte cada contratação em `Edital` (`src/ingestao/pncp.ts`). Ficam de fora, e são contadas em `ignoradas`: modalidade que o perfil não filtra, sem prazo de proposta, proposta já encerrada, sem UF, registro inválido. Valor 0 ou ausente vira `null` (orçamento sigiloso). O segmento fica `null`, porque essa consulta não informa o segmento.
3. Grava os editais (`editais/{id}`, id = número de controle do PNCP sem `/`) e recalcula o score de **cada empresa** para o lote (`scores/{empresaId}_{editalId}`). Pares descartados pelo funil perdem o score antigo. Rodar de novo não duplica nada.

### Variáveis de ambiente
| Variável | Para quê | Padrão |
|---|---|---|
| `INGEST_JOB_TOKEN` | token do job (segredo; use 32+ caracteres aleatórios) | sem ele a rota recusa tudo |
| `INGEST_FONTE` | `pncp` (API real) ou `fixtures` (demonstração, sem internet) | `pncp` |
| `INGEST_PERMITIR_FIXTURES` | `true` para usar fixtures fora do emulador (demo em ambiente real) | não definido |
| `PNCP_DIAS_A_FRENTE` | `dataFinal` da consulta = hoje + N dias | 30 |
| `PNCP_MAX_PAGINAS` | teto de páginas por modalidade | 3 |
| `PNCP_INTERVALO_MS` | pausa entre requisições ao PNCP (limite de taxa) | 5000 |
| `PNCP_BASE_URL` | base da API de consulta | `https://pncp.gov.br/api/consulta` |

### Rodando local (emulador no ar)
```
npm run ingest -- --fonte=fixtures   # dados de demonstração, sem internet
npm run ingest                       # PNCP real
```
No Windows/PowerShell, defina antes `$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"` e `$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"`. Sem emulador, o comando recusa gravar (para não sujar o Firestore real por engano).

### Ativação em produção (Semana 5)
1. Secrets do repositório: `API_BASE_URL` e `INGEST_JOB_TOKEN` (o mesmo valor configurado na API).
2. Variável de repositório `ENABLE_PNCP_INGEST=true`.
3. Na API hospedada: `INGEST_JOB_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`/credenciais do Admin SDK e `GCLOUD_PROJECT`.
4. Teste manual: *Actions → Ingestão PNCP → Run workflow*. A resposta traz o resumo (recebidas, editais gravados, ignoradas, scores).
