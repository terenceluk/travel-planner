const KEY_STORAGE = 'travel-planner-api-key'

export function getStoredApiKey(): string | null {
  try { return localStorage.getItem(KEY_STORAGE) } catch { return null }
}

export function saveApiKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch { /* ignore */ }
}

/**
 * Drop-in replacement for `fetch` that automatically injects
 * the user's Google Maps API key as a header when one is stored.
 * The server uses it as a fallback only when it has no server-side key configured.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const key = getStoredApiKey()
  const base = (options.headers ?? {}) as Record<string, string>
  const headers: Record<string, string> = { ...base }
  if (key) headers['X-Google-Api-Key'] = key
  return fetch(url, { ...options, headers })
}
