# LicitaRadar

## Rodando localmente

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/LicitaRad4r/LicitaRadar.git
cd LicitaRadar
docker compose up --build
```

O `.env` é opcional: todos os valores têm padrão. Para mudar algo, copie `.env.example` para `.env`.

| Serviço                   | URL                          |
| ------------------------- | ---------------------------- |
| Frontend (Vite + React)   | http://localhost:5173        |
| API (Fastify)             | http://localhost:3333/health |
| Emulator UI do Firebase   | http://localhost:4000        |
| Emulador de Auth          | localhost:9099               |
| Emulador de Firestore     | localhost:8080               |

Os dados dos emuladores são salvos ao rodar `docker compose down` e restaurados no próximo `up`.
Para zerar tudo: `docker compose down -v`.

Alterou dependências (`package.json`)? Rode `docker compose up --build`.

## Lint e build (o mesmo que o CI roda)

```bash
cd client && npm ci && npm run lint && npm run build
cd server && npm ci && npm run lint && npm run build
```

## Documentação

A documentação do produto (ADRs, FinOps, jornadas, testes) fica no repositório
[`LicitaRad4r/documentation`](https://github.com/LicitaRad4r/documentation)
([site](https://licitarad4r.github.io/documentation/)).

## Plano custo zero (sem voucher GCP)

Até a Semana 4 tudo roda **só no computador** (Compose + emuladores). Na nuvem
(Semana 5+) o LicitaRadar segue o **ADR-0012** no repositório de documentação
(plano Spark + Render + GitHub Actions). Evidências FinOps também ficam lá.

### Regras de ouro

1. Nunca cadastrar cartão em GCP, Firebase, Render, Supabase ou GitHub.
2. Nunca clicar em Upgrade / Blaze no Firebase.
3. Testes pesados e seed grande só no emulador — nunca no Firestore real.
4. Um projeto Firebase por equipe.
5. Segredos só em GitHub Secrets / variáveis do Render — nunca no repositório.
6. Prints de “plano gratuito / sem pagamento” no repo de documentação (`docs/finops/`).
7. Serviço novo = ADR + aprovação do Tech Lead.

## Fluxo de trabalho

- Ninguém faz push direto na `main`: crie uma branch e abra um Pull Request.
- O PR precisa de 1 aprovação e do CI verde para entrar.
- Nunca commite `.env`, senhas ou chaves.
