import { config, DISCOVER_CATEGORIES, type DiscoverCategoryDef } from './config.js'
import { pruneOrphanedMovies, pruneOrphanedShows, removeSourceKey, replaceSourceItemsWithPositions } from './db.js'
import {
  fetchMovieByTmdbId, fetchShowByTmdbId,
  fetchTrendingMovies, fetchTrendingShows,
  fetchPopularMovies, fetchPopularShows,
  fetchTopRatedMovies, fetchTopRatedShows,
  fetchUpcomingMovies, fetchOnTheAirShows,
} from './tmdb.js'

export const DISCOVER_SOURCE_PREFIX = 'discover:'

export function discoverSourceKey(slug: string): string {
  return `${DISCOVER_SOURCE_PREFIX}${slug}`
}

async function fetchCategoryTmdbIds(slug: string): Promise<number[]> {
  switch (slug) {
    case 'trending-movies':  return fetchTrendingMovies()
    case 'trending-shows':   return fetchTrendingShows()
    case 'popular-movies':   return fetchPopularMovies()
    case 'popular-shows':    return fetchPopularShows()
    case 'top-rated-movies': return fetchTopRatedMovies()
    case 'top-rated-shows':  return fetchTopRatedShows()
    case 'upcoming-movies':  return fetchUpcomingMovies()
    case 'on-the-air-shows': return fetchOnTheAirShows()
    default: return []
  }
}

async function syncDiscoverCategory(def: DiscoverCategoryDef): Promise<void> {
  const sourceKey = discoverSourceKey(def.slug)
  const tmdbIds = await fetchCategoryTmdbIds(def.slug)
  const sourceItems = tmdbIds.map((tmdbId, idx) => ({ tmdbId, sourcePosition: idx + 1 }))

  for (const tmdbId of tmdbIds) {
    if (def.mediaType === 'movie') await fetchMovieByTmdbId(tmdbId)
    else await fetchShowByTmdbId(tmdbId)
  }

  const removed = replaceSourceItemsWithPositions(sourceKey, def.mediaType, sourceItems)
  if (def.mediaType === 'movie') pruneOrphanedMovies(removed)
  else pruneOrphanedShows(removed)
}

export async function syncAllDiscoverCategories(): Promise<void> {
  if (!config.discoverEnabled || !config.tmdbApiKey) return
  for (const def of DISCOVER_CATEGORIES) {
    try {
      await syncDiscoverCategory(def)
    } catch (err) {
      console.error(`discover: sync failed for ${def.slug}`, err)
    }
  }
  console.log('discover: sync complete')
}

export function removeAllDiscoverSourceItems(): void {
  for (const def of DISCOVER_CATEGORIES) {
    const removed = removeSourceKey(discoverSourceKey(def.slug), def.mediaType)
    if (def.mediaType === 'movie') pruneOrphanedMovies(removed)
    else pruneOrphanedShows(removed)
  }
}
