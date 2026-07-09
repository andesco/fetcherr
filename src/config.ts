export function normalizeSootioUrl(value: string): string {
  return value.trim().replace(/\/manifest\.json\/?$/i, '').replace(/\/$/, '')
}

export function parseStreamProviderUrls(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map(s => normalizeSootioUrl(s))
    .filter(Boolean)
}

export function collectStreamProviderUrls(...values: Array<string | undefined>): string[] {
  return [...new Set(values.flatMap(value => parseStreamProviderUrls(value ?? '')))]
}

export function parseMusicAddonUrls(value: string): string[] {
  return value
    .split(/[\r\n,]+/)
    .map(s => normalizeSootioUrl(s))
    .filter(Boolean)
}

export function parseTraktLists(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

export type TraktListMode = 'library' | 'folder' | 'collection' | 'browse_only'

export function parseTraktListModes(value: string): Record<string, TraktListMode> {
  if (!value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const MODES = new Set(['library', 'folder', 'collection', 'browse_only'])
      const result: Record<string, TraktListMode> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && MODES.has(v)) result[k] = v as TraktListMode
      }
      return result
    }
  } catch { /* ignore */ }
  return {}
}

export type MdblistListMode = 'library' | 'folder' | 'collection' | 'browse_only'

export interface MdblistListEntry {
  url: string
  name?: string
  mode?: MdblistListMode
}

const MDBLIST_MODES = new Set<string>(['library', 'folder', 'collection', 'browse_only'])

