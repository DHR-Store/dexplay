// Full chain:
//   1. searchYouTube(query)         → mp3juice search (direct, CORS:*)
//   2. fetchAudioUrl(videoId)       → epsiloncloud.org through the worker
//      - GET /api/v1/auth           → { key }
//      - GET /api/v1/init           → { convertURL }
//      - GET {convertURL}&v=ID&f=mp3 → first response
//          - redirect === 1 → follow redirectURL ONCE with isRedirect=true
//          - else → poll progressURL until progress >= 3
//      - downloadURL                → direct MP3 stream
//
// All upstream calls go through the Cloudflare Worker at
// https://ytproxy.gojosa.workers.dev/?url=…
// The worker sets Origin/Referer per host so the upstream accepts us,
// and returns `Access-Control-Allow-Origin: *` so our app can read it.

const SEARCH_API  = 'https://mw.mp3juice.blog/search.php'
const PROXY       = 'https://ytproxy.gojosa.workers.dev/?url='

/* epsilon values observed in the working browser session */
const EPS_API_KEY = '50399e2dd92c6c3087442659f268ce82'
const EPS_HOST    = 'epsilon.epsiloncloud.org'

/* ---------- generic proxy fetch ---------- */
async function viaProxy(target, options = {}) {
  const url = PROXY + encodeURIComponent(target)
  const r = await fetch(url, options)
  if (!r.ok) {
    let body = ''
    try { body = await r.text() } catch (_) {}
    throw new Error(
      `proxy HTTP ${r.status} for ${target}` +
      (body ? ` — ${body.slice(0, 160)}` : '')
    )
  }
  return r
}

/* =========================================================
   step 1 — search
   ========================================================= */
export async function searchYouTube(query) {
  const r = await fetch(`${SEARCH_API}?q=${encodeURIComponent(query)}`)
  if (!r.ok) throw new Error(`Search HTTP ${r.status}`)
  const data = await r.json()
  return Array.isArray(data.items) ? data.items : []
}

/* =========================================================
   step 2 — oEmbed metadata (best-effort)
   ========================================================= */
export async function fetchMetadata(videoId) {
  const watch  = `https://www.youtube.com/watch?v=${videoId}`
  const target = `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`
  const r = await viaProxy(target)
  const data = await r.json()
  return {
    title:  data.title,
    author: data.author_name,
    thumb:  data.thumbnail_url
  }
}

/* =========================================================
   step 3 — epsiloncloud chain
   ========================================================= */

async function epsilonAuth() {
  const target = `https://${EPS_HOST}/api/v1/auth?api_key=${EPS_API_KEY}&_=${Date.now()}`
  const r = await viaProxy(target)
  const data = await r.json()
  if (Number(data.err) !== 0 || !data.key) {
    throw new Error(`Epsilon: auth failed (${JSON.stringify(data)})`)
  }
  return data.key
}

async function epsilonInit(key) {
  const target = `https://${EPS_HOST}/api/v1/init?_=${Date.now()}`
  const r = await viaProxy(target, {
    headers: { Authorization: `Bearer ${key}` }
  })
  const data = await r.json()
  if (Number(data.error) !== 0 || !data.convertURL) {
    throw new Error(`Epsilon: init failed (${JSON.stringify(data)})`)
  }
  return data.convertURL
}

async function epsilonConvert(url, videoId, format = 'mp3', isRedirect = false) {
  let base = url
  const vi = base.indexOf('&v=')
  if (vi > -1) base = base.slice(0, vi)

  const sep = base.includes('?') ? '&' : '?'
  const target =
    `${base}${sep}v=${encodeURIComponent(videoId)}&f=${format}&_=${Date.now()}`

  const r = await viaProxy(target)
  const data = await r.json()

  if (Number(data.error) > 0) {
    throw new Error(`Epsilon: convert error ${data.error}`)
  }
  if (isRedirect) return data
  if (Number(data.redirect) === 1 && data.redirectURL) {
    return epsilonConvert(data.redirectURL, videoId, format, true)
  }
  return data
}

async function epsilonPoll(progressURL, downloadURL, maxTries = 60) {
  for (let i = 0; i < maxTries; i++) {
    const sep = progressURL.includes('?') ? '&' : '?'
    const target = `${progressURL}${sep}_=${Date.now()}`
    const r = await viaProxy(target)
    const data = await r.json()

    if (Number(data.error) !== 0) {
      throw new Error(`Epsilon: progress error ${data.error}`)
    }
    if (typeof data.progress === 'number' && data.progress >= 3) {
      return downloadURL || data.downloadURL
    }
    await new Promise((res) => setTimeout(res, 1500))
  }
  throw new Error('Epsilon: conversion timed out')
}

async function epsilonResolveResponse(response, videoId, format) {
  if (Number(response.error) > 0) {
    throw new Error(`Epsilon: error ${response.error}`)
  }
  if (response.downloadURL && (!response.progress || response.progress >= 3)) {
    return { url: response.downloadURL, filename: response.title || null }
  }
  if (response.progressURL && response.downloadURL) {
    const finalUrl = await epsilonPoll(response.progressURL, response.downloadURL)
    return { url: finalUrl, filename: response.title || null }
  }
  if (response.redirectURL) {
    const followup = await epsilonConvert(response.redirectURL, videoId, format, true)
    return epsilonResolveResponse(followup, videoId, format)
  }
  throw new Error(
    `Epsilon: unresolved — ` +
    `redirect=${response.redirect}, ` +
    `keys=${Object.keys(response).join(',')}, ` +
    `raw=${JSON.stringify(response).slice(0, 200)}`
  )
}

async function fetchAudioUrlEpsilonOnce(videoId) {
  const key      = await epsilonAuth()
  const initURL  = await epsilonInit(key)
  const response = await epsilonConvert(initURL, videoId, 'mp3', false)
  return epsilonResolveResponse(response, videoId, 'mp3')
}

export async function fetchAudioUrlEpsilon(videoId, retries = 2) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchAudioUrlEpsilonOnce(videoId)
    } catch (e) {
      lastErr = e
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 700 * (i + 1)))
      }
    }
  }
  throw lastErr
}

/* =========================================================
   step 4 — combined resolver
   ========================================================= */
export async function fetchAudioUrl(videoId) {
  return fetchAudioUrlEpsilon(videoId)
}

/* =========================================================
   full resolver used by SearchPanel
   ========================================================= */
export async function resolveTrack(item) {
  const [meta, audio] = await Promise.all([
    fetchMetadata(item.id).catch(() => null),
    fetchAudioUrl(item.id)
  ])

  const proxiedAudio = PROXY + encodeURIComponent(audio.url)

  return {
    id:       item.id,
    title:    meta?.title  || item.title,
    artist:   meta?.author || item.channelTitle || item.source || 'Unknown',
    thumb:    meta?.thumb  || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    url:      proxiedAudio,
    rawUrl:   audio.url,
    filename: audio.filename || null,
    duration: item.duration,
    size:     item.size
  }
}
