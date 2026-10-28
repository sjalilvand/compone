// POST /api/companies/[id]/review — تأیید/رد سطح شرکت یا شاهد
import { db } from '@/lib/db'
import { serializeCompanyDetail, jsonError } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const company = await db.company.findUnique({ where: { id } })
    if (!company) return jsonError('شرکت یافت نشد', 404)

    const body = await request.json().catch(() => null)
    const action = body?.action
    if (action !== 'approve' && action !== 'reject') return jsonError('کنش نامعتبر است؛ مقادیر مجاز: approve، reject')
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const evidenceId = typeof body?.evidenceId === 'string' ? body.evidenceId : null

    if (evidenceId) {
      const evidence = await db.fieldEvidence.findFirst({ where: { id: evidenceId, companyId: id } })
      if (!evidence) return jsonError('شاهد یافت نشد', 404)
      await db.fieldEvidence.update({
        where: { id: evidenceId },
        data: { reviewStatus: action === 'approve' ? 'approved' : 'rejected' },
      })
      await db.auditLog.create({
        data: {
          entityType: 'evidence',
          entityId: evidenceId,
          fieldName: evidence.fieldName,
          oldValue: evidence.reviewStatus,
          newValue: action === 'approve' ? 'approved' : 'rejected',
          reason: reason || null,
          actor: 'human',
        },
      })
    } else {
      await db.company.update({
        where: { id },
        data: {
          reviewStatus: action === 'approve' ? 'human_verified' : 'rejected',
          needsReview: false,
          ...(action === 'approve' ? { reviewReason: null } : {}),
        },
      })
      await db.auditLog.create({
        data: {
          entityType: 'company',
          entityId: id,
          fieldName: 'reviewStatus',
          oldValue: company.reviewStatus,
          newValue: action === 'approve' ? 'human_verified' : 'rejected',
          reason: reason || null,
          actor: 'human',
        },
      })
    }

    const detail = await serializeCompanyDetail(id)
    return Response.json({ ok: true, company: detail })
  } catch (e) {
    return Response.json({ error: `خطا در بازبینی شرکت: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
