# Server (API do LicitaRadar)

API em Node.js + TypeScript + Fastify.

## Rodando
Na raiz do repositório: `docker compose up --build`. Saúde da API: http://localhost:3333/health

## Contrato da API
O contrato (OpenAPI 3.1, versão 0.2, rascunho do Checkpoint 2) está em [`openapi.yaml`](./openapi.yaml).

- Validar (na raiz): `npx @redocly/cli lint server/openapi.yaml`
- Visualizar: cole o conteúdo em https://editor.swagger.io

Convenções: rotas de negócio sob `/v1`, autenticadas com Bearer (ID token do Firebase Auth); `/health` é público; os dados são sempre da empresa do token; erros seguem o schema `Erro`.

Todo acesso a dados passa pela API: o navegador nunca lê nem escreve direto no Firestore (regras deny-all). O usuário se identifica pelos claims `empresaId` e `role` do ID token.
