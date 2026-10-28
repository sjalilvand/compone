'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * هوک سبک واکشی داده — fetch + loading + error + refetch
 * url خالی (null) یعنی واکشی غیرفعال؛ loading از حالت مشتق می‌شود.
 */
export function useApi<T>(url: string | null, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [tick, setTick] = useState(0)
  const depsKey = useMemo(() => JSON.stringify(deps), [deps])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  const fetchKey = url ? `${url}|${depsKey}|${tick}` : ''
  const loading = Boolean(url) && fetchKey !== loadedKey

  useEffect(() => {
    if (!url) return
    let cancelled = false
    const controller = new AbortController()
    const key = fetchKey
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          let msg = `خطای سرور (کد ${res.status})`
          try {
            const body = (await res.json()) as { error?: string }
            if (body?.error) msg = body.error
          } catch {
            /* پاسخ JSON نبود */
          }
          throw new Error(msg)
        }
        return res.json() as Promise<T>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setError(null)
          setLoadedKey(key)
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'خطای ناشناخته در دریافت اطلاعات')
        setLoadedKey(key)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [url, depsKey, tick, fetchKey])

  return { data, loading, error, refetch }
}

/** واکشی خام با تبدیل خطای فارسی سرور به استثنا */
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    })
  } catch {
    throw new Error('ارتباط با سرور برقرار نشد')
  }
  if (!res.ok) {
    let msg = `خطای سرور (کد ${res.status})`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) msg = body.error
    } catch {
      /* پاسخ JSON نبود */
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}
