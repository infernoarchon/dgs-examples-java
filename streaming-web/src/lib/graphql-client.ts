import { GraphQLClient, gql } from "graphql-request";

export type Review = {
  starScore?: number | null
}

export type Show = {
  id: number
  title: string
  releaseYear?: number | null
  reviews?: Review[]
}

type ShowsResponse = {
  shows: Show[]
}

const endpoint = resolveEndpoint(import.meta.env.VITE_GRAPHQL_URL ?? "/graphql");

export const graphQLClient = new GraphQLClient(endpoint, {
  credentials: "include",
});

export const SHOWS_QUERY = gql`
  query ShowsForLanding {
    shows {
      id
      title
      releaseYear
      reviews {
        starScore
      }
    }
  }
`;

export async function fetchShows() {
  const data = await graphQLClient.request<ShowsResponse>(SHOWS_QUERY)
  return data.shows ?? []
}

function resolveEndpoint(target: string) {
  const trimmed = target.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (typeof window !== "undefined" && window.location) {
    const prefix = trimmed.startsWith("/") ? "" : "/"
    return `${window.location.origin}${prefix}${trimmed}`
  }

  return trimmed
}
