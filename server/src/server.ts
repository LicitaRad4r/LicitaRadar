import Fastify from 'fastify'
import { z } from 'zod'

const app = Fastify({ logger: true })

app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

const start = async () => {
  try {
    await app.listen({ port: 3333, host: '0.0.0.0' })
    console.log('🚀 Servidor do Licita Radar rodando na porta 3333!')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()