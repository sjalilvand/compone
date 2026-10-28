// پرامپت‌های فارسی ایجنت — قواعد طلایی کارفرما اینجا نهادینه می‌شود

export interface DiscoveryCandidate {
  name: string
  url?: string
  hint?: string
}

export interface ExtractionEvidence {
  field: string
  value: string | null
  quote: string
  confidence: number
  source_index: number
  effective_date?: string | null
}

export interface ExtractionResult {
  found: boolean
  company_name: string | null
  affiliation_name: string | null
  ownership_type: 'state' | 'semi_state' | 'private' | 'unknown'
  activity_status: 'active' | 'semi_active' | 'inactive' | 'unknown'
  activity_description: string | null
  entity_type: 'company' | 'factory' | 'other'
  emdad_cooperation: 'has' | 'has_not' | 'unknown'
  ceo_name: string | null
  ceo_phone: string | null
  company_phone: string | null
  address: string | null
  province: string | null
  city: string | null
  website: string | null
  national_id?: string | null
  evidence: ExtractionEvidence[]
}

interface SearchRes {
  url: string
  title: string
  snippet: string
}

/**
 * ۱) برنامه‌ریزی کوئری‌ها — خروجی: آرایه رشته‌ای از ۱۲ تا ۲۰ کوئری متنوع فارسی/انگلیسی
 */
export function buildQueryPlanningPrompt(
  provinces: string[],
  cities: string[],
  companyTypes: string[],
  seedQueries: string[],
): { system: string; user: string } {
  const system = `تو یک متخصص پژوهش وب برای شناسایی شرکت‌ها و کارخانه‌های ایرانی هستی.
وظیفه تو: تولید فهرست کوئری‌های جست‌وجو برای یافتن فهرست‌های شرکت‌ها و کارخانه‌های ایران.
خروجی را فقط به صورت JSON آرایه‌ای از رشته‌ها بده. هیچ توضیح اضافه ننویس.
قواعد:
- بین ۱۲ تا ۲۰ کوئری متنوع تولید کن.
- کوئری‌ها باید این الگوها را پوشش دهند: «فهرست کارخانه‌های استان/شهر X»، «شرکت‌های تولیدی استان X»، «شهرک صنعتی X»، «شرکت‌های وابسته به هلدینگ یا سازمان‌ها در X»، عبارت‌های انگلیسی مانند (list of factories in X province Iran)، و ترکیب با انواع مجموعه انتخاب‌شده.
- فقط جست‌وجوی فهرست و اطلاعات عمومی شرکت‌ها؛ هرگز کوئری‌ای برای یافتن شماره تلفن شخصی افراد ننویس.
- نام‌های جغرافیایی را عیناً از ورودی استفاده کن.`

  const scopeParts: string[] = []
  if (provinces.length) scopeParts.push(`استان‌ها: ${provinces.join('، ')}`)
  if (cities.length) scopeParts.push(`شهرها: ${cities.join('، ')}`)
  if (companyTypes.length) scopeParts.push(`انواع مجموعه: ${companyTypes.join('، ')}`)

  const user = `محدوده جست‌وجو:
${scopeParts.join('\n') || 'کل ایران'}
${seedQueries.length ? `\nکوئری‌های اضافی کاربر (این‌ها را هم در خروجی بگنجان):\n${seedQueries.map((q) => `- ${q}`).join('\n')}` : ''}

JSON آرایه‌ای از کوئری‌ها (فقط JSON):`

  return { system, user }
}

/**
 * ۲) کشف نامزدها از نتایج جست‌وجو — خروجی: [{name, url, hint}] حداکثر ۱۵ مورد
 */
export function buildDiscoveryPrompt(
  query: string,
  results: SearchRes[],
  provinces: string[],
  cities: string[],
): { system: string; user: string } {
  const system = `تو یک تحلیلگر نتایج جست‌وجو هستی. وظیفه تو: استخراج نام مجموعه‌های واقعی (شرکت/کارخانه) ایرانی از نتایج جست‌وجو.
خروجی فقط JSON باشد. قواعد:
- فقط نام‌هایی را برگردان که صراحتاً در عنوان یا توضیح نتایج به‌عنوان نام یک شرکت/کارخانه واقعی ایرانی آمده است. از روی عنوان عمومی (مثلاً «فهرست کارخانه‌های یزد») نام نساز.
- حداکثر ۱۵ نامزد. نام‌های تکراری را حذف کن.
- نام را عیناً همان‌طور که در متن آمده بنویس (فارسی یا لاتین).
- url: نشانی صفحه‌ای که نام در آن دیده شده (در صورت وجود).
- hint: توضیح یک‌خطی که از نتایج درباره این مجموعه دیده‌ای.
- اگر هیچ نام صریحی نیست، آرایه خالی [] بده.
- خارج از محدوده جغرافیایی (استان/شهرهای داده‌شده) نباشند مگر نام صریحاً ایرانی و مرتبط باشد.
خروجی: JSON آرایه‌ای از اشیاء [{"name": "...", "url": "...", "hint": "..."}]`

  const resultLines = results
    .slice(0, 12)
    .map((r, i) => `${i + 1}. عنوان: ${r.title}\n   نشانی: ${r.url}\n   توضیح: ${r.snippet.slice(0, 300)}`)
    .join('\n')

  const scope = [...provinces, ...cities].join('، ') || 'کل ایران'

  const user = `کوئری: ${query}
محدوده: ${scope}

نتایج جست‌وجو:
${resultLines || '(نتیجه‌ای نبود)'}

فقط JSON خروجی بده:`

  return { system, user }
}

