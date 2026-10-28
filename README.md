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

## Security Rules (Firestore deny-all)

O Firestore está com rules **deny-all**: o browser não lê nem escreve dados
direto. Todo acesso passa pela API (Admin SDK). Ver
[ADR-0001](docs/arquitetura/decisoes_adrs/0001-firestore-deny-all.md).

Teste CT-SEG-010:

```bash
# Com o Compose já no ar (recomendado no dia a dia):
npm run test:firestore-rules:docker

# Ou sobe o emulador via firebase-tools (precisa de JDK 21):
npm run test:firestore-rules
```

## Fluxo de trabalho

- Ninguém faz push direto na `main`: crie uma branch e abra um Pull Request.
- O PR precisa de 1 aprovação e do CI verde para entrar.
- Nunca commite `.env`, senhas ou chaves.
