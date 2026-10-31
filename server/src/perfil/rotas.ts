import type { FastifyInstance } from 'fastify'
import { usuarioDe } from '../auth.js'
import { erroDeZod } from '../erros.js'
import type { DefinirClaims, PerfilRepo } from './repositorio.js'
import { PerfilEntrada, perfilVazio, type Perfil } from './schema.js'

export function rotasPerfil(app: FastifyInstance, perfis: PerfilRepo, definirClaims: DefinirClaims) {
  app.get('/perfil', async (req) => {
    const { empresaId } = usuarioDe(req)
    if (!empresaId) return { empresaId: null, ...perfilVazio() } satisfies Perfil
    const dados = (await perfis.ler(empresaId)) ?? perfilVazio()
    return { empresaId, ...dados } satisfies Perfil
  })

  app.put('/perfil', async (req, reply) => {
    const usuario = usuarioDe(req)
    const parsed = PerfilEntrada.safeParse(req.body)
    if (!parsed.success) throw erroDeZod(parsed.error)

    if (usuario.empresaId) {
      await perfis.salvar(usuario.empresaId, parsed.data)
      return { empresaId: usuario.empresaId, ...parsed.data } satisfies Perfil
    }

    // Primeiro salvamento: cria a empresa e grava os claims (quem cria vira decisor).
    const empresaId = await perfis.criar(parsed.data)
    await definirClaims(usuario.uid, { empresaId, role: 'decisor' })
    return reply.status(201).send({ empresaId, ...parsed.data } satisfies Perfil)
  })
}
