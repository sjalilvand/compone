// نرمال‌سازی متن فارسی، شماره تلفن، استان و ابزارهای کمکی

import { PROVINCES } from './regions'

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** تبدیل ارقام عربی/فارسی به لاتین */
export function digitsToAscii(text: string): string {
  let out = ''
  for (const ch of text) {
    const ai = ARABIC_DIGITS.indexOf(ch)
    if (ai >= 0) {
      out += String(ai)
      continue
    }
    const pi = PERSIAN_DIGITS.indexOf(ch)
    if (pi >= 0) {
      out += String(pi)
      continue
    }
    out += ch
  }
  return out
}

/**
 * نرمال‌سازی متن فارسی:
 * - ي←ی، ك←ک، ۀ/ة←ه، أ/إ←ا (حفظ آ)
 * - ارقام عربی/فارسی ← لاتین
 * - حذف کشیده و اعراب
 * - فاصله‌های تکراری → یکی، حذف فاصله اطراف نیم‌فاصله (ZWNJ حفظ می‌شود)
 */
export function normalizePersian(text: string): string {
  if (!text || typeof text !== 'string') return ''
  let t = text
  // نویسه‌های عربی → فارسی
  t = t.replace(/\u064A/g, '\u06CC') // ي → ی
  t = t.replace(/\u0643/g, '\u06A9') // ك → ک
  t = t.replace(/[\u06C0\u0629]/g, '\u0647') // ۀ ة → ه
  t = t.replace(/[\u0623\u0625\u0671]/g, '\u0627') // أ إ ٱ → ا
  t = t.replace(/\u0649/g, '\u06CC') // ى → ی
  // ارقام
  t = digitsToAscii(t)
  // حذف کشیده (tatweel) و اعراب و علامت‌های قرآنی
  t = t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
  // حذف فاصله اطراف نیم‌فاصله (ZWNJ نگه داشته می‌شود)
  t = t.replace(/ +\u200C+/g, '\u200C')
  t = t.replace(/\u200C+ +/g, '\u200C')
  // فاصله‌های تکراری
  t = t.replace(/[\u00A0\u2000-\u200B\u3000]+/g, ' ')
  t = t.replace(/\s+/g, ' ')
  return t.trim()
}

/** واژه‌های پسوندی رایج که در کلید نام حذف می‌شوند */
const NAME_SUFFIX_WORDS = new Set([
  'شرکت',
  'کارخانه',
  'هلدینگ',
  'گروه',
  'industrial',
  'group',
  'co',
  'company',
  'ltd',
  'inc',
  'corp',
  'llc',
  'plc',
])

/**
 * کلید یکتای نام برای حذف تکراری:
 * نرمال‌سازی فارسی + حذف محتوای داخل پرانتز + حذف عبارت «گروه صنعتی» + حذف علائم + حذف پسوندهای رایج + لاتین کوچک
 */
export function normalizeNameKey(text: string): string {
  if (!text) return ''
  let t = normalizePersian(text)
  // حذف محتوای داخل پرانتز
  t = t.replace(/[({\[][^)}\]]*[)}\]]/g, ' ')
  // حذف عبارت ترکیبی «گروه صنعتی»
  t = t.replace(/گروه صنعتی/g, ' ')
  // حذف علائم نگارشی و کاراکترهای خاص
  t = t.replace(/[.,،؛:;!؟?"'«»\-–—_\/\\|()\[\]{}+*#@$%^&=<>~`،؛]/g, ' ')
  const tokens = t
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !NAME_SUFFIX_WORDS.has(w.toLowerCase()))
  return tokens.join(' ').toLowerCase()
}

/**
 * نرمال‌سازی شماره تلفن — هرگز شماره‌ای نمی‌سازد؛ فقط قالب ورودی را تمیز می‌کند.
 * خروجی value فقط اگر به شکل شماره تلفن ایران معتبر باشد، وگرنه null.
 */
