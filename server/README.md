# Server (API do LicitaRadar)

API em Node.js + TypeScript + Fastify.

## Rodando

Na **raiz** do monorepo (não nesta pasta):

```bash
cp .env.example .env   # obrigatório na raiz (não commitar o .env)
docker compose up --build
```

Saúde da API: http://localhost:3333/healthz (e `/readyz`, que também checa o Firestore).

Usuários, editais e certidões locais não sobem com o Compose. Na raiz, com os containers no ar:

```bash
docker compose exec api npm run seed
```

Logins e o passo a passo: [`README.md`](../README.md) na raiz.

Não é necessário `npm install` na máquina para subir o ambiente — o Compose instala as deps na imagem. Detalhes: [`README.md`](../README.md) na raiz.

## Contrato da API
O contrato (OpenAPI 3.1, versão 0.3, Checkpoint 2) está em [`openapi.yaml`](./openapi.yaml).

- Validar (na raiz): `npx @redocly/cli lint server/openapi.yaml`
- Visualizar: cole o conteúdo em https://editor.swagger.io

Convenções: rotas de negócio sob `/v1`, autenticadas com Bearer (ID token do Firebase Auth); `/health`, `/healthz` e `/readyz` são públicos (sem dados); os dados são sempre da empresa do token; erros seguem o schema `Erro`.

Todo acesso a dados passa pela API: o navegador nunca lê nem escreve direto no Firestore (regras deny-all). O usuário se identifica pelos claims `empresaId` e `role` do ID token.

## Saúde (`/healthz` e `/readyz`)
Públicas, sem token e sem dados. Ficam fora do contrato OpenAPI do front, assim como `/health`.

| Rota | O que diz | Firestore ok | Firestore fora do ar (ou sem credencial) |
| ---- | --------- | ------------ | ---------------------------------------- |
| `GET /healthz` | a API está de pé; não depende de nada e não lê o Firestore | `200 {"status":"ok"}` | `200 {"status":"ok"}` |
| `GET /readyz` | a API está pronta: também consulta o Firestore | `200 {"status":"ready"}` | `503 {"status":"unavailable"}` (responde em até 3 s; o corpo nunca traz o motivo) |

Custo: `/healthz` não lê nada; `/readyz` lê no máximo 1 documento de `editais` por chamada (um monitor a cada 5 min dá ~288 leituras por dia, bem abaixo da cota gratuita do Firestore).

Para verificar na sua máquina (com o Compose no ar). Com o emulador parado, o `/readyz` passa a dar 503 e o `/healthz` continua 200:

```bash
curl -i http://localhost:3333/healthz
curl -i http://localhost:3333/readyz
docker compose stop firebase    # derruba só o Firestore
curl -i http://localhost:3333/healthz   # segue 200
curl -i http://localhost:3333/readyz    # 503
docker compose start firebase
```

Na hospedagem (Render): configure o *Health Check Path* como `/healthz`. Use o `/readyz` só para monitorar (UptimeRobot), não como health check da plataforma: se o Firestore cair, o Render poderia reiniciar uma API que não tem defeito. O workflow `Smoke test` (`scripts/smoke-test.sh`) confere as duas rotas na URL pública.

Testes: `tests/unit/ingestao.test.ts` (as rotas, com a dependência simulada) e `tests/unit/prontidao.test.ts` (o `verificarFirestore`: resposta, falha, timeout de 3 s e credencial inválida).

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
| `CORS_ORIGENS` | origens do front aceitas pelo CORS, separadas por vírgula (em produção, o domínio do Firebase Hosting) | `http://localhost:5173` |
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

## Acompanhamentos (Kanban, US20)
Código em `src/acompanhamento` (regras, rotas, repositório) e `src/infra/firestore-acompanhamentos.ts`. Valem para `decisor` e `analista`; a empresa vem só do token.

| Rota | O que faz | Respostas |
|---|---|---|
| `POST /v1/acompanhamentos` `{editalId}` | começa a acompanhar (etapa `interessado`) | 201 criado · 200 já existia (devolve o existente) · 404 edital · 400 |
| `GET /v1/acompanhamentos?etapa=&page=&pageSize=` | lista paginada | 200 `{itens,page,pageSize,total}` · 400 |
| `PATCH /v1/acompanhamentos/{id}` `{etapa, resultado?}` | muda de etapa | 200 · 400 · 403 outra empresa · 404 · 422 |
| `DELETE /v1/acompanhamentos/{id}` | remove (só em `interessado`/`preparando`) | 204 · 403 · 404 · 422 |

- **Etapas**: `interessado` → `preparando` → `enviado` → `resultado`. Uma por vez; a única volta é `preparando` → `interessado`. Qualquer outra transição (pular, voltar, repetir a etapa, mudar depois do resultado) é **422** `REGRA_DE_NEGOCIO`, sem alterar nada. `resultado` exige `venceu` ou `nao_venceu` (senão 400); nas outras etapas `resultado` é proibido.
- **Ordem**: pelo prazo do edital (mais próximo primeiro, empate pelo id). Os `encerrados` (prazo passado e proposta ainda não enviada) vão para o fim. Depois de `enviado`, o prazo vencido não pesa.
- **`destaque`**: prazo entre 0 e 3 dias de calendário no horário de Brasília. `diasRestantes` usa o mesmo cálculo das certidões.
- **Dados do edital** (título, órgão, UF, prazo) são copiados na criação; o acompanhamento não depende de ler `editais` na listagem.
- **Id**: hash de empresa + edital (opaco, não expõe a empresa). É ele que impede duplicar o acompanhamento, mesmo com duas chamadas ao mesmo tempo.
- **Custo (Firestore)**: a listagem lê só a página pedida. O `total` vem de `count()` (agregação, 1 leitura a cada 1.000 documentos indexados) e os documentos antes da página entram como `offset` (também cobrados). O repositório não tem método que leia a coleção inteira.

### Índices do Firestore
`firestore.indexes.json` (na raiz) declara 3 índices compostos de `acompanhamentos`: `(empresaId, prazoEm)`, `(empresaId, fase, prazoEm)` e `(empresaId, etapa, prazoEm)`. **O emulador não exige índices**, então a falta deles só aparece em produção (erro `FAILED_PRECONDITION`). O workflow `Deploy` publica este arquivo e o `firestore.rules` quando o CI da `main` fica verde. A construção de um índice novo leva alguns minutos.

### Rodando e testando
```
docker compose exec api npm run seed        # inclui 2 acompanhamentos da Empresa A (golden-A e golden-E)
npm run test:unit                           # regras e rotas, sem emulador
npm run test:int                            # Firestore real do emulador (a partir de server/, com o emulador no ar)
k6 run k6/carga.js                          # na raiz; mede também GET e PATCH de acompanhamentos
```