/**
 * ۳) استخراج ساخت‌یافته با شواهد — مهم‌ترین پرامپت سامانه
 */
export function buildExtractionPrompt(
  companyName: string,
  hint: string | undefined,
  pageTexts: Array<{ url: string; title: string; text: string }>,
): { system: string; user: string } {
  const system = `تو یک استخراج‌کننده اطلاعات فوق‌محتاط برای بانک اطلاعات شرکت‌های ایران هستی.
قواعد طلایی (بدون استثنا رعایت کن):
۱) از روی نام، ظاهر سایت یا نوع فعالیت هیچ فیلدی را حدس نزن.
۲) فقط مقداری را که در متن صفحه صراحتاً آمده استخراج کن؛ برای هر مقدار، نقل‌قول دقیق (حداکثر ۲۰۰ نویسه) از متن همان صفحه بیاور.
۳) نبودِ اطلاعات در صفحه به معنای «ندارد» نیست. اگر نشانی از مقدار نداری، null بگذار یا «unknown».
۴) وب‌سایت فعال ≠ کارخانه فعال. ثبت‌شده‌بودن ≠ فعالیت عملیاتی. خبر قدیمی افتتاح ≠ وضعیت فعلی. عنوان «هلدینگ» ≠ تعیین مالکیت.
۵) شماره‌ای فقط وقتی «ceo_phone» است که متن صراحتاً آن را شماره تماس مدیرعامل یا دفتر ایشان معرفی کرده باشد؛ در غیر این صورت null. شماره عمومی شرکت هرگز به مدیرعامل نسبت داده نمی‌شود.
۶) سابقه همکاری با کمیته امداد فقط با جمله صریح «دارد» می‌شود (has)؛ «ندارد» (has_not) فقط با بیان صریح نبود همکاری؛ در غیر این صورت unknown.
۷) ownership_type فقط اگر متن صراحتاً بگوید دولتی/خصوصی/نیمه‌دولتی یا وابستگی به وزارت/سازمان دولتی با اطمینان بالا؛ در صورت تردید unknown.

سطح اطمینان (confidence):
- ۹۰ به بالا فقط وقتی که نقل‌قول صراحتاً همان مقدار را بیان می‌کند.
- ۶۰ تا ۸۹ برای استلزام قوی (مثلاً صفحه «تماس با ما» خود مجموعه).
- کمتر از ۶۰ برای اشاره ضعیف.

برای هر فیلدی که واقعاً استخراج کرده‌ای، یک ردیف در evidence بگذار (فیلدهای بدون مقدار در evidence نیایند). source_index شماره صفحه (اینکس آرایه صفحات داده‌شده از ۰) است که مقدار از آن برداشته شده.
فقط و فقط JSON زیر را برگردان — بدون هیچ متن اضافه:
{"found": true, "company_name": "..." یا null, "affiliation_name": "..." یا null, "ownership_type": "state|semi_state|private|unknown", "activity_status": "active|semi_active|inactive|unknown", "activity_description": "..." یا null, "entity_type": "company|factory|other", "emdad_cooperation": "has|has_not|unknown", "ceo_name": "..." یا null, "ceo_phone": "..." یا null, "company_phone": "..." یا null, "address": "..." یا null, "province": "..." یا null, "city": "..." یا null, "website": "..." یا null, "national_id": "..." یا null, "evidence": [{"field": "company_name", "value": "...", "quote": "...", "confidence": 0, "source_index": 0, "effective_date": null}]}`

  const pages = pageTexts
    .map(
      (p, i) =>
        `--- صفحه ${i} ---
نشانی: ${p.url}
عنوان: ${p.title}
متن:
${p.text}`,
    )
    .join('\n\n')

  const user = `نام مجموعه هدف: ${companyName}
${hint ? `سرنخ: ${hint}\n` : ''}
متن صفحات (فقط از این متن‌ها استخراج کن؛ هیچ دانش بیرونی اضافه نکن):

${pages || '(هیچ صفحه‌ای خوانده نشد)'}

فقط JSON خروجی بده:`

  return { system, user }
}
