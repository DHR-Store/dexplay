import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'node:https'

/* ---------------------------------------------------------------
   Picks the Origin/Referer an upstream host expects. These are
   the exact values from the browser captures that worked.
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
  // unknown host → don't set Origin/Referer at all
  return { origin: null, referer: null }
}

const UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36'

/* ---------------------------------------------------------------
   One generic proxy middleware at /api/proxy?url=<target>.
   Node sets the fake Origin/Referer per-host, so no CORS is
   involved — the browser sees a same-origin call.
---------------------------------------------------------------- */
function dynamicProxy() {
  return {
    name: 'dynamic-upstream-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', (req, res) => {
        const u = new URL(req.url || '', 'http://localhost')
        const target = u.searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain')
          res.end('missing ?url=')
          return
        }

        let t
        try { t = new URL(target) }
        catch (e) {
          res.statusCode = 400
          res.end('invalid url')
          return
        }

        const { origin, referer } = originForHost(t.host)

        const headers = {
          Host: t.host,
          'User-Agent': UA,
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
          Accept: '*/*',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site'
        }
        if (origin)  headers.Origin  = origin
        if (referer) headers.Referer = referer

        // forward auth + content-type from the browser
        if (req.headers['authorization']) {
          headers.Authorization = req.headers['authorization']
        }
        if (req.headers['content-type']) {
          headers['Content-Type'] = req.headers['content-type']
        }

        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const bodyBuf = Buffer.concat(chunks)
          if (bodyBuf.length) headers['Content-Length'] = bodyBuf.length

          const options = {
            hostname: t.hostname,
            port: t.port || 443,
            path: t.pathname + t.search,
            method: req.method,
            headers
          }

          const upstream = https.request(options, (up) => {
            res.statusCode = up.statusCode || 502
            if (up.headers['content-type']) {
              res.setHeader('Content-Type', up.headers['content-type'])
            }
            if (up.headers['content-length']) {
              res.setHeader('Content-Length', up.headers['content-length'])
            }
            // we still expose CORS to the local page (harmless)
            res.setHeader('Access-Control-Allow-Origin', '*')
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