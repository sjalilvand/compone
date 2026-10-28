// GET /api/companies — فهرست شرکت‌ها با فیلتر و صفحه‌بندی
import { db } from '@/lib/db'
import { serializeCompanyListItem, normalizeQKey } from '@/lib/api-helpers'
import { normalizeNameKey } from '@/lib/normalize'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const province = url.searchParams.get('province')?.trim() ?? ''
    const city = url.searchParams.get('city')?.trim() ?? ''
    const ownership = url.searchParams.get('ownership')?.trim() ?? ''
    const status = url.searchParams.get('status')?.trim() ?? '' // activityStatus
    const review = url.searchParams.get('review')?.trim() ?? ''
    const needsReview = url.searchParams.get('needsReview')
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20))

    const where: Record<string, unknown> = { mergedIntoId: null }

    if (q) {
      const key = normalizeQKey(q)
      where.OR = [
        { officialName: { contains: q } },
        { normalizedName: { contains: key } },
        ...(key ? [{ normalizedName: { contains: normalizeNameKey(q) } }] : []),
      ]
    }
    if (ownership) where.ownershipType = ownership
    if (status) where.activityStatus = status
    if (review) where.reviewStatus = review
    if (needsReview === 'true') where.needsReview = true
    if (needsReview === 'false') where.needsReview = false

    // فیلتر جغرافیایی از روی محل‌ها
    if (province || city) {
      const locWhere: Record<string, unknown> = {}
      if (province) locWhere.province = province
      if (city) locWhere.city = city
      const locs = await db.companyLocation.findMany({ where: locWhere, select: { companyId: true } })
      const ids = [...new Set(locs.map((l) => l.companyId))]
      where.id = ids.length ? { in: ids } : { in: ['__none__'] }
    }

    const [total, companies] = await Promise.all([
      db.company.count({ where }),
      db.company.findMany({
        where,
        include: {
          locations: true,
          officers: { where: { role: 'ceo' } },
          evidence: { select: { confidence: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return Response.json({
      items: companies.map((c) => serializeCompanyListItem(c, { province: province || null, city: city || null })),
      total,
      page,
      pageSize,
    })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت شرکت‌ها: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
