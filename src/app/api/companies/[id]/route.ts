// GET/PATCH /api/companies/[id] — جزئیات شرکت و ویرایش انسانی با دلیل
import { db } from '@/lib/db'
import { serializeCompanyDetail, jsonError, VALID_OWNERSHIP, VALID_ACTIVITY, VALID_ENTITY, VALID_LOCATION_TYPES, VALID_CONTACT_TYPES } from '@/lib/api-helpers'
import { normalizePersian, normalizeNameKey } from '@/lib/normalize'

export const dynamic = 'force-dynamic'

 

// نگاشت فیلدهای قابل ویرایش به نام فیلد شواهد
const FIELD_TO_EVIDENCE: Record<string, string> = {
  officialName: 'company_name',
  ownershipType: 'ownership_type',
  activityStatus: 'activity_status',
  activityDescription: 'activity_description',
  affiliationName: 'affiliation_name',
  nationalId: 'national_id',
  registrationNumber: 'registration_number',
  website: 'website',
  entityType: 'entity_type',
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const detail = await serializeCompanyDetail(id)
    if (!detail) return jsonError('شرکت یافت نشد', 404)
    return Response.json({ company: detail })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت شرکت: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const company = await db.company.findUnique({ where: { id } })
    if (!company) return jsonError('شرکت یافت نشد', 404)

    const body = await request.json().catch(() => null)
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (!reason) return jsonError('ثبت دلیل ویرایش الزامی است')

    const patch = body?.patch && typeof body.patch === 'object' ? body.patch : {}
    const locations = Array.isArray(body?.locations) ? body.locations : []
    const contacts = Array.isArray(body?.contacts) ? body.contacts : []

    // اعتبارسنجی مقادیر فهرستی
    if (patch.ownershipType != null && !VALID_OWNERSHIP.includes(patch.ownershipType)) {
      return jsonError('نوع مالکیت نامعتبر است')
    }
    if (patch.activityStatus != null && !VALID_ACTIVITY.includes(patch.activityStatus)) {
      return jsonError('وضعیت فعالیت نامعتبر است')
    }
    if (patch.entityType != null && !VALID_ENTITY.includes(patch.entityType)) {
      return jsonError('نوع مجموعه نامعتبر است')
    }

    const companyUpdate: Record<string, unknown> = {}
    const changedFields: Array<{ field: string; old: unknown; new: unknown }> = []

    for (const [key, evidenceField] of Object.entries(FIELD_TO_EVIDENCE)) {
      if (!(key in patch)) continue
      let value = patch[key]
      if (value === undefined) continue
      if (typeof value === 'string') {
        value = key === 'website' ? value.trim() : normalizePersian(value)
        if (value === '') value = null
      }
      const oldValue = (company as any)[key]
      if ((oldValue ?? null) !== (value ?? null)) {
        companyUpdate[key] = value
        changedFields.push({ field: evidenceField, old: oldValue, new: value })
      }
    }
    if (companyUpdate.officialName) {
      companyUpdate.normalizedName = normalizeNameKey(String(companyUpdate.officialName))
    }

    if (Object.keys(companyUpdate).length) {
      await db.company.update({ where: { id }, data: { ...companyUpdate } })
    }

    // شواهد دستی + حسابرسی برای فیلدهای شرکت
    for (const ch of changedFields) {
      const existingHuman = await db.fieldEvidence.findFirst({
        where: { companyId: id, fieldName: ch.field, sourceId: null },
      })
      if (existingHuman) {
        await db.fieldEvidence.update({
          where: { id: existingHuman.id },
          data: {
            claimedValue: ch.new == null ? null : String(ch.new).slice(0, 500),
            quoteText: `ورود دستی کاربر: ${reason}`.slice(0, 400),
            confidence: 100,
            reviewStatus: 'approved',
            conflict: false,
          },
        })
      } else {
        await db.fieldEvidence.create({
          data: {
            companyId: id,
            entityType: 'company',
            fieldName: ch.field,
            claimedValue: ch.new == null ? null : String(ch.new).slice(0, 500),
            quoteText: `ورود دستی کاربر: ${reason}`.slice(0, 400),
            confidence: 100,
            reviewStatus: 'approved',
          },
        })
      }
      await db.auditLog.create({
        data: {
          entityType: 'company',
          entityId: id,
          fieldName: ch.field,
          oldValue: ch.old == null ? null : String(ch.old).slice(0, 500),
          newValue: ch.new == null ? null : String(ch.new).slice(0, 500),
          reason,
          actor: 'human',
        },
      })
    }

    // محل‌ها
    for (const loc of locations) {
      if (!loc || typeof loc !== 'object') continue
      const locationType = VALID_LOCATION_TYPES.includes(loc.locationType) ? loc.locationType : 'hq'
      const data = {
        locationType,
        name: loc.name ? normalizePersian(String(loc.name)).slice(0, 200) : null,
        province: loc.province ? normalizePersian(String(loc.province)).slice(0, 80) : null,
        city: loc.city ? normalizePersian(String(loc.city)).slice(0, 120) : null,
        county: loc.county ? normalizePersian(String(loc.county)).slice(0, 120) : null,
        address: loc.address ? normalizePersian(String(loc.address)).slice(0, 800) : null,
        postalCode: loc.postalCode ? String(loc.postalCode).slice(0, 20) : null,
      }
      if (loc.id) {
        await db.companyLocation.updateMany({ where: { id: String(loc.id), companyId: id }, data })
        await db.auditLog.create({
          data: { entityType: 'location', entityId: String(loc.id), fieldName: 'location', newValue: data.address ?? '', reason, actor: 'human' },
        })
      } else {
        const created = await db.companyLocation.create({ data: { ...data, companyId: id } })
        await db.auditLog.create({
          data: { entityType: 'location', entityId: created.id, fieldName: 'location', newValue: data.address ?? '', reason, actor: 'human' },
        })
      }
    }

    // تماس‌ها
    for (const c of contacts) {
      if (!c || typeof c !== 'object' || !c.value) continue
      const contactType = VALID_CONTACT_TYPES.includes(c.contactType) ? c.contactType : 'phone'
      const data = {
        contactType,
        value: String(c.value).slice(0, 100),
        valueOriginal: c.valueOriginal ? String(c.valueOriginal).slice(0, 200) : null,
        unitTitle: c.unitTitle ? normalizePersian(String(c.unitTitle)).slice(0, 120) : null,
        isPublic: c.isPublic !== false,
      }
      if (c.id) {
        await db.companyContact.updateMany({ where: { id: String(c.id), companyId: id }, data })
        await db.auditLog.create({
          data: { entityType: 'contact', entityId: String(c.id), fieldName: 'contact', newValue: data.value, reason, actor: 'human' },
        })
      } else {
        const created = await db.companyContact.create({ data: { ...data, companyId: id } })
        await db.auditLog.create({
          data: { entityType: 'contact', entityId: created.id, fieldName: 'contact', newValue: data.value, reason, actor: 'human' },
        })
      }
    }

    // وضعیت تأیید
    if (changedFields.length || locations.length || contacts.length) {
      await db.company.update({ where: { id }, data: { reviewStatus: 'human_verified', needsReview: false, reviewReason: null } })
    }

    const detail = await serializeCompanyDetail(id)
    return Response.json({ company: detail })
  } catch (e) {
    return Response.json({ error: `خطا در ویرایش شرکت: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
