# Integração com a API

Como as telas do front conversam com a API do LicitaRadar. O contrato é o `server/openapi.yaml` (v0.3).

## Como uma tela busca dados

Três camadas, cada uma com uma função:

1. **`services/`**: as chamadas HTTP. Uma função por rota da API, tipada com os DTOs do contrato
   (`services/dto.ts`, gerado do `server/openapi.yaml`). Ex.: `listarFeed(filtros): Promise<FeedPaginaDTO>`.
2. **Hooks em `features/*/api.ts`**: chamam os serviços pelo TanStack Query, que guarda o resultado em cache
   (`lib/cache.ts`) e atualiza as listas depois de uma ação.
3. **Telas**: usam só os hooks. Não chamam `fetch` nem montam URL.

| Assunto | Serviço | Hooks |
| --- | --- | --- |
| Feed e filtros | `services/feed.ts` | `useFeed(filtros)` |
| Perfil | `services/perfil.ts` | `usePerfil`, `useSalvarPerfil`, `perfilVazio` |
| Edital | `services/editais.ts` | `useEdital` |
| Certidões (só decisor) | `services/certidoes.ts` | `useCertidoes`, `useRenovarCertidao` |
| Saúde da API | `services/saude.ts` | (usado no cabeçalho) |

## Os quatro estados de toda tela

Toda lista passa pelo `EstadoDaConsulta`, que resolve carregando, erro, vazio e sucesso:

```tsx
import { EstadoDaConsulta, Vazio } from '@/components/estado'
import { useCertidoes } from '@/features/certidoes/api'

function Certidoes() {
  const consulta = useCertidoes()
  return (
    <EstadoDaConsulta
      consulta={consulta}
      vazio={<Vazio titulo="Nenhuma certidão cadastrada" acao={<BotaoNovaCertidao />} />}
    >
      {(certidoes) => <TabelaDeCertidoes certidoes={certidoes} />}
    </EstadoDaConsulta>
  )
}
```

* **Carregando:** esqueleto (`Carregando`). Dá para passar outro em `carregando`.
* **Erro:** mensagem em português e botão "Tentar novamente".
* **Vazio:** cada tela passa a sua mensagem, sempre com o próximo passo.
* **Sucesso:** a função filha recebe os dados já tipados.

## Ações (salvar, excluir, marcar)

Os hooks de ação já mostram o aviso (toast) de sucesso e de erro e atualizam as listas afetadas.
Em formulários, o erro não vira toast: mostre nos campos.

```tsx
import { errosPorCampo } from '@/services/erros'

const salvar = useSalvarPerfil()

function aoEnviar(perfil: Perfil) {
  salvar.mutate(perfil, {
    onError: (erro) => {
      Object.entries(errosPorCampo(erro)).forEach(([campo, mensagem]) =>
        form.setError(campo as keyof Perfil, { message: mensagem }),
      )
    },
  })
}
```

Use `salvar.isPending` para desabilitar o botão enquanto envia.

Renovar uma certidão troca a certidão na lista na mesma hora, já na nova ordem de urgência.

## Mock da API

Enquanto o back não implementa as rotas, o front usa o mock em `src/mocks` (com `VITE_API_MOCK=true`,
o padrão no `.env.example` e no docker compose). Ele segue o contrato e guarda as alterações enquanto a
página estiver aberta.

Para ver um estado em todas as telas, use a URL:

* `?mock=vazio` nenhum edital ingerido e nenhuma certidão
* `?mock=descartados` o perfil descartou todos os editais
* `?mock=erro` toda chamada falha
* `?mock=lento` respostas demoram 3 segundos
* `?mock=sem-login` toda chamada responde 401
* `?mock=sem-empresa` as rotas respondem 403 de empresa não configurada
* `?papel=analista` simula o analista, que não acessa certidões (403); ou entre como `analista.a@licitaradar.local`

Quando o back estiver pronto, basta `VITE_API_MOCK=false`.

## Login e erros de acesso (Jornada 4)

A sessão fica em `lib/sessao.ts`. Com a API real ela usa o Firebase Auth (`lib/firebase.ts`); com a API
simulada, um login falso com os mesmos usuários do seed do back (`mocks/sessao.ts`, senha `senha-local-123`).

* O token vai em `Authorization: Bearer` em toda chamada (`services/http.ts`).
* Sem sessão, qualquer página leva ao `/login`, e depois de entrar a pessoa volta para onde estava.
* **Tratamento central:** o cliente HTTP avisa todo 401 e todo 403 `ACESSO_NEGADO`, venha de qual tela vier.
  O `useTratamentoDeAcesso` (no Layout) leva o 401 ao login, com o aviso de sessão expirada, e o 403 à página
  `/acesso-negado`. O 403 `EMPRESA_NAO_CONFIGURADA` não é falta de permissão e aparece na própria tela.
* A empresa e o papel (`decisor` ou `analista`) vêm do token. Para o analista, o menu não mostra Certidões.
* No primeiro salvamento do perfil a API responde 201 e grava empresa e papel no usuário; o `useSalvarPerfil`
  renova o token sozinho nesse caso.

## Quando o contrato mudar

```bash
npm run gen:api
```

Atualiza `services/schema.d.ts`. Se algum hook ou tela quebrar no `npm run build`, é sinal de que o contrato mudou ali.

## Testes

Os testes do Vitest usam o mesmo mock (`mocks/servidor.ts`). Para simular outra resposta num teste:

```ts
servidor.use(http.get(`${API_URL}/v1/certidoes`, () => HttpResponse.json({ itens: [] })))
```

Para renderizar com o cache da API, use `renderizar` e `renderizarHook` de `testes/utils.tsx`.