export function normalizePhone(raw: unknown): { value: string | null; original: string } {
  const original = typeof raw === 'string' ? raw : raw == null ? '' : String(raw)
  if (!original.trim()) return { value: null, original }
  let t = digitsToAscii(original)
  // حذف همه‌چیز به جز ارقام و + در ابتدا
  t = t.replace(/[^\d+]/g, '')
  t = t.replace(/(?!^)\+/g, '') // + فقط در ابتدا مجاز است
  if (!t) return { value: null, original }

  if (t.startsWith('+98')) t = '0' + t.slice(3)
  else if (t.startsWith('0098')) t = '0' + t.slice(4)
  else if (t.startsWith('98') && t.length === 12) t = '0' + t.slice(2)
  else if (/^9\d{9}$/.test(t)) t = '0' + t // موبایل بدون صفر

  const digitsOnly = t.replace(/\D/g, '')
  // کامل: ۱۱ رقم شروع با صفر (موبایل 09xxxxxxxxx یا ثابت 0xx-xxxxxxxx)
  if (/^0\d{10}$/.test(digitsOnly)) return { value: digitsOnly, original }
  // فرم کوتاه محلی ۸ تا ۱۰ رقم (بدون پیش‌شماره) — عیناً همان که هست
  if (/^\d{8,10}$/.test(digitsOnly)) return { value: digitsOnly, original }
  return { value: null, original }
}

/** تشخیص موبایل (09xxxxxxxxx) */
export function isMobilePhone(value: string | null): boolean {
  return !!value && /^09\d{9}$/.test(value)
}

const PROVINCES_CACHE: string[] = PROVINCES

/**
 * تطبیق فازی نام استان با فهرست استاندارد — نام استاندارد یا null
 */
export function normalizeProvince(text: string | null | undefined): string | null {
  if (!text) return null
  const t = normalizePersian(text)
  if (!t) return null
  const key = normalizeNameKey(t)
  if (!key) return null
  // خوانش‌های جایگزین رایج
  const aliases: Record<string, string> = {
    'آذربایجان شرقی': 'آذربایجان شرقی',
    'شرقی آذربایجان': 'آذربایجان شرقی',
    'آذربایجان غربی': 'آذربایجان غربی',
    'غربی آذربایجان': 'آذربایجان غربی',
    'خراسان جنوبی': 'خراسان جنوبی',
    'خراسان رضوی': 'خراسان رضوی',
    'خراسان': 'خراسان رضوی',
    'خراسان شمالی': 'خراسان شمالی',
    'سیستان و بلوچستان': 'سیستان و بلوچستان',
    'سیستان': 'سیستان و بلوچستان',
    'بلوچستان': 'سیستان و بلوچستان',
    'کهگیلویه و بویراحمد': 'کهگیلویه و بویراحمد',
    'کهگیلویه': 'کهگیلویه و بویراحمد',
    'بویراحمد': 'کهگیلویه و بویراحمد',
    'چهارمحال و بختیاری': 'چهارمحال و بختیاری',
    'چهارمحال': 'چهارمحال و بختیاری',
    'بختیاری': 'چهارمحال و بختیاری',
  }
  // توازن مستقیم روی کلید استان‌ها
  // (ایمپورت دایره‌ای نداشته باشیم؛ فهرست را از متغیر ماژول می‌خوانیم)
  for (const p of PROVINCES_CACHE) {
    const pk = normalizeNameKey(p)
    if (key === pk) return p
    if (key && pk && (key.includes(pk) || pk.includes(key))) {
      // تطبیق توکنی: فقط اگر کل پیکانه‌ها یکی باشد
      const a = new Set(key.split(' '))
      const b = new Set(pk.split(' '))
      let inside = true
      for (const w of b) if (!a.has(w)) inside = false
      if (inside) return p
    }
    const alias = aliases[t] ?? aliases[key] ?? null
    if (alias && alias === p) return p
  }
  // تطبیق مستقیم با نام‌های جایگزین
  const direct = aliases[t]
  if (direct && PROVINCES_CACHE.includes(direct)) return direct
  return null
}

/**
 * محافظ تزریق فرمول اکسل: رشته‌های شروع‌شده با = + - @ یا TAB/CR با ' پیشوند می‌گیرند.
 * طول خروجی حداکثر ۳۰۰۰ نویسه.
 */
export function safeCell(value: unknown): string {
  let s: string
  if (value == null) s = ''
  else if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  else if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  else s = String(value)
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (s.length > 3000) s = s.slice(0, 3000)
  return s
}

/** تشابه جاکارد روی توکن‌های نام نرمال‌شده */
export function jaccardSimilarity(a: string, b: string): number {
  const ta = normalizeNameKey(a).split(/\s+/).filter(Boolean)
  const tb = normalizeNameKey(b).split(/\s+/).filter(Boolean)
  if (!ta.length || !tb.length) return 0
  const sa = new Set(ta)
  const sb = new Set(tb)
  const inter = new Set([...sa].filter((x) => sb.has(x)))
  const union = new Set([...sa, ...sb])
  return union.size ? inter.size / union.size : 0
}
