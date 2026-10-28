# ADR-0001 — Firestore com Security Rules deny-all

## Status

Aceito

## Contexto

O ciclo padroniza Firebase Auth + Firestore. O frontend poderia, em tese, usar o
SDK do cliente e ler/escrever documentos direto. Isso abriria risco de acesso
cruzado entre empresas (tenant) e bypass da lógica de negócio da API.

O Checkpoint 2 (Jornada 4, CT-SEG-010) exige que leituras e escritas diretas
pelo cliente sejam negadas pelas Security Rules.

## Decisão

1. As Security Rules do Firestore ficam **estritamente deny-all**
   (`allow read, write: if false` para todo documento).
2. O **cliente** não acessa dados no Firestore. Autenticação (Auth) pode usar o
   SDK; feed, certidões e demais dados só via HTTP na API.
3. A **API** acessa o Firestore com o **Admin SDK**, que ignora as Security
   Rules. Isolamento de tenant e RBAC ficam na validação do token na API.

## Consequências

- Qualquer tentativa de `get`/`set` pelo SDK do browser falha com
  `permission-denied` (coberto por `tests/firestore-rules`, CT-SEG-010).
- Sem Admin SDK na API, o backend também não consegue ler o banco — o time de
  backend precisa inicializar o Admin apontando ao emulador em desenvolvimento.
- Regras mais permissivas no cliente exigem novo ADR e aprovação do Tech Lead.
