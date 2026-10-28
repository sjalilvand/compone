// موتور ایجنت کراول — اجرای درون‌پردازشی با نقاط بازرسی و امکان ادامه از سر

import { db } from '@/lib/db'
import { webSearch, readPage, chatJSON, htmlToText } from './sdk'
import {
  buildQueryPlanningPrompt,
  buildDiscoveryPrompt,
  buildExtractionPrompt,
  type DiscoveryCandidate,
  type ExtractionResult,
} from './prompts'
import { normalizePersian, normalizeNameKey, normalizePhone, normalizeProvince, jaccardSimilarity } from '@/lib/normalize'

 

export interface QueryState {
  q: string
  done: boolean
}
export interface CandidateState {
  name: string
  url?: string
  hint?: string
  processed: boolean
  note?: string
}

const running = new Map<string, () => void>()
let recovered = false

/** بازیابی کارهای نیمه‌تمام پس از ری‌استارت پروسه */
export async function ensureJobRecovery(): Promise<void> {
  if (recovered) return
  recovered = true
  try {
    const stuck = await db.crawlJob.findMany({ where: { status: 'running' }, select: { id: true } })
    for (const j of stuck) {
      await db.crawlJob.update({ where: { id: j.id }, data: { status: 'paused' } })
      await db.auditLog.create({
        data: {
          entityType: 'job',
          entityId: j.id,
          fieldName: 'status',
          oldValue: 'running',
          newValue: 'paused',
          reason: 'بازیابی خودکار: پروسه دوباره راه‌اندازی شده بود',
          actor: 'system',
        },
      })
    }
  } catch (e) {
    console.error('[engine] recovery failed:', e)
  }
}

export function isJobRunning(jobId: string): boolean {
  return running.has(jobId)
}

/** شروع کار — اگر در حافظه در حال اجراست کاری نمی‌کند */
export async function startJob(jobId: string): Promise<void> {
  if (running.has(jobId)) return
  const job = await db.crawlJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error('کار یافت نشد')
  if (job.status === 'completed') return
  await db.crawlJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      startedAt: job.startedAt ?? new Date(),
      finishedAt: null,
      currentStage: job.currentStage ?? 'planning',
    },
  })
  void runJob(jobId).catch((e) => {
    console.error('[engine] runJob crashed:', e)
  })
}

/** درخواست توقف — حلقه در نزدیک‌ترین نقطه بازرسی متوقف می‌کند */
export async function requestStop(jobId: string): Promise<void> {
  await db.crawlJob.update({ where: { id: jobId }, data: { status: 'stopping' } })
}

/* ---------------- ابزارهای داخلی ---------------- */

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function appendErrors(existing: string | null, message: string): string {
  const arr = parseJson<Array<{ time: string; message: string }>>(existing, [])
  arr.push({ time: nowIso(), message: String(message).slice(0, 500) })
  return JSON.stringify(arr.slice(-100))
}

/** بازرسی توقف/بودجه — در صورت نیاز وضعیت را به paused می‌برد */
async function shouldStop(jobId: string): Promise<boolean> {
  const job = await db.crawlJob.findUnique({ where: { id: jobId } })
  if (!job) return true
  if (job.status === 'stopping' || job.status === 'paused' || job.status === 'failed') {
    if (job.status === 'stopping') {
      await db.crawlJob.update({ where: { id: jobId }, data: { status: 'paused' } })
    }
    return true
  }
  if (job.requestsMade >= job.maxRequests) {
    await db.crawlJob.update({
      where: { id: jobId },
      data: {
        status: 'paused',
        errorsLog: appendErrors(job.errorsLog, 'سقف بودجه درخواست‌ها پر شد؛ کار موقتاً متوقف شد (قابل ادامه)'),
      },
    })
    return true
  }
  return false
}

async function bumpRequests(jobId: string, n = 1, countAsSource = false): Promise<void> {
  await db.crawlJob.update({
    where: { id: jobId },
    data: {
      requestsMade: { increment: n },
      ...(countAsSource ? { statsSourcesChecked: { increment: n } } : {}),
    },
  })
}

async function bumpStat(jobId: string, field: 'statsNewCompanies' | 'statsUpdatedCompanies' | 'statsUncertain' | 'statsErrors'): Promise<void> {
  await db.crawlJob.update({ where: { id: jobId }, data: { [field]: { increment: 1 } } })
}

