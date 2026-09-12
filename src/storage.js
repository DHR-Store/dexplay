/* Tiny persistence layer:
   - JSON values → localStorage
   - Binary blobs (wallpaper, avatar) → IndexedDB            */

const PREFIX = 'lg:'
const IDB_NAME  = 'liquid-glass'
const IDB_STORE = 'blobs'

/* ---------- localStorage (JSON) ---------- */
export function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch (_) {
    return fallback
  }
}

export function saveJSON(key, value) {
  try {
    if (value == null) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (_) { /* quota / private mode — ignore */ }
}

/* ---------- IndexedDB (Blobs) ---------- */
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function saveBlob(key, blob) {
  try {
    const db = await openIDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(blob, key)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch (_) {}
}

export async function loadBlob(key) {
  try {
    const db = await openIDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror   = () => reject(req.error)
    })
  } catch (_) {
    return null
  }
}

export async function removeBlob(key) {
  try {
    const db = await openIDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(key)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch (_) {}
}