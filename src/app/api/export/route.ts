// GET /api/export?jobId=&scope=all|province&province=... — خروجی اکسل مطابق قالب
import { buildExportWorkbook } from '@/lib/excel/export'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')?.trim() || null
    const scope = url.searchParams.get('scope') === 'province' ? 'province' : 'all'
    const province = url.searchParams.get('province')?.trim() || null

    if (scope === 'province' && !province) {
      return Response.json({ error: 'برای محدوده استان، پارامتر province الزامی است' }, { status: 400 })
    }

    const bytes = await buildExportWorkbook({ jobId, scope, province })

    const now = new Date()
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const filename = `companies-export-${ymd}.xlsx`

    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return Response.json({ error: `خطا در تولید خروجی اکسل: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
