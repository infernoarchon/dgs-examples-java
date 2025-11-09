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

export type HeroClip = {
  primary?: string | null
  secondary?: string | null
}

export type HeroClipMap = Record<number, HeroClip>

export async function fetchHeroClips(shows: Show[], apiKey?: string) {
  const trimmedKey = apiKey?.trim()
  const results: HeroClipMap = {}

  if (!trimmedKey || !shows.length) {
    return results
  }

  await Promise.all(
    shows.map(async (show) => {
      const clip = await fetchClipPair(show.title, trimmedKey)
      if (clip.primary || clip.secondary) {
        results[show.id] = clip
      }
    })
  )

  return results
}

async function fetchClipPair(title: string, apiKey: string): Promise<HeroClip> {
  const params = new URLSearchParams({
    api_key: apiKey,
    q: title,
    limit: "2",
    rating: "pg-13",
    lang: "en",
  })

  const response = await fetch(`${GIPHY_SEARCH_ENDPOINT}?${params.toString()}`)
  if (!response.ok) {
    console.warn(`Giphy request failed for ${title}: ${response.status}`)
    return { primary: null, secondary: null }
  }

  const body = (await response.json()) as GiphyResponse
  const first = body.data?.[0]
  const second = body.data?.[1]

  const select = (gif?: GiphyResponse["data"][number]) =>
    gif
      ? gif.images?.original_mp4?.mp4 ??
        gif.images?.preview_mp4?.mp4 ??
        gif.images?.downsized_large?.url ??
        gif.images?.original?.url ??
        null
      : null

  return {
    primary: select(first),
    secondary: select(second),
  }
}
