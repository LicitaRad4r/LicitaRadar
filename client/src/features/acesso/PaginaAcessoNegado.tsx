import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'

/** Página mostrada quando a API responde 403 ACESSO_NEGADO (Jornada 4). */
export function PaginaAcessoNegado() {
  return (
    <section aria-labelledby="titulo-acesso-negado" className="mx-auto max-w-lg space-y-4 py-10 text-center">
      <ShieldAlert aria-hidden className="mx-auto size-10 text-urgente" />
      <h1 id="titulo-acesso-negado" className="text-2xl font-semibold tracking-tight text-tinta dark:text-foreground">
        Acesso negado
      </h1>
      <p className="text-muted-foreground">
        O seu perfil de acesso não permite abrir esta página. Documentos legais e financeiros, como as certidões,
        ficam só com o decisor da empresa. Se precisar deles, peça ao decisor.
      </p>
      <Link to="/" className={buttonVariants({ size: 'lg' })}>
        Voltar para os editais
      </Link>
    </section>
  )
}
