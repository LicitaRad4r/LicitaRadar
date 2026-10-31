# FinOps — LicitaRadar (plano custo zero)

Sem voucher GCP **não há** alertas de orçamento 50/80/100%. A prova para o tutor é:

> prints de cada serviço no **plano gratuito**, sem forma de pagamento cadastrada.

Os arquivos ficam em [`evidencias/`](./evidencias/).

## Checklist de evidências (Checkpoint 2)

| # | Serviço | O que o print deve mostrar | Arquivo sugerido |
| - | ------- | -------------------------- | ---------------- |
| 1 | Firebase | Projeto no plano **Spark**; **sem** conta de faturamento / Blaze | `evidencias/01-firebase-spark.png` |
| 2 | Render | Workspace no plano **Free**; sem cartão | `evidencias/02-render-free.png` *(Semana 5)* |
| 3 | GitHub Actions | Uso dentro da cota gratuita (ou repo público) | `evidencias/03-github-actions.png` *(quando o job existir)* |
| 4 | UptimeRobot | Plano gratuito, sem cartão | `evidencias/04-uptime-robot.png` *(Semana 5)* |

Até a Semana 4, o item **1 (Firebase Spark)** é o prioritário. Os demais entram quando o serviço for criado.

## Como tirar o print do Firebase (item 1)

1. Acesse [Firebase Console](https://console.firebase.google.com/) no projeto da equipe.
2. Confirme que o plano é **Spark** (não Blaze).
3. Em Project settings / Usage and billing (ou equivalente), mostre que **não há** billing account vinculada.
4. Salve o print em `evidencias/01-firebase-spark.png` (ou `.jpg`) e preencha `evidencias/README.md`.

## Regras

- Nunca cadastrar cartão “só para verificar”.
- Nunca clicar em Upgrade / Blaze.
- Testes e seeds grandes só no emulador local (`docker compose`).
- DevOps fiscaliza; qualquer serviço novo precisa de ADR.

## Status atual

| Item | Status |
| ---- | ------ |
| ADR-0001 plano custo zero | Proposto (aguardando professor / Tech Lead) |
| Firebase Spark + print | Pendente — criar projeto e anexar evidência |
| Render / UptimeRobot | Semana 5 |
| Job PNCP no Actions | Esqueleto no repo; ativar na Semana 5 |