export function parseMdblistLists(value: string): MdblistListEntry[] {
  if (!value.trim()) return []
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return (parsed as unknown[])
          .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).url === 'string')
          .map(e => ({
            url: String(e.url).trim(),
            ...(e.name && String(e.name).trim() ? { name: String(e.name).trim() } : {}),
            ...(typeof e.mode === 'string' && MDBLIST_MODES.has(e.mode) ? { mode: e.mode as MdblistListMode } : {}),
          }))
          .filter(e => e.url)
      }
    } catch { /* fall through to legacy */ }
  }
  return trimmed
    .split(/[\r\n,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(url => ({ url }))
}

export function parseBooleanSetting(value: string | undefined, fallback = false): boolean {
  if (value == null || value === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export type ListFoldersSetting = boolean | string[]

export function parseFoldersSetting(value: string | undefined, fallback: ListFoldersSetting = false): ListFoldersSetting {
  if (value == null || value === '') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

export function serializeFoldersSetting(setting: ListFoldersSetting): string {
  if (typeof setting === 'boolean') return setting ? 'true' : 'false'
  return setting.join(',')
}

export type AudioLanguage =
  | 'en'
  | 'ja'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'ko'
  | 'zh'
  | 'pt'
  | 'ru'
  | 'hi'
  | 'ar'

export type EnglishStreamMode = 'off' | 'prefer' | 'require'
export type DirectPlaybackMode = 'off' | 'torrentsOnly' | 'all'
export type StreamRankingMode = 'fetcherr' | 'provider'
export type StremioSearchSource = 'cinemeta' | 'addon' | 'trakt'

export function parseStremioSearchSource(value: string | undefined): StremioSearchSource {
  if (value === 'addon' || value === 'trakt') return value
  return 'cinemeta'
}
export type MediaSourceLimit = 5 | 10 | 20

export function parseStreamRankingMode(value: string | undefined): StreamRankingMode {
  return value === 'provider' ? 'provider' : 'fetcherr'
}

export function parseMediaSourceLimit(value: string | undefined): MediaSourceLimit {
  if (value === '5') return 5
  if (value === '20') return 20
  return 10
}

export type ShowAddDefaultMode = 'all' | 'latest'
export type MovieReleaseMode = 'digital' | 'theatrical'

const AUDIO_LANGUAGE_ALIASES: Record<AudioLanguage, string[]> = {
  en: ['en', 'eng', 'english'],
  ja: ['ja', 'jpn', 'japanese'],
  es: ['es', 'spa', 'spanish', 'espanol', 'español', 'castellano', 'latino', 'latam'],
  fr: ['fr', 'fre', 'fra', 'french', 'francais', 'français'],
  de: ['de', 'ger', 'deu', 'german', 'deutsch'],
  it: ['it', 'ita', 'italian', 'italiano'],
  ko: ['ko', 'kor', 'korean'],
  zh: ['zh', 'zho', 'chi', 'chs', 'cht', 'zhs', 'zht', 'chinese', 'mandarin', 'cantonese'],
  pt: ['pt', 'por', 'portuguese', 'portugues', 'português', 'pt-br', 'ptbr', 'brazilian'],
  ru: ['ru', 'rus', 'russian'],
  hi: ['hi', 'hin', 'hindi'],
  ar: ['ar', 'ara', 'arabic'],
}

export function parseAudioLanguage(value: string | undefined): AudioLanguage {
  const normalized = (value ?? '').trim().toLowerCase()
  for (const [language, aliases] of Object.entries(AUDIO_LANGUAGE_ALIASES) as Array<[AudioLanguage, string[]]>) {
    if (aliases.includes(normalized)) return language
  }
  return 'en'
}

export function parseEnglishStreamMode(value: string): EnglishStreamMode {
  return value === 'off' || value === 'require' ? value : 'prefer'
}

export function parseDirectPlaybackMode(value: string | undefined): DirectPlaybackMode {
  return value === 'off' || value === 'all' ? value : 'torrentsOnly'
}

export function parseShowAddDefaultMode(value: string | undefined): ShowAddDefaultMode {
  return value === 'latest' ? 'latest' : 'all'
}

export function parseMovieReleaseMode(value: string | undefined): MovieReleaseMode {
  return value === 'theatrical' ? 'theatrical' : 'digital'
}

export function parsePositiveIntegerSetting(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  port:       parseInt(process.env.PORT ?? '9990'),
  host:       process.env.HOST ?? '0.0.0.0',
  dbPath:     process.env.DATABASE_PATH ?? '/app/data/fetcherr.db',
  tmdbApiKey: process.env.TMDB_API_KEY ?? '',
  tvdbApiKey: process.env.TVDB_API_KEY ?? '',
  sootioUrl:  normalizeSootioUrl(process.env.AIOSTREAM_URL ?? process.env.SOOTIO_URL ?? ''),
  serverName: process.env.SERVER_NAME ?? 'Fetcherr',
  serverId:   process.env.SERVER_ID  ?? 'fetcherr-001',
  rdApiKey:      process.env.RD_API_KEY ?? '',
  torBoxApiKey:  process.env.TORBOX_API_KEY ?? '',
  torBoxUserIp:  process.env.TORBOX_USER_IP ?? '',
  traktClientId:     process.env.TRAKT_CLIENT_ID ?? '',
  traktClientSecret: process.env.TRAKT_CLIENT_SECRET ?? '',
  traktUsername:     process.env.TRAKT_USERNAME ?? '',
  traktLists:        parseTraktLists(process.env.TRAKT_LISTS ?? ''),
  traktListModes:    parseTraktListModes(process.env.TRAKT_LIST_MODES ?? ''),
  traktWatchlistMovies: parseBooleanSetting(process.env.TRAKT_WATCHLIST_MOVIES, true),
  traktWatchlistShows:  parseBooleanSetting(process.env.TRAKT_WATCHLIST_SHOWS, true),
  traktWatchHistory: parseBooleanSetting(process.env.TRAKT_WATCH_HISTORY, false),
  traktCollections: parseBooleanSetting(process.env.TRAKT_COLLECTIONS, false),
  traktFolders: parseFoldersSetting(process.env.TRAKT_FOLDERS, false),
  mdblistApiKey: process.env.MDBLIST_API_KEY ?? '',
  mdblistLists: parseMdblistLists(process.env.MDBLIST_LISTS ?? ''),
  mdblistFolders: parseFoldersSetting(process.env.MDBLIST_FOLDERS, false),
  mdblistMaxItems: parsePositiveIntegerSetting(process.env.MDBLIST_MAX_ITEMS, 1000),
  showAddDefaultMode: parseShowAddDefaultMode(process.env.SHOW_ADD_DEFAULT_MODE),
  movieReleaseMode: parseMovieReleaseMode(process.env.MOVIE_RELEASE_MODE),
  streamProviderUrls: parseStreamProviderUrls(process.env.STREAM_PROVIDER_URLS ?? ''),
  stremioSearchProviderUrls: [] as string[],
  allowNotWebReadyDirectStreams: parseBooleanSetting(process.env.ALLOW_NOT_WEB_READY_DIRECT_STREAMS, false),
  musicAddonUrls: parseMusicAddonUrls(process.env.MUSIC_ADDON_URLS ?? process.env.MUSIC_ADDON_URL ?? process.env.SPOTIFLAC_URL ?? ''),
  preferredAudioLanguage: parseAudioLanguage(process.env.PREFERRED_AUDIO_LANGUAGE),
  englishStreamMode: parseEnglishStreamMode(process.env.ENGLISH_STREAM_MODE ?? ''),
  directPlaybackMode: parseDirectPlaybackMode(process.env.DIRECT_PLAYBACK_MODE),
  streamRankingMode: parseStreamRankingMode(process.env.STREAM_RANKING_MODE),
  stremioSearchEnabled: parseBooleanSetting(process.env.STREMIO_SEARCH_ENABLED, false),
  stremioSearchSource: parseStremioSearchSource(process.env.STREMIO_SEARCH_SOURCE),
  mediaSourceSelection: parseBooleanSetting(process.env.MEDIA_SOURCE_SELECTION, false),
  mediaSourceLimit: parseMediaSourceLimit(process.env.MEDIA_SOURCE_LIMIT),
  serverUrl:         (process.env.SERVER_URL ?? 'http://localhost:9990').replace(/\/$/, ''),
  newznabUrl:        (process.env.NEWZNAB_URL ?? '').replace(/\/$/, ''),
  newznabApiKey:     process.env.NEWZNAB_API_KEY ?? '',
  nntpHost:          process.env.NNTP_HOST ?? '',
  nntpPort:          parseInt(process.env.NNTP_PORT ?? '563', 10),
  nntpUser:          process.env.NNTP_USER ?? '',
  nntpPass:          process.env.NNTP_PASS ?? '',
  nntpConnections:   parsePositiveIntegerSetting(process.env.NNTP_CONNECTIONS, 4),
  nntpSsl:           parseBooleanSetting(process.env.NNTP_SSL, true),
}
