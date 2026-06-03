import { config } from '../config.js'
import { searchMovieByImdbId, searchSeriesByTvdbId, type NzbItem } from './newznab.js'
import { parseNzb, buildOffsetTable, type NzbSegment } from './nzb-parser.js'
import { imdbToTvdbId } from '../tvdb.js'

export { isUsenetConfigured } from './newznab.js'

export interface UsenetStreamJob {
  id: string
  segments: NzbSegment[]
  offsets: number[]
  filename: string
  estimatedTotalBytes: number
  createdAt: number
}

const USENET_JOB_TTL_MS = 6 * 60 * 60 * 1000
export const usenetStreamJobs = new Map<string, UsenetStreamJob>()

function pruneJobs(): void {
  const cutoff = Date.now() - USENET_JOB_TTL_MS
  for (const [id, job] of usenetStreamJobs) {
    if (job.createdAt < cutoff) usenetStreamJobs.delete(id)
  }
}

function makeJobId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

async function downloadAndParseNzb(nzbUrl: string): Promise<ReturnType<typeof parseNzb>> {
  const urlWithKey = nzbUrl.includes('apikey') ? nzbUrl
    : nzbUrl + (nzbUrl.includes('?') ? '&' : '?') + `apikey=${config.newznabApiKey}`
  const res = await fetch(urlWithKey, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`NZB download returned ${res.status}`)
  const xml = await res.text()
  return parseNzb(xml)
}

async function createJobFromItems(items: NzbItem[], label: string): Promise<UsenetStreamJob> {
  pruneJobs()

  const errors: string[] = []
  for (const item of items.slice(0, 5)) {
    try {
      const parsed = await downloadAndParseNzb(item.nzbUrl)
      if (!parsed) {
        console.log(`usenet: NZB for "${item.title}" has no usable video file (RAR or unsupported), skipping`)
        continue
      }
      console.log(`usenet: selected "${parsed.file.filename}" (${parsed.file.segments.length} segments) for ${label}`)
      const id = makeJobId()
      const job: UsenetStreamJob = {
        id,
        segments: parsed.file.segments,
        offsets: buildOffsetTable(parsed.file.segments),
        filename: parsed.file.filename,
        estimatedTotalBytes: parsed.estimatedDecodedBytes,
        createdAt: Date.now(),
      }
      usenetStreamJobs.set(id, job)
      return job
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`usenet: failed to use NZB for "${item.title}": ${msg}`)
      errors.push(msg)
    }
  }

  throw new Error(`usenet: no usable NZB found for ${label}${errors.length ? `: ${errors[0]}` : ''}`)
}

export async function resolveUsenetMovieStream(imdbId: string): Promise<{ url: string; filename: string }> {
  console.log(`usenet: searching for movie ${imdbId}`)
  const items = await searchMovieByImdbId(imdbId)
  if (!items.length) throw new Error(`usenet: no NZB results for movie ${imdbId}`)
  console.log(`usenet: found ${items.length} NZB result(s) for ${imdbId}`)

  const job = await createJobFromItems(items, imdbId)
  return {
    url: `${config.serverUrl}/usenet/stream/${job.id}`,
    filename: job.filename,
  }
}

export async function resolveUsenetEpisodeStream(
  imdbId: string,
  season: number,
  episode: number,
): Promise<{ url: string; filename: string }> {
  const label = `${imdbId} S${season}E${episode}`
  console.log(`usenet: searching for ${label}`)

  const tvdbId = await imdbToTvdbId(imdbId)
  if (!tvdbId) throw new Error(`usenet: could not resolve TVDB ID for ${imdbId}`)

  const items = await searchSeriesByTvdbId(tvdbId, season, episode)
  if (!items.length) throw new Error(`usenet: no NZB results for ${label}`)
  console.log(`usenet: found ${items.length} NZB result(s) for ${label}`)

  const job = await createJobFromItems(items, label)
  return {
    url: `${config.serverUrl}/usenet/stream/${job.id}`,
    filename: job.filename,
  }
}
