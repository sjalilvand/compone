// پوشش‌های مقاوم روی z-ai-web-dev-sdk — فقط سمت سرور

import ZAI from 'z-ai-web-dev-sdk'
import * as cheerio from 'cheerio'

 

type ZAIClient = Awaited<ReturnType<typeof ZAI.create>>
let zaiInstance: ZAIClient | null = null
let zaiInitPromise: Promise<ZAIClient> | null = null

async function getZAI(): Promise<ZAIClient> {
  if (zaiInstance) return zaiInstance
  if (!zaiInitPromise) {
    // نکته حیاتی: ZAI.create() در محیط بدون پیکربندی ممکن است برای همیشه معلق بماند؛
    // بنابراین با سقف زمانی ۳۰ ثانیه محاصره می‌شود تا کار به‌جای «گیر کردن بی‌صدا» با پیام روشن شکست بخورد
    zaiInitPromise = withTimeout(ZAI.create() as Promise<ZAIClient>, 30_000, 'راه‌اندازی سرویس هوش مصنوعی')
      .then((c) => {
        zaiInstance = c
        return c
      })
      .catch((e: unknown) => {
        // اجازه تلاش مجدد پس از رفع پیکربندی بدون ری‌استارت
        zaiInitPromise = null
        zaiInstance = null
        const detail = e instanceof Error ? e.message : String(e)
        throw new SdkUnavailableError(
          `اتصال به سرویس هوش مصنوعی و جست‌وجوی وب برقرار نشد (${detail}) — برای فعال‌سازی کشف هوشمند، فایل پیکربندی .z-ai-config باید در ریشه پروژه یا پوشه کاربری موجود باشد.`,
        )
      })
  }
  return zaiInitPromise
}

const TIMEOUT_MS = 60_000
const MAX_RETRIES = 3

/* محدودساز نرخ سراسری — فاصله حداقلی بین فراخوانی‌های SDK (حتی بین کارهای موازی)
   تا سقف نرخ سرویس (429) فعال نشود */
const globalRate = globalThis as unknown as { __sdkLastCallAt?: number; __sdkWaiter?: Promise<void> }
// ۱۲ ثانیه → حداکثر ~۳.۵ درخواست/دقیقه پایدار، زیر سقف نرخ غلتان سرویس
const MIN_INTERVAL_MS = 12_000

async function rateLimit(): Promise<void> {
  // صف انتظار سراسری تا فراخوانی‌های هم‌زمان پشت هم نپرد
  while (globalRate.__sdkWaiter) {
    try {
      await globalRate.__sdkWaiter
    } catch {
      /* صف فقط برای ترتیب است */
    }
  }
  let release: () => void = () => {}
  const ticket = new Promise<void>((r) => (release = r))
  globalRate.__sdkWaiter = ticket
  try {
    const last = globalRate.__sdkLastCallAt ?? 0
    const wait = last + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
  } finally {
    globalRate.__sdkLastCallAt = Date.now()
    release()
    if (globalRate.__sdkWaiter === ticket) globalRate.__sdkWaiter = undefined
  }
}

/** خطای عدم دسترسی به سرویس هوش مصنوعی — نباید بی‌صدا بلعیده شود */
export class SdkUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SdkUnavailableError'
  }
}

export function isSdkUnavailable(e: unknown): boolean {
  return e instanceof SdkUnavailableError
}

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

