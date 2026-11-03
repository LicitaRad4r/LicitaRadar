import type { RouteObject } from 'react-router'
import { PaginaCertidoes } from '@/features/certidoes/PaginaCertidoes'
import { PaginaFeed } from '@/features/feed/PaginaFeed'
import { Layout, PaginaNaoEncontrada } from './Layout'

/** Rotas da aplicação. Cada jornada nova entra como mais um filho do Layout. */
export const rotas: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <PaginaFeed /> },
      { path: 'certidoes', element: <PaginaCertidoes /> },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
]
