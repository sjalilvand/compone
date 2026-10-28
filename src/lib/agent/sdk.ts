// پوشش‌های مقاوم روی z-ai-web-dev-sdk — فقط سمت سرور

import ZAI from 'z-ai-web-dev-sdk'
import * as cheerio from 'cheerio'

 

type ZAIClient = Awaited<ReturnType<typeof ZAI.create>>
let zaiInstance: ZAIClient | null = null
let zaiInitPromise: Promise<ZAIClient> | null = null

async function getZAI(): Promise<ZAIClient> {
  if (zaiInstance) return zaiInstance
  if (!zaiInitPromise) {
    zaiInitPromise = ZAI.create().then((c) => {
      zaiInstance = c
      return c
    })
  }
  return zaiInitPromise
}

const TIMEOUT_MS = 60_000
const MAX_RETRIES = 2

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`تایم‌اوت ${label} پس از ${ms}ms`)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** اجرای کاری با تلاش مجدد (حداکثر ۲ بار) */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[sdk] ${label} attempt ${attempt + 1} failed: ${msg}`)
      if (attempt < MAX_RETRIES) await sleep(800 * (attempt + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export interface SearchResult {
  url: string
  title: string
  snippet: string
}

function coerceResults(raw: any): SearchResult[] {
  // شکل‌های ممکن: آرایه مستقیم، {results:[]}، {data:[]}، {items:[]}
  let arr: any[] = []
  if (Array.isArray(raw)) arr = raw
  else if (raw && typeof raw === 'object') {
    const candidate = raw.results ?? raw.data ?? raw.items ?? raw.search_result ?? null
    if (Array.isArray(candidate)) arr = candidate
  }
  const out: SearchResult[] = []
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue
    const url = typeof it.url === 'string' ? it.url : typeof it.link === 'string' ? it.link : ''
    const title = typeof it.title === 'string' ? it.title : typeof it.name === 'string' ? it.name : ''
    const snippet =
      typeof it.snippet === 'string'
        ? it.snippet
        : typeof it.description === 'string'
          ? it.description
          : typeof it.content === 'string'
            ? it.content
            : ''
    if (!url && !title) continue
    out.push({ url, title, snippet })
  }
  return out
}

/** جست‌وجوی وب — همیشه آرایه برمی‌گرداند */
export async function webSearch(query: string, num = 8): Promise<SearchResult[]> {
  try {
    return await withRetry(async () => {
      const zai = await getZAI()
      const raw = await withTimeout(
        zai.functions.invoke('web_search', { query, num }) as Promise<unknown>,
        TIMEOUT_MS,
        `web_search: ${query.slice(0, 60)}`,
      )
      return coerceResults(raw)
    }, 'web_search')
  } catch (e) {
    console.warn(`[sdk] webSearch failed for "${query}":`, e instanceof Error ? e.message : e)
    return []
  }
}

export interface PageContent {
  html: string
  title: string
  publishedTime: string | null
  url: string
}

/** خواندن صفحه — در خطا null */
export async function readPage(url: string): Promise<PageContent | null> {
  try {
    return await withRetry(async () => {
      const zai = await getZAI()
      const raw = (await withTimeout(
        zai.functions.invoke('page_reader', { url }) as Promise<any>,
        TIMEOUT_MS,
        `page_reader: ${url.slice(0, 60)}`,
      )) as any
      // شکل ممکن: { code, data: { html, title, url, publishedTime }, meta, status }
      const data = raw?.data ?? raw
      const html: string =
        typeof data?.html === 'string'
          ? data.html
          : typeof data?.content === 'string'
            ? data.content
            : typeof data?.text === 'string'
              ? data.text
              : ''
      if (!html) throw new Error('پاسخ page_reader خالی بود')
      return {
        html,
        title: typeof data?.title === 'string' ? data.title : '',
        publishedTime:
          typeof data?.publishedTime === 'string'
            ? data.publishedTime
            : typeof data?.published_time === 'string'
              ? data.published_time
              : null,
        url: typeof data?.url === 'string' && data.url ? data.url : url,
      }
    }, 'page_reader')
  } catch (e) {
    console.warn(`[sdk] readPage failed for "${url}":`, e instanceof Error ? e.message : e)
    return null
  }
}

/** گفت‌وگو با LLM — فقط متن خروجی */
export async function chat(system: string, user: string, opts?: { maxTokens?: number }): Promise<string> {
  return withRetry(async () => {
    const zai = await getZAI()
    const completion = await withTimeout(
      zai.chat.completions.create({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        thinking: { type: 'disabled' },
        ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      }) as Promise<any>,
      TIMEOUT_MS,
      'chat',
    )
    const content = completion?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('پاسخ LLM خالی بود')
    return content
  }, 'chat')
}

/** استخراج بلوک JSON متوازن از متن */
function extractJsonBlock(text: string): string | null {
  // حذف محصورکننده‌های مارک‌داون
  const cleaned = text
    .replace(/```json\s*/gi, '```')
    .split('```')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('{') || s.startsWith('['))
  const candidates: string[] = [...cleaned, text.trim()]

  // ابتدا کل متن‌های نامزد را مستقیم امتحان کن
  for (const c of candidates) {
    try {
      JSON.parse(c)
      return c
    } catch {
      /* ادامه */
    }
  }
  // پیدا کردن اولین { یا [ و استخراج متوازن
  const src = text
  for (const open of ['{', '[']) {
    const start = src.indexOf(open)
    if (start < 0) continue
    const close = open === '{' ? '}' : ']'
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = start; i < src.length; i++) {
      const ch = src[i]
      if (inStr) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') inStr = true
      else if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) {
          const sub = src.slice(start, i + 1)
          try {
            JSON.parse(sub)
            return sub
          } catch {
            break
          }
        }
      }
    }
  }
  return null
}

/** گفت‌وگو با خروجی JSON — در خطا null */
export async function chatJSON<T>(system: string, user: string, opts?: { maxTokens?: number }): Promise<T | null> {
  try {
    const text = await chat(system, user, opts)
    const block = extractJsonBlock(text)
    if (!block) {
      console.warn('[sdk] chatJSON: بلوک JSON یافت نشد، شروع پاسخ:', text.slice(0, 120))
      return null
    }
    return JSON.parse(block) as T
  } catch (e) {
    console.warn('[sdk] chatJSON failed:', e instanceof Error ? e.message : e)
    return null
  }
}

const TEXT_CAP = 12000
const HEAD = 6000
const TAIL = 6000

/** تبدیل HTML به متن خالص — با سقف ۱۲۰۰۰ نویسه (برش میانه با حفظ ابتدا و انتها) */
export function htmlToText(html: string): string {
  try {
    const $ = cheerio.load(html)
    $('script, style, noscript, svg, iframe, template').remove()
    let text = $('body').text() || $.root().text() || ''
    // رمزگشایی موجودیت‌های پایه
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, d) => {
        try {
          return String.fromCodePoint(parseInt(d, 10))
        } catch {
          return ' '
        }
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
        try {
          return String.fromCodePoint(parseInt(h, 16))
        } catch {
          return ' '
        }
      })
    text = text.replace(/\s+/g, ' ').trim()
    if (text.length > TEXT_CAP) {
      text = text.slice(0, HEAD) + ' …[میانه حذف شد]… ' + text.slice(text.length - TAIL)
    }
    return text
  } catch (e) {
    console.warn('[sdk] htmlToText failed:', e instanceof Error ? e.message : e)
    return ''
  }
}
