# Server (API do LicitaRadar)

API em Node.js + TypeScript + Fastify.

## Rodando
Na raiz do repositório: `docker compose up --build`. Saúde da API: http://localhost:3333/health

## Contrato da API
O contrato (OpenAPI 3.1, versão 0.1, rascunho) está em [`openapi.yaml`](./openapi.yaml).

- Validar (na raiz): `npx @redocly/cli lint server/openapi.yaml`
- Visualizar: cole o conteúdo em https://editor.swagger.io

Convenções: rotas de negócio sob `/v1`, autenticadas com Bearer (ID token do Firebase Auth); `/health` é público; os dados são sempre da empresa do token; erros seguem o schema `Erro`.