// Vercel serverless function — mirrors the Vite dev middleware in vite.config.js.
// Lives at https://<your-app>.vercel.app/api/proxy?url=<encoded target>
//
// Sets Origin / Referer / Host headers that the upstream services
// (epsiloncloud.org, cnv.cx, youtube oembed) expect, so their responses
// come back with a 200 instead of a 403 or 404. Browser never sees CORS.

import https from 'node:https'

/* we handle the raw request body ourselves — no built-in parser */
export const config = {
  api: { bodyParser: false }
}

const UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36'

/* which Origin/Referer an upstream host expects */
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

export default function handler(req, res) {
  /* CORS — lets the browser tab call us without preflight trouble */
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const target = req.query.url
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
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'invalid url' }))
    return
  }

  const { origin, referer } = originForHost(t.host)

  const headers = {
    Host:              t.host,
    'User-Agent':      UA,
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
    Accept:            '*/*',
    'Cache-Control':   'no-cache',
    Pragma:            'no-cache',
    'Sec-Fetch-Dest':  'empty',
    'Sec-Fetch-Mode':  'cors',
    'Sec-Fetch-Site':  'cross-site'
  }
  if (origin)  headers.Origin  = origin
  if (referer) headers.Referer = referer

  /* forward Authorization + Content-Type from the caller */
  if (req.headers.authorization)  headers.Authorization  = req.headers.authorization
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']

  /* read the incoming body (POST / PUT) */
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const bodyBuf = Buffer.concat(chunks)
    if (bodyBuf.length) headers['Content-Length'] = bodyBuf.length

    const options = {
      hostname: t.hostname,
      port:     t.port || 443,
      path:     t.pathname + t.search,
      method:   req.method,
      headers
    }

    const upstream = https.request(options, (up) => {
      res.statusCode = up.statusCode || 502
      if (up.headers['content-type'])   res.setHeader('Content-Type',   up.headers['content-type'])
      if (up.headers['content-length']) res.setHeader('Content-Length', up.headers['content-length'])
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
}