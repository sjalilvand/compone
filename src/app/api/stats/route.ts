// GET /api/stats — آمار کلی سامانه
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [
      total,
      verified,
      aiExtracted,
      needsReview,
      conflicts,
      duplicateSuspects,
      jobsRunning,
      jobsCompleted,
      jobsTotal,
      lastCheckedCompany,
      locations,
      evidenceConflicts,
    ] = await Promise.all([
      db.company.count({ where: { mergedIntoId: null } }),
      db.company.count({ where: { mergedIntoId: null, reviewStatus: 'human_verified' } }),
      db.company.count({ where: { mergedIntoId: null, reviewStatus: 'ai_extracted' } }),
      db.company.count({ where: { mergedIntoId: null, needsReview: true } }),
      db.fieldEvidence.count({ where: { conflict: true } }),
      db.company.count({ where: { mergedIntoId: null, reviewReason: { contains: 'تکرار' } } }),
      db.crawlJob.count({ where: { status: 'running' } }),
      db.crawlJob.count({ where: { status: 'completed' } }),
      db.crawlJob.count(),
      db.company.findFirst({
        where: { mergedIntoId: null, lastCheckedAt: { not: null } },
        orderBy: { lastCheckedAt: 'desc' },
        select: { lastCheckedAt: true },
      }),
      db.companyLocation.findMany({
        where: { company: { mergedIntoId: null } },
        select: { province: true, companyId: true },
      }),
      db.fieldEvidence.findMany({ where: { conflict: true }, select: { companyId: true, fieldName: true } }),
    ])

    // استان‌های برتر (تعداد شرکت یکتا در هر استان)
    const byProvince = new Map<string, Set<string>>()
    for (const loc of locations) {
      if (!loc.province) continue
      const set = byProvince.get(loc.province) ?? new Set<string>()
      set.add(loc.companyId)
      byProvince.set(loc.province, set)
    }
    const topProvinces = [...byProvince.entries()]
      .map(([province, set]) => ({ province, count: set.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // شرکت‌های دارای تعارض (یکتا)
    const conflictCompanyIds = new Set(evidenceConflicts.map((e) => e.companyId))

    return Response.json({
      companies: {
        total,
        verified,
        aiExtracted,
        needsReview,
        conflicts: conflictCompanyIds.size,
        conflictEvidence: conflicts,
        duplicateSuspects,
      },
      jobs: {
        running: jobsRunning,
        completed: jobsCompleted,
        total: jobsTotal,
      },
      topProvinces,
      lastCheckedAt: lastCheckedCompany?.lastCheckedAt ?? null,
    })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت آمار: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
