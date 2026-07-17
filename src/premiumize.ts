import { config } from './config.js'
import { similarity } from './streamUtils.js'
import { NotCachedError, ProviderUnavailableError } from './rd.js'
import type { ResolvedStream } from './rd.js'

export { NotCachedError, ProviderUnavailableError }

const BASE = 'https://www.premiumize.me/api'

function premiumizeApiKey(): string {
  return config.premiumizeApiKey || ''
}

function formatFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = err.cause
  if (cause instanceof Error && cause.message) {
    const causeWithCode = cause as Error & { code?: unknown }
    const code = typeof causeWithCode.code === 'string' ? ` ${causeWithCode.code}` : ''
    return `${err.name}: ${err.message}; cause${code}: ${cause.message}`
  }
  return `${err.name}: ${err.message}`
}

// ── Typed shapes ───────────────────────────────────────────────────────────────

interface PmResponse {
  status:   string
  message?: string
}

interface PmCacheCheckResponse extends PmResponse {
  response: boolean[]
}

interface PmDirectDlFile {
  path: string
  size: number
  link: string
}

interface PmDirectDlResponse extends PmResponse {
  content?:  PmDirectDlFile[]
  location?: string
  filename?: string
  filesize?: number
}

// ── Low-level fetch ───────────────────────────────────────────────────────────

async function pmFetch<T extends PmResponse>(path: string, form: Record<string, string>): Promise<T> {
  const apiKey = premiumizeApiKey()
  if (!apiKey) throw new Error('PREMIUMIZE_API_KEY not configured')

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    throw new ProviderUnavailableError(`PM POST ${path} failed: ${formatFetchError(err)}`)
  }

  const text = await res.text()
  let parsed: T | null = null
  if (text) {
    try {
      parsed = JSON.parse(text) as T
    } catch {
      parsed = null
    }
  }

  if (!res.ok) {
    const message = `PM POST ${path} → ${res.status}: ${parsed?.message ?? text}`
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500) {
      throw new ProviderUnavailableError(message, res.status)
    }
    throw new Error(message)
  }
  if (!parsed) throw new Error(`PM POST ${path} returned invalid JSON`)
  if (parsed.status !== 'success') {
    throw new Error(`PM POST ${path} error: ${parsed.message ?? 'unknown'}`)
  }
  return parsed
}

function hashToMagnet(hash: string): string {
  return hash.startsWith('magnet:') ? hash : `magnet:?xt=urn:btih:${hash}`
}

async function checkCached(magnet: string): Promise<boolean> {
  const r = await pmFetch<PmCacheCheckResponse>('/cache/check', { 'items[]': magnet })
  return r.response?.[0] === true
}

// ── File selection ────────────────────────────────────────────────────────────

const SELECTABLE_VIDEO_EXTS = new Set(['mkv', 'mp4', 'avi', 'mov', 'm4v', 'ts', 'm2ts', 'wmv', 'flv', 'webm'])

function fileExt(name: string): string {
  return name.split('?')[0]?.split('.').pop()?.toLowerCase() ?? ''
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path
}

function isLikelyPlayableFile(f: PmDirectDlFile): boolean {
  const lower = f.path.toLowerCase()
  if (/\bsample\b|\btrailer\b|\bextras?\b|\bfeaturette\b/.test(lower)) return false
  return SELECTABLE_VIDEO_EXTS.has(fileExt(lower))
}

// Season packs rarely carry episode info in their own filename metadata, but
// the caller always knows which episode it wants (`label`, e.g. "tt0386676
// S1E1") — narrow pack candidates before scoring so a stray token match can't
// beat the actual episode file. Mirrors the same helper in rd.ts.
function filterFilesForEpisode<T extends { path: string }>(files: T[], label?: string): T[] {
  const m = /s(\d{1,2})\s*e(\d{1,3})\b/i.exec(label ?? '')
  if (!m) return files
  const season = parseInt(m[1], 10)
  const episode = parseInt(m[2], 10)
  const seTag = new RegExp(`s0*${season}[._ -]*e0*${episode}(?!\\d)`, 'i')
  const xTag = new RegExp(`(?<!\\d)0*${season}x0*${episode}(?!\\d)`, 'i')
  const matches = files.filter(f => {
    const base = basename(f.path)
    return seTag.test(base) || xTag.test(base)
  })
  return matches.length ? matches : files
}

