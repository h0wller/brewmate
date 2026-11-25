import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const page = fileURLToPath(new URL('./concurrency-harness.html', import.meta.url))
const server = createServer(async (request, response) => {
  if (request.method === 'GET' && new URL(request.url, 'http://127.0.0.1').pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(await readFile(page))
    return
  }
  response.writeHead(404)
  response.end('Not found')
})
server.listen(4179, '127.0.0.1', () => console.log('T1 concurrency harness: http://127.0.0.1:4179/'))
