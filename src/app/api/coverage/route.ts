// GET /api/coverage — پوشش جغرافیایی و وضعیت منابع
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [locations, sourcesCheckedAgg, unreachableSources] = await Promise.all([
      db.companyLocation.findMany({
        where: { company: { mergedIntoId: null } },
        select: { province: true, companyId: true, company: { select: { needsReview: true, lastCheckedAt: true } } },
      }),
      db.crawlJob.aggregate({ _sum: { statsSourcesChecked: true } }),
      db.source.count({ where: { accessStatus: { not: 'ok' } } }),
    ])

    const byProvince = new Map<string, { companyIds: Set<string>; uncertain: number; lastChecked: Date | null }>()
    for (const loc of locations) {
      if (!loc.province) continue
      const entry = byProvince.get(loc.province) ?? { companyIds: new Set<string>(), uncertain: 0, lastChecked: null }
      entry.companyIds.add(loc.companyId)
      if (loc.company.needsReview) entry.uncertain += 1
      const lc = loc.company.lastCheckedAt
      if (lc && (!entry.lastChecked || lc > entry.lastChecked)) entry.lastChecked = lc
      byProvince.set(loc.province, entry)
    }

    const provinces = [...byProvince.entries()]
      .map(([province, v]) => ({
        province,
        companies: v.companyIds.size,
        uncertain: v.uncertain,
        lastChecked: v.lastChecked,
      }))
      .sort((a, b) => b.companies - a.companies)

    return Response.json({
      provinces,
      sourcesChecked: sourcesCheckedAgg._sum.statsSourcesChecked ?? 0,
      unreachableSources,
    })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت پوشش: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
