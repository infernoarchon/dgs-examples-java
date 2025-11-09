/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_URL?: string
  readonly VITE_OMDB_API_KEY?: string
  readonly VITE_GIPHY_API_KEY?: string
  readonly VITE_OPENAI_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
