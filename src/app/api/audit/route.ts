// GET /api/audit?limit=200 — لاگ حسابرسی
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') ?? '200', 10) || 200))
    const entityType = url.searchParams.get('entityType')?.trim() ?? ''
    const items = await db.auditLog.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return Response.json({ items })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت حسابرسی: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
