/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "supabase" en la app publicada; sin definir, se usa el servidor local. */
  readonly VITE_CO_BACKEND?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
