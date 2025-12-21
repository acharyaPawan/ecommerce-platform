import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { auth } from './auth';

const app = new Hono()

app.get('/', (c) => c.text('Hello Node.js!'))


app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get('/', (c) => c.text('Hello Node.js!'))

const server = serve(app)

// graceful shutdown
process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})

export default app