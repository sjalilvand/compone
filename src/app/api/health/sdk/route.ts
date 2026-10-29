// GET /api/health/sdk — بررسی دسترسی سرویس هوش مصنوعی/جست‌وجوی وب برای پنل
import { sdkHealthCheck } from '@/lib/agent/sdk'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const health = await sdkHealthCheck()
    return Response.json(health, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return Response.json(
      { ok: false, message: `بررسی سلامت سرویس ناموفق بود: ${e instanceof Error ? e.message : String(e)}` },
      { status: 200 },
    )
  }
}
