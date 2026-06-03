import { config } from '../config.js'

export interface NzbItem {
  title: string
  nzbUrl: string
  sizeBytes: number
}

interface NewznabAttr {
  '@attributes': { name: string; value: string }
}

interface NewznabItem {
  title?: string
  link?: string
  enclosure?: { '@attributes': { url?: string; length?: string } }
  attr?: NewznabAttr | NewznabAttr[]
}

interface NewznabResponse {
  item?: NewznabItem[]
  channel?: { item?: NewznabItem[] }
}

function getAttr(item: NewznabItem, name: string): string {
  const attrs = item.attr ? (Array.isArray(item.attr) ? item.attr : [item.attr]) : []
  return attrs.find(a => a['@attributes']?.name === name)?.['@attributes']?.value ?? ''
}

function parseItems(raw: NewznabResponse): NzbItem[] {
  const items: NewznabItem[] = raw.item ?? raw.channel?.item ?? []
  return items
    .map(item => {
      const nzbUrl = item.link?.split('&amp;').join('&') || item.enclosure?.['@attributes']?.url || ''
      const sizeStr = getAttr(item, 'size') || item.enclosure?.['@attributes']?.length || '0'
      return { title: item.title ?? '', nzbUrl, sizeBytes: parseInt(sizeStr, 10) || 0 }
    })
    .filter(item => item.nzbUrl && item.title)
}

async function newznabRequest(params: Record<string, string>): Promise<NzbItem[]> {
  if (!config.newznabUrl || !config.newznabApiKey) throw new Error('Newznab not configured')
  const url = new URL(`${config.newznabUrl}/api`)
  url.searchParams.set('apikey', config.newznabApiKey)
  url.searchParams.set('o', 'json')
  url.searchParams.set('extended', '1')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Newznab returned ${res.status}`)
  const json = await res.json() as NewznabResponse
  return parseItems(json)
}

export async function searchMovieByImdbId(imdbId: string): Promise<NzbItem[]> {
  const id = imdbId.replace(/^tt/i, '')
  return newznabRequest({ t: 'movie', imdbid: id, cat: '2000' })
}

export async function searchSeriesByTvdbId(tvdbId: number, season: number, episode: number): Promise<NzbItem[]> {
  return newznabRequest({
    t: 'tvsearch',
    tvdbid: String(tvdbId),
    season: String(season),
    ep: String(episode),
    cat: '5000',
  })
}

export async function searchByTitle(title: string): Promise<NzbItem[]> {
  return newznabRequest({ t: 'search', q: title })
}

export function isUsenetConfigured(): boolean {
  return Boolean(config.newznabUrl && config.newznabApiKey && config.nntpHost && config.nntpUser && config.nntpPass)
}