async function persistJob(jobId: string, patch: Record<string, unknown>): Promise<void> {
  await db.crawlJob.update({ where: { id: jobId }, data: patch })
}

function fallbackQueries(provinces: string[], cities: string[], types: string[]): string[] {
  const qs: string[] = []
  for (const p of provinces) {
    qs.push(`فهرست کارخانه های استان ${p}`, `شرکت های تولیدی استان ${p}`)
  }
  for (const c of cities) {
    qs.push(`فهرست شرکت های شهر ${c}`, `شهرک صنعتی ${c}`)
  }
  if (!qs.length) {
    qs.push('فهرست کارخانه های ایران', 'شرکت های تولیدی ایران', 'شهرک های صنعتی ایران')
  }
  if (types.length) {
    for (const p of provinces.slice(0, 4)) qs.push(`${types[0]} ${p}`)
  }
  return qs
}

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const k = normalizePersian(s)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

function validOwnership(v: unknown): string {
  const s = String(v ?? '').toLowerCase()
  return ['state', 'semi_state', 'private'].includes(s) ? s : 'unknown'
}
function validActivity(v: unknown): string {
  const s = String(v ?? '').toLowerCase()
  return ['active', 'semi_active', 'inactive'].includes(s) ? s : 'unknown'
}
function validEntityType(v: unknown): string {
  const s = String(v ?? '').toLowerCase()
  return ['company', 'factory', 'other'].includes(s) ? s : 'company'
}

