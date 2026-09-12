import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'node:https'

/* ---------------------------------------------------------------
   cnv.cx / youtube / epsiloncloud proxy as a Vite middleware.
   Runs on your own machine (Node.js), so:
     - no browser CORS restrictions
     - no Cloudflare-injected headers
     - request originates from your residential IP
   This is why it works locally but not from Vercel / Workers.
---------------------------------------------------------------- */
function originForHost(host) {
  if (
    host.includes('cnv.cx') ||
    host.includes('youtube.com') ||
    host.includes('ytimg.com')
  ) {
    return {
      origin:  'https://frame.y2meta-uk.com',
      referer: 'https://frame.y2meta-uk.com/'
    }
  }
  if (host.includes('epsiloncloud.org')) {
    return {
      origin:  'https://convertytmp3.org',
      referer: 'https://convertytmp3.org/'
    }
  }
  return { origin: null, referer: null }
}

const UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36'

function dynamicProxy() {
  return {
    name: 'dynamic-upstream-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', (req, res) => {
        const u = new URL(req.url || '', 'http://localhost')
        const target = u.searchParams.get('url')

        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'missing ?url=' }))
          return
        }

        let t
        try { t = new URL(target) }
        catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'invalid url' }))
          return
        }

        const { origin, referer } = originForHost(t.host)

        const headers = {
          'User-Agent':      UA,
          'Accept':          '*/*',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
          'Cache-Control':   'no-cache',
          'Pragma':          'no-cache'
        }
        if (origin)  headers.Origin  = origin
        if (referer) headers.Referer = referer

        if (req.headers['authorization'])  headers.Authorization  = req.headers['authorization']
        if (req.headers['content-type'])   headers['Content-Type'] = req.headers['content-type']

        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const bodyBuf = Buffer.concat(chunks)
          if (bodyBuf.length) headers['Content-Length'] = bodyBuf.length

          const upstream = https.request({
            hostname: t.hostname,
            port:     t.port || 443,
            path:     t.pathname + t.search,
            method:   req.method,
            headers
          }, (up) => {
            res.statusCode = up.statusCode || 502
            if (up.headers['content-type'])   res.setHeader('Content-Type',   up.headers['content-type'])
            if (up.headers['content-length']) res.setHeader('Content-Length', up.headers['content-length'])
            res.setHeader('Access-Control-Allow-Origin',  '*')
            res.setHeader('Access-Control-Allow-Headers', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            up.pipe(res)
          })

          upstream.on('error', (err) => {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          })

          if (bodyBuf.length) upstream.write(bodyBuf)
          upstream.end()
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dynamicProxy()],
  server: { port: 5173, open: true },
  build: { outDir: 'dist', emptyOutDir: true }
})
