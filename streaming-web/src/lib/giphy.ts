import type { Show } from "@/lib/graphql-client"

const GIPHY_SEARCH_ENDPOINT = "https://api.giphy.com/v1/gifs/search"

type GiphyResponse = {
  data: Array<{
    id: string
    images: {
      original_mp4?: { mp4: string }
      preview_mp4?: { mp4: string }
      downsized_large?: { url: string }
      original?: { url: string }
    }
  }>
}

export type HeroClipMap = Record<number, string>

export async function fetchHeroClips(shows: Show[], apiKey?: string) {
  const trimmedKey = apiKey?.trim()
  const results: HeroClipMap = {}

  if (!trimmedKey || !shows.length) {
    return results
  }

  await Promise.all(
    shows.map(async (show) => {
      const clip = await fetchClip(show.title, trimmedKey)
      if (clip) {
        results[show.id] = clip
      }
    })
  )

  return results
}

async function fetchClip(title: string, apiKey: string) {
  const params = new URLSearchParams({
    api_key: apiKey,
    q: title,
    limit: "1",
    rating: "pg-13",
    lang: "en",
  })

  const response = await fetch(`${GIPHY_SEARCH_ENDPOINT}?${params.toString()}`)
  if (!response.ok) {
    console.warn(`Giphy request failed for ${title}: ${response.status}`)
    return null
  }

  const body = (await response.json()) as GiphyResponse
  const first = body.data?.[0]
  if (!first) {
    return null
  }

  return (
    first.images?.original_mp4?.mp4 ??
    first.images?.preview_mp4?.mp4 ??
    first.images?.downsized_large?.url ??
    first.images?.original?.url ??
    null
  )
}