function cleanWebsite(v: unknown): string | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  if (!/^(https?:\/\/|www\.)/i.test(s)) {
    if (/^[\w.-]+\.[a-z]{2,}([\/?#].*)?$/i.test(s)) return 'https://' + s
    return null
  }
  return s.replace(/\/+$/, '')
}

function sourceTypeHeuristic(url: string, companyName: string): string {
  const u = url.toLowerCase()
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    /* ignore */
  }
  if (u.includes('.gov.ir') || u.includes('gov.ir') || u.includes('.org') || u.includes('sabteahval') || u.includes(' workplaces ')) return 'official'
  const nameTokens = normalizeNameKey(companyName)
    .split(' ')
    .filter((t) => /[a-z]/i.test(t) && t.length > 3)
  for (const t of nameTokens) if (host.includes(t)) return 'official'
  if (/news|خبر|isna|irna|tasnim|mehrnews|farsnews|khabar|ilna|borna|ecoiran|tehrantimes/.test(u)) return 'news'
  if (/directory|directory|فهرست|list|yellow|rahnam|karnaval|peyvandha/.test(u)) return 'directory'
  if (/guild|اصناف|اتاق/.test(u)) return 'guild'
  return 'other'
}

async function resolveSource(url: string, title: string, companyName: string): Promise<{ id: string; sourceType: string } | null> {
  try {
    const existing = await db.source.findFirst({ where: { url } })
    if (existing) return { id: existing.id, sourceType: existing.sourceType }
    const sourceType = sourceTypeHeuristic(url, companyName)
    const created = await db.source.create({ data: { url: url.slice(0, 2000), title: title ? title.slice(0, 500) : null, sourceType, accessStatus: 'ok' } })
    return { id: created.id, sourceType }
  } catch (e) {
    console.warn('[engine] resolveSource failed:', e)
    return null
  }
}

function evidenceEntityType(field: string): string {
  if (field === 'ceo_name' || field === 'ceo_phone') return 'officer'
  if (field === 'company_phone' || field === 'company_email') return 'contact'
  if (field === 'address' || field === 'province' || field === 'city') return 'location'
  if (field === 'emdad_cooperation') return 'cooperation'
  return 'company'
}

function appendReviewReason(existing: string | null, addition: string): string {
  const parts = (existing ?? '').split('؛').map((s) => s.trim()).filter(Boolean)
  if (!parts.includes(addition)) parts.push(addition)
  return parts.join('؛ ').slice(0, 600)
}

function ownershipFa(v: string): string {
  switch (v) {
    case 'state':
      return 'دولتی'
    case 'semi_state':
      return 'نیمه دولتی'
    case 'private':
      return 'خصوصی'
    default:
      return ''
  }
}

/** پژوهش یک نامزد: جست‌وجوی هدفمند + خواندن صفحات + استخراج + ذخیره با شواهد */
async function researchCandidate(
  jobId: string,
  cand: CandidateState,
  checkStop: () => Promise<boolean>,
): Promise<void> {
  const name = cand.name.trim()
  if (!name) {
    cand.note = 'نام خالی'
    return
  }

  // الف) جست‌وجوی هدفمند
  if (await checkStop()) return
  const results = await webSearch(`"${name}" تماس با ما آدرس`, 5)
  await bumpRequests(jobId, 1)

  // انتخاب حداکثر ۲ نشانی امیدوارکننده
  const scored = results
    .filter((r) => r.url)
    .map((r) => {
      let s = 0
      const u = r.url.toLowerCase()
      const title = r.title || ''
      if (/contact|تماس|about|درباره|ارتباط/.test(u) || /تماس|ارتباط با ما/.test(title)) s += 5
      if (/\.gov\.ir|\.org/.test(u)) s += 3
      let host = ''
      try {
        host = new URL(r.url).hostname.toLowerCase()
      } catch {
        /* ignore */
      }
      const asciiTokens = normalizeNameKey(name)
        .split(' ')
        .filter((t) => /^[a-z0-9]+$/.test(t) && t.length > 3)
      for (const t of asciiTokens) if (host.includes(t)) s += 4
      if (r.snippet.includes(name) || title.includes(name)) s += 2
      return { url: r.url, title, score: s }
    })
    .sort((a, b) => b.score - a.score)

  const urls: string[] = []
  if (cand.url) urls.push(cand.url)
  for (const s of scored) {
    if (urls.length >= 2) break
    if (!urls.includes(s.url)) urls.push(s.url)
  }
  if (!urls.length && scored[0]) urls.push(scored[0].url)

  // ب) خواندن صفحات (حداکثر ۲)
  const pages: Array<{ url: string; title: string; text: string }> = []
  for (const u of urls.slice(0, 2)) {
    if (await checkStop()) return
    const page = await readPage(u)
    await bumpRequests(jobId, 1)
    if (page) {
      const text = htmlToText(page.html)
      if (text.length > 80) pages.push({ url: page.url || u, title: page.title || '', text })
    }
  }
  if (!pages.length) {
    cand.note = 'هیچ صفحه‌ای خوانده نشد'
    await bumpStat(jobId, 'statsErrors')
    return
  }

  // ج) استخراج با LLM
  const { system, user } = buildExtractionPrompt(name, cand.hint, pages)
  const ex = await chatJSON<ExtractionResult>(system, user, { maxTokens: 2500 })
  if (!ex || typeof ex !== 'object') {
    cand.note = 'پاسخ استخراج JSON معتبر نبود'
    return
  }
  if (ex.found === false || !ex.company_name) {
    cand.note = 'مجموعه در صفحات یافت نشد'
    return
  }

  // د) نرمال‌سازی مقادیر
  const officialRaw = normalizePersian(String(ex.company_name))
  const key = normalizeNameKey(String(ex.company_name))
  if (!officialRaw || !key) {
    cand.note = 'نام استخراج‌شده نامعتبر بود'
    return
  }
  const nationalId = ex.national_id ? String(ex.national_id).replace(/\D/g, '') || null : null

  // هـ) ایجاد/به‌روزرسانی شرکت
  let company: any = null
  let isNew = false
  if (nationalId) {
    company = await db.company.findFirst({ where: { nationalId } })
  }
  if (!company) {
    company = await db.company.findFirst({ where: { normalizedName: key } })
  }
  if (!company) {
    company = await db.company.create({
      data: {
        officialName: officialRaw,
        normalizedName: key,
        entityType: validEntityType(ex.entity_type),
        ownershipType: validOwnership(ex.ownership_type),
        activityStatus: validActivity(ex.activity_status),
        activityDescription: ex.activity_description ? normalizePersian(String(ex.activity_description)).slice(0, 1000) : null,
        affiliationName: ex.affiliation_name ? normalizePersian(String(ex.affiliation_name)).slice(0, 300) : null,
        website: cleanWebsite(ex.website),
        nationalId,
        sourceJobId: jobId,
        lastCheckedAt: new Date(),
      },
    })
    isNew = true
    await bumpStat(jobId, 'statsNewCompanies')
    // تشخیص احتمال تکرار نام (فازی) برای صف بررسی
    const all = await db.company.findMany({
      where: { id: { not: company.id }, mergedIntoId: null },
      select: { id: true, officialName: true },
      take: 2000,
    })
    for (const other of all) {
      if (jaccardSimilarity(officialRaw, other.officialName) >= 0.8) {
        await db.company.update({
          where: { id: company.id },
          data: { needsReview: true, reviewReason: appendReviewReason(null, 'احتمال تکرار نام') },
        })
        await bumpStat(jobId, 'statsUncertain')
        break
      }
    }
  } else {
    const patch: Record<string, unknown> = { lastCheckedAt: new Date() }
    const trySet = (field: string, current: unknown, incoming: unknown, normalize?: (v: string) => string | null) => {
      if (incoming == null || String(incoming).trim() === '') return
      const val = normalize ? normalize(String(incoming)) : String(incoming).trim()
      if (!val) return
      const cur = current == null || current === '' || current === 'unknown' ? '' : String(current)
      if (!cur) patch[field] = val
      // مقدار غیرخالی فعلی بی‌صدا بازنویسی نمی‌شود؛ شواهد در مرحله (و) ثبت و تعارض تشخیص داده می‌شود
    }
    const ownership = validOwnership(ex.ownership_type)
    if (ownership !== 'unknown') trySet('ownershipType', company.ownershipType, ownership)
    const activity = validActivity(ex.activity_status)
    if (activity !== 'unknown') trySet('activityStatus', company.activityStatus, activity)
    if (ex.activity_description) trySet('activityDescription', company.activityDescription, normalizePersian(String(ex.activity_description)))
    if (ex.affiliation_name) trySet('affiliationName', company.affiliationName, normalizePersian(String(ex.affiliation_name)))
    const website = cleanWebsite(ex.website)
    if (website) trySet('website', company.website, website)
    if (nationalId && !company.nationalId) patch.nationalId = nationalId
    if (Object.keys(patch).length > 1) {
      await db.company.update({ where: { id: company.id }, data: patch })
    }
    await bumpStat(jobId, 'statsUpdatedCompanies')
  }
  const companyId: string = company.id
  const firstPageUrl = pages[0]?.url ?? null

  // و) محل
  const address = ex.address ? normalizePersian(String(ex.address)).slice(0, 800) : null
  const province = normalizeProvince(ex.province)
  const city = ex.city ? normalizePersian(String(ex.city)).slice(0, 120) : null
  if (address || province || city) {
    const locType =
      ex.entity_type === 'factory' || officialRaw.includes('کارخانه') || (address ?? '').includes('کارخانه')
        ? 'factory'
        : 'hq'
    const dupLoc = await db.companyLocation.findFirst({
      where: {
        companyId,
        ...(address ? { address } : { province: province ?? undefined, city: city ?? undefined }),
      },
    })
    if (!dupLoc) {
      await db.companyLocation.create({
        data: { companyId, locationType: locType, province, city, address },
      })
    }
  }

  // ز) تماس‌ها و مدیرعامل
  const addContact = async (raw: unknown, unitTitle: string) => {
    const np = normalizePhone(typeof raw === 'string' ? raw : String(raw ?? ''))
    if (!np.value) return
    const dup = await db.companyContact.findFirst({ where: { companyId, value: np.value, unitTitle } })
    if (dup) return
    await db.companyContact.create({
      data: {
        companyId,
        contactType: /^09\d{9}$/.test(np.value) ? 'mobile' : 'phone',
        value: np.value,
        valueOriginal: np.original.slice(0, 200),
        unitTitle,
        isPublic: true,
      },
    })
  }
  if (ex.company_phone) await addContact(ex.company_phone, 'شرکت')
  if (ex.ceo_phone) await addContact(ex.ceo_phone, 'دفتر مدیرعامل')

  if (ex.ceo_name) {
    const personName = normalizePersian(String(ex.ceo_name)).slice(0, 200)
    if (personName) {
      const dupOff = await db.companyOfficer.findFirst({ where: { companyId, personName, role: 'ceo' } })
      if (!dupOff) {
        await db.companyOfficer.create({
          data: { companyId, personName, role: 'ceo', isCurrent: true, sourceUrl: firstPageUrl },
        })
      }
    }
  }

  // ح) سابقه همکاری با کمیته امداد
  if (ex.emdad_cooperation === 'has' || ex.emdad_cooperation === 'has_not') {
    const dupCoop = await db.cooperationRecord.findFirst({
      where: { companyId, organization: 'کمیته امداد امام خمینی', sourceUrl: firstPageUrl },
    })
    if (!dupCoop) {
      await db.cooperationRecord.create({
        data: {
          companyId,
          organization: 'کمیته امداد امام خمینی',
          cooperationType:
            ex.emdad_cooperation === 'has' ? 'همکاری (استخراج از منبع باز)' : 'عدم همکاری (بیان صریح منبع)',
          sourceUrl: firstPageUrl,
          enteredBy: 'agent',
          verificationStatus: 'unverified',
        },
      })
    }
  }

  // ط) شواهد میدانی
  const evidenceList = Array.isArray(ex.evidence) ? ex.evidence : []
  for (const ev of evidenceList) {
    if (!ev || typeof ev.field !== 'string' || !ev.field.trim()) continue
    let confidence = Math.max(0, Math.min(100, Math.round(Number(ev.confidence) || 0)))
    let sourceId: string | null = null
    const idx = Number.isInteger(ev.source_index) ? Number(ev.source_index) : 0
    const page = pages[idx] ?? pages[0]
    if (page?.url) {
      const src = await resolveSource(page.url, page.title, officialRaw)
      if (src) {
        sourceId = src.id
        if (src.sourceType === 'official') confidence = Math.min(100, confidence + 10)
      }
    }
    const claimed = ev.value != null && String(ev.value).trim() !== '' ? normalizePersian(String(ev.value)).slice(0, 500) : null
    await db.fieldEvidence.create({
      data: {
        companyId,
        entityType: evidenceEntityType(ev.field),
        entityId: null,
        fieldName: ev.field.trim().slice(0, 100),
        claimedValue: claimed,
        sourceId,
        quoteText: ev.quote ? String(ev.quote).slice(0, 400) : null,
        effectiveDate: ev.effective_date ? String(ev.effective_date).slice(0, 60) : null,
        confidence,
        reviewStatus: 'pending',
      },
    })
  }

  // ی) تعارض و نیاز به بازبینی
  const reviewAdditions: string[] = []
  const allEvidences = await db.fieldEvidence.findMany({ where: { companyId }, include: { source: true } })
  const byField = new Map<string, typeof allEvidences>()
  for (const e of allEvidences) {
    const arr = byField.get(e.fieldName) ?? []
    arr.push(e)
    byField.set(e.fieldName, arr)
  }
  for (const [fieldName, evs] of byField) {
    const distinct = new Set(evs.map((e) => normalizeNameKey(e.claimedValue ?? '') || (e.claimedValue ?? '')))
    if (distinct.size > 1) {
      await db.fieldEvidence.updateMany({ where: { id: { in: evs.map((e) => e.id) } }, data: { conflict: true } })
      reviewAdditions.push(`تعارض منابع در فیلد ${fieldName}`)
    }
  }
  for (const e of allEvidences) {
    if (e.confidence < 60) {
      reviewAdditions.push(`اطمینان پایین فیلد ${e.fieldName}`)
    }
  }
  if (reviewAdditions.length) {
    let reason = company.reviewReason
    for (const a of reviewAdditions) reason = appendReviewReason(reason, a)
    await db.company.update({ where: { id: companyId }, data: { needsReview: true, reviewReason: reason } })
    if (isNew) await bumpStat(jobId, 'statsUncertain')
  }

  // ک) حسابرسی
  await db.auditLog.create({
    data: {
      entityType: 'company',
      entityId: companyId,
      fieldName: 'batch',
      oldValue: null,
      newValue: isNew ? `ایجاد رکورد از منبع ${firstPageUrl ?? 'نامشخص'}` : `به‌روزرسانی رکورد از منبع ${firstPageUrl ?? 'نامشخص'}`,
      actor: 'agent',
      jobId,
    },
  })
}

/** حلقه اصلی کار کراول */
async function runJob(jobId: string): Promise<void> {
  running.set(jobId, () => {})
  let errorsAdded = false
  try {
    let job = await db.crawlJob.findUnique({ where: { id: jobId } })
    if (!job) return

    const checkStop = () => shouldStop(jobId)

    // STAGE planning
    let queries = parseJson<QueryState[]>(job.queriesState, [])
    if (!queries.length) {
      if (await checkStop()) return
      job = await db.crawlJob.findUnique({ where: { id: jobId } })
      if (!job) return
      const provinces = parseJson<string[]>(job.provinces, [])
      const cities = parseJson<string[]>(job.cities, [])
      const companyTypes = parseJson<string[]>(job.companyTypes, [])
      const seeds = parseJson<string[]>(job.seedQueries, []).filter((q) => typeof q === 'string' && q.trim())
      const { system, user } = buildQueryPlanningPrompt(provinces, cities, companyTypes, seeds)
      const gen = await chatJSON<string[]>(system, user)
      let generated: string[] = Array.isArray(gen) ? gen.filter((q) => typeof q === 'string' && q.trim()) : []
      if (!generated.length) generated = fallbackQueries(provinces, cities, companyTypes)
      const merged = dedupeStrings([...seeds, ...generated])
      queries = merged.slice(0, 25).map((q) => ({ q, done: false }))
      await persistJob(jobId, {
        queriesState: JSON.stringify(queries),
        progressTotal: queries.length,
        currentStage: 'discovering',
      })
    } else {
      await persistJob(jobId, { currentStage: queries.every((q) => q.done) ? 'researching' : 'discovering' })
    }

    // STAGE discovering
    let candidates = parseJson<CandidateState[]>(job.candidatesState, [])
    const provinces = parseJson<string[]>(job.provinces, [])
    const cities = parseJson<string[]>(job.cities, [])
    for (const q of queries) {
      if (q.done) continue
      if (await checkStop()) return
      const results = await webSearch(q.q, 8)
      await bumpRequests(jobId, 1, true)
      const { system, user } = buildDiscoveryPrompt(q.q, results, provinces, cities)
      const found = await chatJSON<DiscoveryCandidate[]>(system, user)
      const foundArr = Array.isArray(found) ? found : []
      for (const c of foundArr) {
        if (!c || typeof c.name !== 'string' || !c.name.trim()) continue
        const cKey = normalizeNameKey(c.name)
        if (!cKey) continue
        if (candidates.some((x) => normalizeNameKey(x.name) === cKey)) continue
        const exists = await db.company.findFirst({ where: { normalizedName: cKey }, select: { id: true } })
        if (exists) continue
        candidates.push({
          name: normalizePersian(c.name).slice(0, 300),
          url: typeof c.url === 'string' && c.url.startsWith('http') ? c.url : undefined,
          hint: typeof c.hint === 'string' ? c.hint.slice(0, 300) : undefined,
          processed: false,
        })
      }
      q.done = true
      await persistJob(jobId, {
        queriesState: JSON.stringify(queries),
        candidatesState: JSON.stringify(candidates),
        progressDone: queries.filter((x) => x.done).length + candidates.filter((x) => x.processed).length,
        progressTotal: queries.length + candidates.length,
      })
    }
    await persistJob(jobId, {
      currentStage: 'researching',
      progressTotal: queries.length + candidates.length,
    })

    // STAGE researching
    for (const cand of candidates) {
      if (cand.processed) continue
      if (await checkStop()) return
      try {
        await researchCandidate(jobId, cand, checkStop)
      } catch (e) {
        cand.note = 'خطا در پژوهش نامزد'
        await bumpStat(jobId, 'statsErrors')
        const jobRow = await db.crawlJob.findUnique({ where: { id: jobId }, select: { errorsLog: true } })
        await persistJob(jobId, {
          errorsLog: appendErrors(
            jobRow?.errorsLog ?? null,
            `پژوهش نامزد «${cand.name}»: ${e instanceof Error ? e.message : String(e)}`,
          ),
        })
        errorsAdded = true
      }
      cand.processed = true
      await persistJob(jobId, {
        candidatesState: JSON.stringify(candidates),
        progressDone: queries.filter((x) => x.done).length + candidates.filter((x) => x.processed).length,
        progressTotal: queries.length + candidates.length,
      })
    }

    // STAGE done
    const allDone = queries.every((q) => q.done) && candidates.every((c) => c.processed)
    if (allDone) {
      await db.crawlJob.update({
        where: { id: jobId },
        data: { status: 'completed', currentStage: 'done', finishedAt: new Date() },
      })
    }
  } catch (e) {
    console.error('[engine] runJob error:', e)
    try {
      const jobRow = await db.crawlJob.findUnique({ where: { id: jobId }, select: { errorsLog: true } })
      await db.crawlJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorsLog: appendErrors(
            jobRow?.errorsLog ?? null,
            `خطای کلی اجرا: ${e instanceof Error ? e.message : String(e)}`,
          ),
        },
      })
    } catch (e2) {
      console.error('[engine] failed to mark job as failed:', e2)
    }
  } finally {
    running.delete(jobId)
    if (errorsAdded) {
      // errors already persisted inline
    }
  }
}
