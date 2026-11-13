import type { RouteObject } from 'react-router'
import { PaginaAcessoNegado } from '@/features/acesso/PaginaAcessoNegado'
import { PaginaLogin } from '@/features/acesso/PaginaLogin'
import { PaginaCertidoes } from '@/features/certidoes/PaginaCertidoes'
import { PaginaFeed } from '@/features/feed/PaginaFeed'
import { PaginaPerfil } from '@/features/perfil/PaginaPerfil'
import { Layout, PaginaNaoEncontrada } from './Layout'

/**
 * Rotas da aplicação. O login fica fora do Layout; tudo dentro dele exige sessão.
 * Cada jornada nova entra como mais um filho do Layout.
 */
export const rotas: RouteObject[] = [
  { path: 'login', element: <PaginaLogin /> },
  {
    element: <Layout />,
    children: [
      { index: true, element: <PaginaFeed /> },
      { path: 'perfil', element: <PaginaPerfil /> },
      { path: 'certidoes', element: <PaginaCertidoes /> },
      { path: 'acesso-negado', element: <PaginaAcessoNegado /> },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
]