/** اجرای کاری با تلاش مجدد (حداکثر ۳ بار) — خطای عدم دسترسی سرویس بدون تلاش مجدد؛
 *  خطای 429 (محدودیت نرخ) با انتظار طولانی و تلاش مجدد مدیریت می‌شود */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (isSdkUnavailable(e)) throw e
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[sdk] ${label} attempt ${attempt + 1} failed: ${msg}`)
      if (attempt < MAX_RETRIES) {
        // محدودیت نرخ → انتظار بلند (پنجره سهمیه معمولا حدود یک دقیقه است)
        if (/429|rate.?limit|too many/i.test(msg)) await sleep(20_000 * (attempt + 1))
        else await sleep(800 * (attempt + 1))
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/* مدارشکن 429 — شمارش شکست‌های پیاپی محدودیت نرخ؛
   با ۳ شکست پیاپی سرویس «تخریب‌شده» تلقی می‌شود تا موتور کار را موقتاً متوقف کند */
const globalBreaker = globalThis as unknown as { __sdk429Streak?: number }

export function noteSdkSuccess(): void {
  globalBreaker.__sdk429Streak = 0
}

export function noteSdkRateLimitFailure(): void {
  globalBreaker.__sdk429Streak = (globalBreaker.__sdk429Streak ?? 0) + 1
}

export function isServiceDegraded(): boolean {
  return (globalBreaker.__sdk429Streak ?? 0) >= 3
}

function isRateLimitError(msg: string): boolean {
  return /429|rate.?limit|too many/i.test(msg)
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

/** جست‌وجوی وب — خطای عدم دسترسی سرویس منتقل می‌شود، سایر خطاها آرایه خالی */
export async function webSearch(query: string, num = 8): Promise<SearchResult[]> {
  try {
    return await withRetry(async () => {
      const zai = await getZAI()
      await rateLimit()
      const raw = await withTimeout(
        zai.functions.invoke('web_search', { query, num }) as Promise<unknown>,
        TIMEOUT_MS,
        `web_search: ${query.slice(0, 60)}`,
      )
      noteSdkSuccess()
      return coerceResults(raw)
    }, 'web_search')
  } catch (e) {
    if (isSdkUnavailable(e)) throw e
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[sdk] webSearch failed for "${query}":`, msg)
    if (isRateLimitError(msg)) noteSdkRateLimitFailure()
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
      await rateLimit()
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
      noteSdkSuccess()
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
    if (isSdkUnavailable(e)) throw e
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[sdk] readPage failed for "${url}":`, msg)
    if (isRateLimitError(msg)) noteSdkRateLimitFailure()
    return null
  }
}

/** گفت‌وگو با LLM — فقط متن خروجی */
export async function chat(system: string, user: string, opts?: { maxTokens?: number }): Promise<string> {
  return withRetry(async () => {
    const zai = await getZAI()
    await rateLimit()
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
    noteSdkSuccess()
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

/** گفت‌وگو با خروجی JSON — در خطای عدم دسترسی سرویس منتقل می‌شود، سایر خطاها null */
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
    if (isSdkUnavailable(e)) throw e
    console.warn('[sdk] chatJSON failed:', e instanceof Error ? e.message : e)
    return null
  }
}

const TEXT_CAP = 12000
const HEAD = 6000
const TAIL = 6000

/** بررسی سلامت سرویس هوش مصنوعی — تماس بسیار سبک با سقف ۲۰ ثانیه؛
 *  unavailable=true یعنی پیکربندی موجود نیست (دائمی)، unavailable=false یعنی خطای گذرا (مثل 429) */
export async function sdkHealthCheck(): Promise<{ ok: boolean; message: string | null; unavailable: boolean }> {
  try {
    await withRetry(async () => {
      const zai = await getZAI()
      await rateLimit()
      await withTimeout(
        zai.chat.completions.create({
          messages: [{ role: 'user', content: 'ping' }],
          thinking: { type: 'disabled' },
          max_tokens: 4,
        }) as Promise<unknown>,
        20_000,
        'health-check',
      )
    }, 'health-check')
    return { ok: true, message: null, unavailable: false }
  } catch (e) {
    if (isSdkUnavailable(e)) return { ok: false, message: e.message, unavailable: true }
    return {
      ok: false,
      message: `سرویس هوش مصنوعی پاسخ نداد: ${e instanceof Error ? e.message : String(e)}`,
      unavailable: false,
    }
  }
}

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
