// GET/POST /api/jobs — فهرست و ایجاد کار کراول
import { db } from '@/lib/db'
import { ensureJobRecovery, startJob } from '@/lib/agent/engine'
import { serializeJob, jsonError } from '@/lib/api-helpers'
import { PROVINCES } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureJobRecovery()
    const jobs = await db.crawlJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    return Response.json({ items: jobs.map(serializeJob) })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت کارها: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonError('بدنه درخواست نامعتبر است')

    const provinces: string[] = Array.isArray(body.provinces) ? body.provinces.filter((p: unknown) => typeof p === 'string') : []
    if (!provinces.length) return jsonError('انتخاب حداقل یک استان الزامی است')
    const invalid = provinces.filter((p) => !PROVINCES.includes(p))
    if (invalid.length) return jsonError(`استان نامعتبر: ${invalid.join('، ')}`)

    const cities: string[] = Array.isArray(body.cities) ? body.cities.filter((c: unknown) => typeof c === 'string') : []
    const companyTypes: string[] = Array.isArray(body.companyTypes)
      ? body.companyTypes.filter((t: unknown) => typeof t === 'string').slice(0, 20)
      : []
    const seedQueries: string[] = Array.isArray(body.seedQueries)
      ? body.seedQueries.filter((q: unknown) => typeof q === 'string' && q.trim()).slice(0, 20)
      : []
    const maxRequests = Number.isInteger(body.maxRequests) ? Math.min(5000, Math.max(5, body.maxRequests)) : 200
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 200) : null

    const job = await db.crawlJob.create({
      data: {
        name,
        provinces: JSON.stringify(provinces),
        cities: JSON.stringify(cities),
        companyTypes: JSON.stringify(companyTypes),
        seedQueries: seedQueries.length ? JSON.stringify(seedQueries) : null,
        maxRequests,
        status: 'pending',
      },
    })

    if (body.start === true) {
      await startJob(job.id)
    }

    return Response.json({ id: job.id, job: serializeJob(job) }, { status: 201 })
  } catch (e) {
    return Response.json({ error: `خطا در ایجاد کار: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
