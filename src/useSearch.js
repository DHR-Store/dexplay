import { useCallback, useEffect, useRef, useState } from 'react'

const SEARCH_API = 'https://mw.mp3juice.blog/search.php'

export default function useSearch() {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const abortRef    = useRef(null)
  const debounceRef = useRef(null)

  const doSearch = useCallback(async (q) => {
    const trimmed = (q || '').trim()
    if (!trimmed) {
      setResults([]); setError(null); return
    }

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true); setError(null)
    try {
      const r = await fetch(`${SEARCH_API}?q=${encodeURIComponent(trimmed)}`, {
        signal: ctrl.signal,
        headers: { accept: 'application/json' }
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setResults(Array.isArray(data.items) ? data.items : [])
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // debounce query → search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  return { query, setQuery, results, loading, error }
}