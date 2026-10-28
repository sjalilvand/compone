// ابزارهای مشترک مسیرهای API — سریال‌سازی و اعتبارسنجی
import { db } from '@/lib/db'
import { normalizeNameKey } from '@/lib/normalize'

 

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

export function safeParseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/* ---------------- سریال‌سازی کار ---------------- */

export function serializeJob(job: any) {
  const progressPercent =
    job.progressTotal > 0 ? Math.min(100, Math.round((job.progressDone / job.progressTotal) * 100)) : 0
  return {
    id: job.id,
    name: job.name,
    provinces: safeParseJson<string[]>(job.provinces, []),
    cities: safeParseJson<string[]>(job.cities, []),
    companyTypes: safeParseJson<string[]>(job.companyTypes, []),
    seedQueries: safeParseJson<string[]>(job.seedQueries, []),
    maxRequests: job.maxRequests,
    requestsMade: job.requestsMade,
    status: job.status,
    currentStage: job.currentStage,
    progressDone: job.progressDone,
    progressTotal: job.progressTotal,
    progressPercent,
    queries: safeParseJson<Array<{ q: string; done: boolean }>>(job.queriesState, []),
    candidates: safeParseJson<Array<{ name: string; url?: string; hint?: string; processed: boolean; note?: string }>>(
      job.candidatesState,
      [],
    ),
    errors: safeParseJson<Array<{ time: string; message: string }>>(job.errorsLog, []),
    stats: {
      sourcesChecked: job.statsSourcesChecked,
      newCompanies: job.statsNewCompanies,
      updatedCompanies: job.statsUpdatedCompanies,
      uncertain: job.statsUncertain,
      errors: job.statsErrors,
    },
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

/* ---------------- سریال‌سازی شرکت ---------------- */

function chooseLocation(locations: any[], province?: string | null, city?: string | null) {
  if (!locations.length) return null
  if (province && city) {
    const m = locations.find((l) => l.province === province && l.city === city)
    if (m) return m
  }
  if (province) {
    const m = locations.find((l) => l.province === province)
    if (m) return m
  }
  return locations.find((l) => l.locationType === 'hq') ?? locations[0]
}

export function serializeCompanyListItem(company: any, opts?: { province?: string | null; city?: string | null }) {
  const loc = chooseLocation(company.locations ?? [], opts?.province, opts?.city)
  const ceo = (company.officers ?? []).find((o: any) => o.role === 'ceo' && o.isCurrent) ?? (company.officers ?? []).find((o: any) => o.role === 'ceo')
  const evidences: any[] = company.evidence ?? []
  const avgConfidence = evidences.length
    ? Math.round(evidences.reduce((s, e) => s + (e.confidence ?? 0), 0) / evidences.length)
    : 0
  return {
    id: company.id,
    officialName: company.officialName,
    ownershipType: company.ownershipType,
    activityStatus: company.activityStatus,
    reviewStatus: company.reviewStatus,
    needsReview: company.needsReview,
    reviewReason: company.reviewReason,
    affiliationName: company.affiliationName,
    ceoName: ceo?.personName ?? null,
    province: loc?.province ?? null,
    city: loc?.city ?? null,
    address: loc?.address ?? null,
    confidence: avgConfidence,
    evidenceCount: evidences.length,
    lastCheckedAt: company.lastCheckedAt,
    createdAt: company.createdAt,
  }
}

export async function serializeCompanyDetail(id: string) {
  const company = await db.company.findUnique({
    where: { id },
    include: {
      locations: true,
      contacts: true,
      officers: true,
      cooperationRecords: { orderBy: { createdAt: 'desc' } },
      evidence: {
        include: {
          source: { select: { url: true, title: true, publisher: true, sourceType: true, fetchedAt: true } },
        },
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      },
    },
  })
  if (!company) return null
  const audits = await db.auditLog.findMany({
    where: { OR: [{ entityType: 'company', entityId: id }, { entityType: 'evidence', entityId: { in: company.evidence.map((e) => e.id) } }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return {
    ...company,
    locations: company.locations,
    contacts: company.contacts,
    officers: company.officers,
    cooperationRecords: company.cooperationRecords,
    evidence: company.evidence.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      fieldName: e.fieldName,
      claimedValue: e.claimedValue,
      quoteText: e.quoteText,
      effectiveDate: e.effectiveDate,
      confidence: e.confidence,
      reviewStatus: e.reviewStatus,
      conflict: e.conflict,
      createdAt: e.createdAt,
      source: e.source,
    })),
    audits,
  }
}

/* ---------------- اعتبارسنجی ---------------- */

export const VALID_OWNERSHIP = ['state', 'semi_state', 'private', 'unknown']
export const VALID_ACTIVITY = ['active', 'semi_active', 'inactive', 'unknown']
export const VALID_ENTITY = ['company', 'factory', 'other']
export const VALID_LOCATION_TYPES = ['hq', 'factory', 'branch', 'sales_office']
export const VALID_CONTACT_TYPES = ['phone', 'mobile', 'fax', 'email']

export function normalizeQKey(q: string): string {
  return normalizeNameKey(q)
}
