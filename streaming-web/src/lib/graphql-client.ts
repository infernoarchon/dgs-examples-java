import { NETFLIX_CATALOG, type NetflixCatalogSeed } from "@/data/netflix-catalog"
import { fetchOmdbDetails } from "@/lib/omdb"

export type Show = NetflixCatalogSeed & {
  poster?: string
  genres?: string[]
  imdbRating?: number
  imdbVotes?: number
}

export async function fetchShows(): Promise<Show[]> {
  const catalog: Show[] = NETFLIX_CATALOG.map((seed, index) => ({
    ...seed,
    id: seed.id ?? index + 1,
  }))

  const omdbKey = import.meta.env.VITE_OMDB_API_KEY?.trim()
  if (!omdbKey) {
    return catalog
  }

  const detailsMap = await fetchOmdbDetails(catalog, omdbKey)

  return catalog.map((show) => {
    const omdb = detailsMap[show.id]
    if (!omdb) {
      return show
    }

    return {
      ...show,
      releaseYear: show.releaseYear ?? omdb.year ?? show.releaseYear,
      maturityRating: omdb.rated ?? show.maturityRating,
      runtimeMinutes: omdb.runtimeMinutes ?? show.runtimeMinutes,
      synopsis: omdb.plot ?? show.synopsis,
      poster: omdb.poster ?? show.poster,
      imdbRating: omdb.imdbRating ?? show.imdbRating,
      imdbVotes: omdb.imdbVotes ?? show.imdbVotes,
      type: omdb.type === "movie" || omdb.type === "series" ? omdb.type : show.type,
      genres: omdb.genres?.length ? omdb.genres : show.genres,
    }
  })
}
