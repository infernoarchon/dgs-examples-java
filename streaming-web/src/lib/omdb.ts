import type { Show } from "@/lib/graphql-client"

const OMDB_ENDPOINT = "https://www.omdbapi.com/"

type OmdbResponse = {
  Response: "True" | "False"
  Poster?: string
  Plot?: string
  Error?: string
}

export type OmdbDetails = {
  poster?: string
  plot?: string
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
        const details = await fetchDetails(show.title, trimmedKey)
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

async function fetchDetails(title: string, apiKey: string) {
  const params = new URLSearchParams({
    apikey: apiKey,
    t: title,
    type: "series",
    plot: "short",
  })

  const response = await fetch(`${OMDB_ENDPOINT}?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`OMDb request failed with status ${response.status}`)
  }

  const body = (await response.json()) as OmdbResponse
  if (body.Response === "True") {
    return {
      poster: body.Poster && body.Poster !== "N/A" ? body.Poster : undefined,
      plot: body.Plot && body.Plot !== "N/A" ? body.Plot : undefined,
    }
  }

  return null
}