function pickBestFile(files: PmDirectDlFile[], filePathHint: string | undefined, label: string | undefined): PmDirectDlFile {
  const sized = files.filter(f => f.size > 0)
  const playable = sized.filter(isLikelyPlayableFile)
  const pool = filterFilesForEpisode(playable.length ? playable : sized, label)
  if (!pool.length) throw new Error('Premiumize transfer has no selectable files')

  if (filePathHint && pool.length > 1) {
    const hint = basename(filePathHint).toLowerCase()
    const scored = pool
      .map(file => ({ file, score: similarity(basename(file.path).toLowerCase(), hint) }))
      .sort((a, b) => b.score - a.score || b.file.size - a.file.size)
    return scored[0].file
  }

  return pool.reduce((best, f) => (f.size > best.size ? f : best))
}

// ── Resolved-stream cache ─────────────────────────────────────────────────────
// Premiumize charges fair-use points each time directdl generates a link, so
// cache the resolved URL briefly to avoid re-spending points on repeat plays
// (seek/retry) of the same hash within a short window.

interface ResolvedCacheEntry extends ResolvedStream {
  expiresAt: number
}

const RESOLVED_CACHE_TTL_MS = 3 * 60 * 1000
const resolvedStreamCache   = new Map<string, ResolvedCacheEntry>()

function resolveCacheKey(hash: string, filePathHint?: string, label?: string): string {
  return `pm:${hash}|${(filePathHint ?? '').toLowerCase()}|${(label ?? '').toLowerCase()}`
}

function getCachedResolvedStream(hash: string, filePathHint?: string, label?: string): ResolvedStream | null {
  const key   = resolveCacheKey(hash, filePathHint, label)
  const entry = resolvedStreamCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { resolvedStreamCache.delete(key); return null }
  return { url: entry.url, filename: entry.filename, bytes: entry.bytes }
}

function cacheResolvedStream(hash: string, filePathHint: string | undefined, label: string | undefined, value: ResolvedStream): void {
  resolvedStreamCache.set(resolveCacheKey(hash, filePathHint, label), {
    ...value,
    expiresAt: Date.now() + RESOLVED_CACHE_TTL_MS,
  })
}

// ── Public resolver ───────────────────────────────────────────────────────────

/**
 * Resolve a torrent hash to a direct-play URL via Premiumize's cache-only
 * directdl endpoint. Unlike RD/TorBox, directdl on an already-cached item is
 * stateless on Premiumize's side — it doesn't add a persistent transfer to
 * the account, so there's no library entry to clean up after playback.
 */
export async function resolveStream(
  hash: string,
  filePathHint?: string,
  label?: string,
): Promise<ResolvedStream> {
  if (!premiumizeApiKey()) throw new Error('PREMIUMIZE_API_KEY not configured')

  const cached = getCachedResolvedStream(hash, filePathHint, label)
  if (cached) {
    console.log(`premiumize: cache hit for ${hash.slice(0, 8)}… → ${cached.filename}`)
    return cached
  }

  const magnet = hashToMagnet(hash)

  // Free cache-only check before spending fair-use points on directdl.
  const isCached = await checkCached(magnet)
  if (!isCached) {
    throw new NotCachedError(`Torrent ${hash.slice(0, 8)} is not cached on Premiumize`)
  }

  const dl = await pmFetch<PmDirectDlResponse>('/transfer/directdl', { src: magnet })
  const files = dl.content ?? []

  if (!files.length) {
    // Single-file / non-torrent sources return a top-level location instead of content[].
    if (dl.location) {
      const resolved: ResolvedStream = {
        url:      dl.location,
        filename: dl.filename ?? basename(dl.location),
        bytes:    dl.filesize ?? 0,
      }
      console.log(`premiumize: resolved ${hash.slice(0, 8)}… → ${resolved.filename}`)
      cacheResolvedStream(hash, filePathHint, label, resolved)
      return resolved
    }
    throw new Error('Premiumize directdl returned no files')
  }

  const file = pickBestFile(files, filePathHint, label)
  console.log(`premiumize: resolved ${hash.slice(0, 8)}… → ${basename(file.path)}`)
  const resolved: ResolvedStream = { url: file.link, filename: basename(file.path), bytes: file.size }
  cacheResolvedStream(hash, filePathHint, label, resolved)
  return resolved
}
