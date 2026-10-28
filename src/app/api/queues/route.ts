// GET /api/queues?type=uncertain|conflict|duplicates|missing — صف‌های بررسی
import { db } from '@/lib/db'
import { serializeCompanyListItem } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

 

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type') ?? 'uncertain'

    if (type === 'uncertain') {
      const companies = await db.company.findMany({
        where: { mergedIntoId: null, needsReview: true },
        include: {
          locations: true,
          officers: { where: { role: 'ceo' } },
          evidence: { select: { confidence: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      })
      return Response.json({ type, items: companies.map((c) => serializeCompanyListItem(c)) })
    }

    if (type === 'conflict') {
      const evidences = await db.fieldEvidence.findMany({
        where: { conflict: true },
        include: {
          company: { select: { id: true, officialName: true } },
          source: { select: { url: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
      return Response.json({
        type,
        items: evidences.map((e) => ({
          companyId: e.company.id,
          companyName: e.company.officialName,
          fieldName: e.fieldName,
          claimedValue: e.claimedValue,
          confidence: e.confidence,
          sourceUrl: e.source?.url ?? null,
          quoteText: e.quoteText,
          evidenceId: e.id,
          createdAt: e.createdAt,
        })),
      })
    }

    if (type === 'duplicates') {
      const companies = await db.company.findMany({
        where: { mergedIntoId: null },
        include: { locations: { where: { locationType: 'hq' }, take: 1 } },
      })
      const groupsMap = new Map<string, Array<{ id: string; officialName: string; province: string | null }>>()
      for (const c of companies) {
        const key = c.normalizedName
        if (!key) continue
        const arr = groupsMap.get(key) ?? []
        arr.push({ id: c.id, officialName: c.officialName, province: c.locations[0]?.province ?? null })
        groupsMap.set(key, arr)
      }
      const groups: Array<{ key: string; items: Array<{ id: string; officialName: string; province: string | null }> }> = []
      for (const [key, items] of groupsMap) {
        const flagged = items.length > 1
        const hasRepeatReason = companies.some((c) => c.normalizedName === key && (c.reviewReason ?? '').includes('تکرار'))
        if (flagged || hasRepeatReason) {
          groups.push({ key, items })
        }
      }
      // گروه‌های تکیِ علامت‌خورده به «تکرار» هم باید بیایند (در حلقه بالا پوشش داده شدند)
      return Response.json({ type, items: groups })
    }

    if (type === 'missing') {
      const FIELDS: Array<{ field: string; fa: string }> = [
        { field: 'website', fa: 'وب‌سایت' },
        { field: 'national_id', fa: 'شناسه ملی' },
        { field: 'ceo_name', fa: 'نام مدیرعامل' },
        { field: 'activity_description', fa: 'زمینه فعالیت' },
        { field: 'address', fa: 'آدرس' },
        { field: 'phone', fa: 'تلفن' },
      ]
      const companies = await db.company.findMany({
        where: { mergedIntoId: null },
        include: {
          officers: { where: { role: 'ceo', isCurrent: true }, take: 1 },
          contacts: { where: { contactType: { in: ['phone', 'mobile'] } } },
          locations: true,
        },
      })
      const items: Array<{ field: string; fieldFa: string; missingCount: number; samples: Array<{ id: string; officialName: string }> }> = []
      const checkers: Record<string, (c: any) => boolean> = {
        website: (c) => !c.website,
        national_id: (c) => !c.nationalId,
        ceo_name: (c) => !(c.officers ?? []).length,
        activity_description: (c) => !c.activityDescription,
        address: (c) => !(c.locations ?? []).some((l: any) => l.address),
        phone: (c) => !(c.contacts ?? []).some((ct: any) => !(ct.unitTitle ?? '').includes('مدیرعامل')),
      }
      for (const f of FIELDS) {
        const missing = companies.filter((c) => checkers[f.field](c))
        items.push({
          field: f.field,
          fieldFa: f.fa,
          missingCount: missing.length,
          samples: missing.slice(0, 5).map((c) => ({ id: c.id, officialName: c.officialName })),
        })
      }
      return Response.json({ type, items })
    }

    return Response.json({ error: 'نوع صف نامعتبر است؛ مقادیر مجاز: uncertain، conflict، duplicates، missing' }, { status: 400 })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت صف: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
