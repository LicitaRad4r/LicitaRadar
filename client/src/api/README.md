# Integração com a API

Como as telas do front conversam com a API do LicitaRadar. O contrato é o `server/openapi.yaml` (v0.3).

## Como uma tela busca dados

Cada jornada tem um arquivo `api.ts` com hooks prontos. A tela não chama `fetch` nem monta URL.

| Assunto | Arquivo | Hooks |
| --- | --- | --- |
| Perfil | `features/perfil/api.ts` | `usePerfil`, `useSalvarPerfil`, `perfilVazio` |
| Feed e filtros | `features/feed/api.ts` | `useFeed(filtros)` |
| Edital | `features/editais/api.ts` | `useEdital` |
| Certidões (só decisor) | `features/certidoes/api.ts` | `useCertidoes`, `useRenovarCertidao` |

Os tipos (`Certidao`, `FeedItem`, `Perfil`...) vêm de `api/tipos.ts`, gerados do contrato.

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
* **Erro:** mensagem em português e botão "Tentar de novo".
* **Vazio:** cada tela passa a sua mensagem, sempre com o próximo passo.
* **Sucesso:** a função filha recebe os dados já tipados.

## Ações (salvar, excluir, marcar)

Os hooks de ação já mostram o aviso (toast) de sucesso e de erro e atualizam as listas afetadas.
Em formulários, o erro não vira toast: mostre nos campos.

```tsx
import { errosPorCampo } from '@/api/erros'

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
* `?papel=analista` simula o analista, que não acessa certidões (403)

Quando o back estiver pronto, basta `VITE_API_MOCK=false`.

## Login

O token do Firebase Auth vai em `Authorization: Bearer` em toda chamada (`api/client.ts`).
Sem usuário logado, a chamada vai sem token e a API responde 401.

A empresa e o papel (`decisor` ou `analista`) vêm do token. No primeiro salvamento do perfil a API responde 201
e grava esses dados no usuário; o `useSalvarPerfil` renova o token sozinho nesse caso.

## Quando o contrato mudar

```bash
npm run gen:api
```

Atualiza `api/schema.d.ts`. Se algum hook ou tela quebrar no `npm run build`, é sinal de que o contrato mudou ali.

## Testes

Os testes do Vitest usam o mesmo mock (`mocks/servidor.ts`). Para simular outra resposta num teste:

```ts
servidor.use(http.get(`${API_URL}/v1/certidoes`, () => HttpResponse.json({ itens: [] })))
```

Para renderizar com o cache da API, use `renderizar` e `renderizarHook` de `testes/utils.tsx`.
