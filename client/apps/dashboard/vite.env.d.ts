interface ImportMetaEnv {
  readonly VITE_PORT: string
  readonly VITE_PROXY_TARGET: string
  readonly VITE_API_URL: string
  readonly VITE_IMAGE_URL: string
  readonly VITE_VERSION: string
  readonly VITE_ANALYZER: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
