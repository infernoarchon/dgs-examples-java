import type { Show } from "@/lib/graphql-client"

const OMDB_ENDPOINT = "https://www.omdbapi.com/"

type OmdbResponse = {
  Response: "True" | "False"
  Poster?: string
  Plot?: string
  Rated?: string
  Runtime?: string
  Genre?: string
  Year?: string
  imdbRating?: string
  imdbVotes?: string
  Type?: "movie" | "series"
  Error?: string
}

export type OmdbDetails = {
  poster?: string
  plot?: string
  rated?: string
  runtimeMinutes?: number
  genres?: string[]
  imdbRating?: number
  imdbVotes?: number
  year?: number
  type?: "movie" | "series"
}

export type OmdbDetailsMap = Record<number, OmdbDetails>

export async function fetchOmdbDetails(shows: Show[], apiKey: string) {
  const trimmedKey = apiKey?.trim()
  const results: OmdbDetailsMap = {}
  if (!trimmedKey || !shows.length) {
    return results
  }

  await Promise.all(
    shows.map(async (show) => {
      try {
        const details = await fetchDetails(show, trimmedKey)
        if (details) {
          results[show.id] = details
        }
      } catch (error) {
        console.warn(`OMDb lookup failed for "${show.title}":`, error)
      }
    })
  )

  return results
}

async function fetchDetails(show: Show, apiKey: string) {
  const params = new URLSearchParams({
    apikey: apiKey,
    plot: "short",
  })

  if (show.imdbId) {
    params.set("i", show.imdbId)
  } else {
    params.set("t", show.title)
    if (show.releaseYear) {
      params.set("y", String(show.releaseYear))
    }
    params.set("type", show.type === "movie" ? "movie" : "series")
  }

  const response = await fetch(`${OMDB_ENDPOINT}?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`OMDb request failed with status ${response.status}`)
  }

  const body = (await response.json()) as OmdbResponse
  if (body.Response === "True") {
    return {
      poster: sanitize(body.Poster),
      plot: sanitize(body.Plot),
      rated: sanitize(body.Rated),
      runtimeMinutes: parseRuntime(body.Runtime),
      genres: parseGenres(body.Genre),
      imdbRating: parseFloatSafe(body.imdbRating),
      imdbVotes: parseIntSafe(body.imdbVotes),
      year: parseYear(body.Year),
      type: body.Type === "movie" || body.Type === "series" ? body.Type : undefined,
    }
  }

  return null
}

const sanitize = (value?: string) => (value && value !== "N/A" ? value : undefined)

const parseRuntime = (value?: string) => {
  if (!value) return undefined
  const minutesMatch = value.match(/(\d+)\s*min/i)
  if (minutesMatch) {
    return Number(minutesMatch[1])
  }
  // Some OMDb runtimes are formatted like "1 h 58 min"
  const hoursMatch = value.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?/i)
  if (hoursMatch) {
    const hours = Number(hoursMatch[1])
    const minutes = hoursMatch[2] ? Number(hoursMatch[2]) : 0
    return hours * 60 + minutes
  }
  return undefined
}

const parseGenres = (value?: string) =>
  value && value !== "N/A"
    ? value
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean)
    : undefined

const parseFloatSafe = (value?: string) => {
  if (!value || value === "N/A") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseIntSafe = (value?: string) => {
  if (!value || value === "N/A") return undefined
  const normalized = value.replace(/,/g, "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseYear = (value?: string) => {
  if (!value || value === "N/A") return undefined
  const match = value.match(/\d{4}/)
  return match ? Number(match[0]) : undefined
}
