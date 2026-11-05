# Client (frontend do LicitaRadar)

React + TypeScript + Vite.

## Rodando

Na **raiz** do monorepo (não nesta pasta):

```bash
docker compose up --build
```

Abra http://localhost:5173

Detalhes e troubleshooting: [`README.md`](../README.md) na raiz.

## Lint e build (opcional, fora do Docker)

Precisa de Node.js 22+:

```bash
npm ci
npm run lint
npm run build
```
