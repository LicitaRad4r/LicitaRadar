# ADR-0001 — Plano custo zero (sem voucher GCP)

## Status

Proposto — aguardando aprovação do professor e do Tech Lead (prazo Checkpoint 2: 01/11).

## Contexto

O Caderno B2B prevê Cloud Run, Cloud Scheduler, Workload Identity, Secret Manager e
alertas de orçamento no GCP (plano Blaze). A equipe **LicitaRadar** não dispõe do
voucher GCP. Cadastrar cartão de estudante está fora de questão.

O documento "Plano Custo Zero — sem o voucher do GCP" (14/10/2026) define substitutos
gratuitos sem cartão. Até a Semana 4 tudo continua no Docker Compose e emuladores;
a diferença aparece na Semana 5 (deploy na nuvem).

## Decisão

Adotar o **plano custo zero** para o LicitaRadar:

| Peça do Caderno              | Substituição                                      |
| ---------------------------- | ------------------------------------------------- |
| Firebase Auth + Firestore    | Firebase **Spark** (sem Blaze / sem faturamento)  |
| Firebase Hosting             | Firebase Hosting no Spark                         |
| Cloud Run (API)              | **Render** (web service gratuito)                 |
| Cloud Scheduler (ingestão)   | **GitHub Actions** com `schedule` (cron)          |
| Secret Manager               | Secrets do GitHub + env vars do Render            |
| Workload Identity            | Chave da conta de serviço Admin em secret (exceção; ADR futuro na S5) |
| Alertas de orçamento 50/80/100% | Prints em `/docs/finops` (prova de “sem pagamento”) |
| Cloud Monitoring             | Logs do Render + UptimeRobot (Semana 5)           |

**Não se aplica ao LicitaRadar:** Supabase Storage (só Habilita e EntregaProva).

### Regras de ouro (obrigatórias)

1. Nunca cadastrar cartão em GCP, Firebase, Render, Supabase ou GitHub.
2. Nunca Upgrade / Blaze no Firebase; nunca vincular faturamento ao projeto.
3. Testes pesados, k6 e seed grande só no emulador — nunca no Firestore real.
4. Um projeto Firebase por equipe, compartilhado com o time.
5. Chave de serviço com papel mínimo, só em secrets (nunca no Git). gitleaks no CI.
6. Evidências FinOps em `/docs/finops`.
7. Serviço novo = ADR + aprovação do Tech Lead.

### Ingestão PNCP (cuidado Spark)

Limite Spark: 20 mil escritas/dia no Firestore. A ingestão deve:

- filtrar por UF, modalidade e janela dos perfis;
- upsert sem regravar documentos iguais;
- ter teto de editais por execução (detalhar em ADR de ingestão/idempotência).

## Consequências

- Gasto na nuvem permanece **US$ 0** (sem cartão, sem Blaze).
- Cold start do Render (~1 min) exige tela de carregamento e “acordar” a API antes do Demo Day.
- Exceções ao Caderno (API fora do Cloud Run, Actions no lugar do Scheduler, chave no lugar do WIF) precisam de **aprovação do professor**.
- Se o voucher chegar depois, Auth/Firestore/Hosting permanecem; basta migrar a API para Cloud Run.

## Referências

- Plano Custo Zero — sem o voucher do GCP (14/10/2026)
- Caderno de Projetos B2B v2, seções 1.2, 1.5, 1.8, 1.9 e 3.2
- Workflow esqueleto: `.github/workflows/ingestao-pncp.yml`
- FinOps: `docs/finops/`
