export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const url = new URL(request.url)
    const target = url.searchParams.get('url')
    if (!target) {
      return new Response(JSON.stringify({ error: 'missing ?url=' }), {
        status: 400, headers: { 'content-type': 'application/json', ...cors }
      })
    }

    const t = new URL(target)
    const isEps  = t.host.includes('epsiloncloud.org')
    const isCnv  = t.host.includes('cnv.cx')
    const isYt   = t.host.includes('youtube.com') || t.host.includes('ytimg.com')

    const headers = new Headers(request.headers)
    headers.delete('host')
    headers.set('User-Agent',
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36')
    headers.set('Accept', '*/*')
    headers.set('Accept-Language', 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7')
    headers.set('Cache-Control', 'no-cache')
    headers.set('Pragma', 'no-cache')

    if (isEps) {
      headers.set('Origin',  'https://convertytmp3.org')
      headers.set('Referer', 'https://convertytmp3.org/')
    } else if (isCnv || isYt) {
      headers.set('Origin',  'https://frame.y2meta-uk.com')
      headers.set('Referer', 'https://frame.y2meta-uk.com/')
    }

    const init = { method: request.method, headers }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer()
    }

    const upstream = await fetch(t.toString(), init)
    const resp = new Response(upstream.body, upstream)
    for (const [k, v] of Object.entries(cors)) resp.headers.set(k, v)
    return resp
  }
}
