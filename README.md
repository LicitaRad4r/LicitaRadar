# LicitaRadar

## Rodando localmente

**Pré-requisito único:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e **aberto** (o ícone da baleia precisa estar ativo).

Não é necessário instalar Node.js, Firebase CLI nem rodar `npm install` na sua máquina para subir o ambiente.

```bash
git clone https://github.com/LicitaRad4r/LicitaRadar.git
cd LicitaRadar
cp .env.example .env
docker compose up --build
```

A **primeira** execução demora vários minutos (baixa imagens e os emuladores do Firebase). As próximas ficam bem mais rápidas.

Quando terminar de subir, use:

| Serviço                   | URL                          |
| ------------------------- | ---------------------------- |
| Frontend (Vite + React)   | http://localhost:5173        |
| API (Fastify)             | http://localhost:3333/health |
| Emulator UI do Firebase   | http://localhost:4000        |
| Emulador de Auth          | localhost:9099               |
| Emulador de Firestore     | localhost:8080               |

Os dados dos emuladores são salvos ao rodar `docker compose down` e restaurados no próximo `up`.
Para zerar tudo: `docker compose down -v`.

### Entrar e ver o feed

Com o `.env` copiado do exemplo (`VITE_API_MOCK=true`), o front usa a API simulada. Abra http://localhost:5173: a sessão entra como decisor da empresa A e o feed aparece, sem gravar nada no emulador.

Para usar a API real (login no Auth do emulador e editais no Firestore), com os containers no ar:

1. No `.env`, mude para `VITE_API_MOCK=false`.
2. Recrie o front, para ele ler a variável: `docker compose up -d --force-recreate web`
3. Grave os dados locais. Uma vez basta; repita depois de `docker compose down -v`:

```bash
docker compose exec api npm run seed
```

O seed recria os usuários e grava empresas, editais, scores e certidões no emulador. Enquanto o volume do Firebase existir, os dados continuam no próximo `up`.

| E-mail | Papel | Senha |
| ------ | ----- | ----- |
| decisor.a@licitaradar.local | Decisor, empresa A | senha-local-123 |
| analista.a@licitaradar.local | Analista, empresa A | senha-local-123 |
| decisor.b@licitaradar.local | Decisor, empresa B | senha-local-123 |

As mesmas contas servem na API simulada. Com o mock desligado, entre em http://localhost:5173 com uma delas para ver o feed da empresa.

Alterou dependências (`package.json`)? Rode de novo `docker compose up --build`.

### Problemas comuns

| Sintoma | O que fazer |
| ------- | ----------- |
| Erro pedindo `.env` / variável não definida | `cp .env.example .env` na raiz do repo. |
| `Cannot connect to the Docker daemon` | Abra o Docker Desktop e espere ficar “running”. |
| Porta em uso (`3333`, `5173`, `4000`, `8080`, `9099`) | Feche o processo que usa a porta ou mude `API_PORT` / `WEB_PORT` no `.env`. |
| Build do Firebase demora ou parece travado | Na primeira vez é normal (baixa o emulador). Espere 2–5 min. |
| Container antigo / deps estranhas | `docker compose down -v` e depois `docker compose up --build`. Se for usar a API real, rode o seed de novo. |
| API real: “E-mail ou senha incorretos” ou feed vazio | No `.env`, `VITE_API_MOCK=false`. Recrie o front (`docker compose up -d --force-recreate web`) e rode `docker compose exec api npm run seed`. |
| Quer só validar o arquivo Compose | Com `.env` criado: `docker compose config --quiet` |

### O que **não** fazer para “só rodar”

Não siga guias antigos que pedem `npm install` no `client`/`server` + Firebase CLI na máquina. Isso é opcional (ver abaixo). O caminho suportado pelo time é o Compose.

## Lint, build e testes (opcional — o mesmo que o CI)

Só precisa de **Node.js 22+** na máquina se for rodar fora do Docker:

```bash
cd client && npm ci && npm run lint && npm run build
cd ../server && npm ci && npm run lint && npm run build && npm run test:unit
```

## Documentação

Produto, ADRs, FinOps e jornadas: repositório
[`LicitaRad4r/documentation`](https://github.com/LicitaRad4r/documentation)
([site](https://licitarad4r.github.io/documentation/)).

## Plano custo zero (sem voucher GCP)

Até a Semana 4 tudo roda **só no computador** (Compose + emuladores). Evidências FinOps ficam no repositório de documentação (`docs/finops/`).

### Regras de ouro

1. Nunca cadastrar cartão em GCP, Firebase, Render, Supabase ou GitHub.
2. Nunca clicar em Upgrade / Blaze no Firebase.
3. Testes pesados e seed grande só no emulador — nunca no Firestore real.
4. Um projeto Firebase por equipe.
5. Segredos só em GitHub Secrets / variáveis do Render — nunca no repositório (nunca commite `.env`).
6. Prints de “plano gratuito / sem pagamento” no repo de documentação (`docs/finops/`).
7. Serviço novo = ADR + aprovação do Tech Lead.

## Fluxo de trabalho

- Ninguém faz push direto na `main`: crie uma branch e abra um Pull Request.
- O PR precisa de 1 aprovação e do CI verde para entrar.
- Nunca commite `.env`, senhas ou chaves.
