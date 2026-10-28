// POST /api/companies/[id]/merge — ادغام نرم دو رکورد شرکت
import { db } from '@/lib/db'
import { jsonError } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sourceId } = await params
    const body = await request.json().catch(() => null)
    const targetId = typeof body?.targetId === 'string' ? body.targetId : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

    if (!reason) return jsonError('ثبت دلیل ادغام الزامی است')
    if (!targetId) return jsonError('شناسه شرکت هدف الزامی است')
    if (targetId === sourceId) return jsonError('شرکت مبدأ و هدف نمی‌توانند یکسان باشند')

    const [source, target] = await Promise.all([
      db.company.findUnique({ where: { id: sourceId } }),
      db.company.findUnique({ where: { id: targetId } }),
    ])
    if (!source) return jsonError('شرکت مبدأ یافت نشد', 404)
    if (!target) return jsonError('شرکت هدف یافت نشد', 404)

    // انتقال روابط بدون تکرار دقیق
    const sourceLocations = await db.companyLocation.findMany({ where: { companyId: sourceId } })
    const targetLocations = await db.companyLocation.findMany({ where: { companyId: targetId } })
    for (const loc of sourceLocations) {
      const dup = targetLocations.find(
        (t) =>
          (t.address && loc.address && t.address === loc.address) ||
          (!t.address && !loc.address && t.province === loc.province && t.city === loc.city),
      )
      if (!dup) {
        await db.companyLocation.create({
          data: {
            companyId: targetId,
            locationType: loc.locationType,
            name: loc.name,
            province: loc.province,
            city: loc.city,
            county: loc.county,
            address: loc.address,
            postalCode: loc.postalCode,
            currentStatus: loc.currentStatus,
          },
        })
      }
    }

    const sourceContacts = await db.companyContact.findMany({ where: { companyId: sourceId } })
    const targetContacts = await db.companyContact.findMany({ where: { companyId: targetId } })
    for (const c of sourceContacts) {
      const dup = targetContacts.find((t) => t.value === c.value && t.contactType === c.contactType)
      if (!dup) {
        await db.companyContact.create({
          data: {
            companyId: targetId,
            contactType: c.contactType,
            value: c.value,
            valueOriginal: c.valueOriginal,
            unitTitle: c.unitTitle,
            isPublic: c.isPublic,
            validationStatus: c.validationStatus,
          },
        })
      }
    }

    const sourceOfficers = await db.companyOfficer.findMany({ where: { companyId: sourceId } })
    const targetOfficers = await db.companyOfficer.findMany({ where: { companyId: targetId } })
    for (const o of sourceOfficers) {
      const dup = targetOfficers.find((t) => t.personName === o.personName && t.role === o.role)
      if (!dup) {
        await db.companyOfficer.create({
          data: {
            companyId: targetId,
            personName: o.personName,
            role: o.role,
            startDate: o.startDate,
            endDate: o.endDate,
            isCurrent: o.isCurrent,
            sourceUrl: o.sourceUrl,
          },
        })
      }
    }

    const sourceCoops = await db.cooperationRecord.findMany({ where: { companyId: sourceId } })
    const targetCoops = await db.cooperationRecord.findMany({ where: { companyId: targetId } })
    for (const r of sourceCoops) {
      const dup = targetCoops.find(
        (t) => t.organization === r.organization && t.cooperationType === r.cooperationType && t.dateText === r.dateText,
      )
      if (!dup) {
        await db.cooperationRecord.create({
          data: {
            companyId: targetId,
            organization: r.organization,
            cooperationType: r.cooperationType,
            dateText: r.dateText,
            description: r.description,
            sourceUrl: r.sourceUrl,
            verificationStatus: r.verificationStatus,
            enteredBy: r.enteredBy,
          },
        })
      }
    }

    // انتقال شواهد به هدف (حفظ تبار شواهد)
    await db.fieldEvidence.updateMany({ where: { companyId: sourceId }, data: { companyId: targetId } })

    // وضعیت مبدأ
    await db.company.update({
      where: { id: sourceId },
      data: { mergedIntoId: targetId, reviewStatus: 'rejected', needsReview: false, reviewReason: null },
    })

    await db.auditLog.create({
      data: {
        entityType: 'company',
        entityId: sourceId,
        fieldName: 'mergedIntoId',
        oldValue: null,
        newValue: `ادغام در ${targetId}`,
        reason,
        actor: 'human',
      },
    })
    await db.auditLog.create({
      data: {
        entityType: 'company',
        entityId: targetId,
        fieldName: 'merge',
        oldValue: null,
        newValue: `ادغام رکورد ${sourceId} در این رکورد`,
        reason,
        actor: 'human',
      },
    })

    return Response.json({ ok: true, sourceId, targetId })
  } catch (e) {
    return Response.json({ error: `خطا در ادغام شرکت‌ها: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
