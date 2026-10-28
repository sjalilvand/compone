// خروجی اکسل — تطابق دقیق با قالب کارفرما (۴ شیت، راست‌به‌چپ)

import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { safeCell, normalizePersian } from '@/lib/normalize'

 

export interface ExportOptions {
  jobId?: string | null
  scope: 'all' | 'province'
  province?: string | null
}

const MITRA = 'B Mitra'
const THIN: ExcelJS.Borders = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
} as unknown as ExcelJS.Borders

const OWNERSHIP_FA: Record<string, string> = { state: 'دولتی', semi_state: 'نیمه دولتی', private: 'خصوصی', unknown: '' }
const ACTIVITY_FA: Record<string, string> = { active: 'فعال', semi_active: 'نیمه فعال', inactive: 'غیرفعال', unknown: '' }
const ENTITY_FA: Record<string, string> = { company: 'شرکت', factory: 'کارخانه', other: 'سایر' }
const REVIEW_FA: Record<string, string> = { ai_extracted: 'استخراج هوش مصنوعی', human_verified: 'تأیید انسانی', rejected: 'ردشده' }
const SOURCE_TYPE_FA: Record<string, string> = { official: 'رسمی', guild: 'اصناف', news: 'خبری', directory: 'دایرکتوری', other: 'سایر' }
const EVIDENCE_REVIEW_FA: Record<string, string> = { pending: 'در انتظار', approved: 'تأییدشده', rejected: 'ردشده' }
const JOB_STATUS_FA: Record<string, string> = {
  pending: 'در انتظار اجرا',
  running: 'در حال اجرا',
  paused: 'متوقف‌شده (قابل ادامه)',
  stopping: 'در حال توقف',
  completed: 'تکمیل‌شده',
  failed: 'ناموفق',
}
const LOCATION_TYPE_FA: Record<string, string> = { hq: 'دفتر مرکزی', factory: 'کارخانه', branch: 'شعبه', sales_office: 'دفتر فروش' }
const COVERAGE_NOTE = 'پوشش کامل تضمین نمی‌شود؛ فهرست منابع بررسی‌شده ملاک است.'

type CompanyRow = any

function rtl(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name, {
    views: [{ rightToLeft: true }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  })
  return ws
}

function styleCell(cell: ExcelJS.Cell, opts: { font?: Partial<ExcelJS.Font>; size?: number; bold?: boolean; fill?: string } = {}) {
  cell.font = {
    name: MITRA,
    size: opts.size ?? 12,
    bold: opts.bold ?? false,
    ...(opts.font ?? {}),
  }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = THIN
  if (opts.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }
  }
}

function setWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
}

function chooseLocation(company: CompanyRow, province?: string | null, city?: string | null): any | null {
  const locs: any[] = company.locations ?? []
  if (!locs.length) return null
  if (province && city) {
    const m = locs.find((l) => l.province === province && l.city === city)
    if (m) return m
  }
  if (province) {
    const m = locs.find((l) => l.province === province)
    if (m) return m
  }
  const hq = locs.find((l) => l.locationType === 'hq')
  return hq ?? locs[0]
}

function ceoName(company: CompanyRow): string {
  const officers: any[] = company.officers ?? []
  const ceo = officers.find((o) => o.role === 'ceo' && o.isCurrent) ?? officers.find((o) => o.role === 'ceo')
  return ceo?.personName ?? ''
}

function emdadValue(company: CompanyRow): string {
  const records: any[] = (company.cooperationRecords ?? []).filter((r) => (r.organization ?? '').includes('کمیته امداد'))
  const has = records.some((r) => r.cooperationType && !r.cooperationType.startsWith('عدم'))
  if (has) return 'دارد'
  const hasNotVerified = records.some((r) => r.cooperationType?.startsWith('عدم') && r.verificationStatus === 'verified')
  if (hasNotVerified) return 'ندارد'
  return '' // نامشخص در شیت اصلی خالی می‌ماند (قاعده کارفرما)
}

function contactsValue(company: CompanyRow): string {
  const phones: any[] = (company.contacts ?? []).filter(
    (c) => (c.contactType === 'phone' || c.contactType === 'mobile') && c.isPublic && c.validationStatus !== 'rejected',
  )
  const parts: string[] = []
  const companyPhone = phones.find((c) => !(c.unitTitle ?? '').includes('مدیرعامل'))
  const ceoPhone = phones.find((c) => (c.unitTitle ?? '').includes('مدیرعامل'))
  if (companyPhone) parts.push(`شرکت: ${companyPhone.value}`)
  if (ceoPhone) parts.push(`مدیرعامل: ${ceoPhone.value}`)
  return parts.join(' — ')
}

function officialNameWithBrand(company: CompanyRow): string {
  const name = safeCell(company.officialName)
  const brand = company.brandName ? safeCell(company.brandName) : ''
  if (brand && normalizePersian(brand) !== normalizePersian(company.officialName)) {
    return `${name} (${brand})`
  }
  return name
}

async function pickCompanies(opts: ExportOptions): Promise<CompanyRow[]> {
  const where: any = { mergedIntoId: null }
  if (opts.jobId) where.sourceJobId = opts.jobId
  if (opts.scope === 'province' && opts.province) {
    where.locations = { some: { province: opts.province } }
  }
  const companies = await db.company.findMany({
    where,
    include: {
      locations: true,
      contacts: true,
      officers: true,
      cooperationRecords: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return companies
}

/* ---------------- شیت ۱: قالب اصلی ---------------- */

function buildSheet1(wb: ExcelJS.Workbook, companies: CompanyRow[], province?: string | null, city?: string | null) {
  const ws = rtl(wb, 'Sheet1')
  setWidths(ws, [5.66, 20, 52, 28.22, 25.44, 13.22, 10.55, 46.66, 17.78, 100.33])

  // عنوان
  ws.mergeCells('A1:J2')
  const title = ws.getCell('A1')
  title.value = safeCell('فهرست اسامی شرکت های دولتی و خصوصی شاخص')
  styleCell(title, { bold: true, size: 12 })

  // سرستون‌ها (ردیف ۳ تا ۵) — ادغام‌های دقیق مطابق قالب
  ws.mergeCells('A3:A5')
  ws.getCell('A3').value = safeCell('ردیف')

  ws.getCell('B4').value = safeCell('استان') // بدون ادغام طبق قالب

  ws.mergeCells('C3:C5')
  ws.getCell('C3').value = safeCell('نام شرکت')

  ws.getCell('D3').value = safeCell('وابسته به وزارت/ سازمان/ هلدینگ')
  ws.mergeCells('D4:D5')
  ws.getCell('D4').value = safeCell('(دولتی / نیمه دولتی / خصوصی)')

  ws.getCell('E3').value = safeCell('وضعیت فعالیت ')
  ws.mergeCells('E4:E5')
  ws.getCell('E4').value = safeCell('(فعال / نیمه فعال/ غیر فعال)')

  ws.getCell('F3').value = safeCell('کالا/ خدمات تولیدی / تجاری')
  ws.mergeCells('F4:F5')
  ws.getCell('F4').value = safeCell('(زمینه فعالیت)')

  ws.getCell('G3').value = safeCell('سابقه همکاری با کمیته امداد')
  ws.mergeCells('G4:G5')
  ws.getCell('G4').value = safeCell('دارد / ندارد')

  ws.mergeCells('H3:H5')
  ws.getCell('H3').value = safeCell('نام مدیر عامل')

  ws.getCell('I3').value = safeCell('شماره تماس ')
  ws.mergeCells('I4:I5')
  ws.getCell('I4').value = safeCell('شرکت / مدیر عامل')

  ws.getCell('J3').value = safeCell('آدرس')
  ws.mergeCells('J4:J5')
  ws.getCell('J4').value = safeCell('شرکت / دفتر مرکزی')

  // استایل همه سلول‌های هدر (شامل خانه‌های خالی B3 و B5)
  for (let row = 3; row <= 5; row++) {
    for (let col = 1; col <= 10; col++) {
      styleCell(ws.getCell(row, col), { bold: true, size: 12 })
    }
  }

  // داده‌ها از ردیف ۶
  let rowIdx = 6
  let seq = 1
  for (const company of companies) {
    const loc = chooseLocation(company, province, city)
    const ownershipFa = OWNERSHIP_FA[company.ownershipType] ?? ''
    const affiliation = company.affiliationName ? safeCell(company.affiliationName) : ''
    const colD = affiliation ? `${affiliation}${ownershipFa ? ` (${ownershipFa})` : ''}` : ownershipFa

    const address = loc?.address ? safeCell(loc.address) : ''
    const cityFa = loc?.city ? safeCell(loc.city) : ''
    const colJ = address ? (cityFa ? `${cityFa}، ${address}` : address) : ''

    const row = ws.getRow(rowIdx)
    row.height = 30
    const values = [
      seq,
      loc?.province ? safeCell(loc.province) : '',
      officialNameWithBrand(company),
      colD,
      ACTIVITY_FA[company.activityStatus] ?? '',
      company.activityDescription ? safeCell(company.activityDescription) : '',
      emdadValue(company),
      ceoName(company) ? safeCell(ceoName(company)) : '',
      contactsValue(company),
      colJ,
    ]
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v === '' ? '' : v
      styleCell(cell, { size: 11 })
    })
    rowIdx++
    seq++
  }
}

/* ---------------- شیت ۲: اطلاعات تکمیلی ---------------- */

function unknownFieldsFa(company: CompanyRow): string {
  const unknown: string[] = []
  if (!company.ownershipType || company.ownershipType === 'unknown') unknown.push('نوع مالکیت')
  if (!company.activityStatus || company.activityStatus === 'unknown') unknown.push('وضعیت فعالیت')
  if (!ceoName(company)) unknown.push('مدیرعامل')
  const hasPhone = (company.contacts ?? []).some((c: any) => c.contactType === 'phone' || c.contactType === 'mobile')
  if (!hasPhone) unknown.push('تلفن')
  const hasAddress = (company.locations ?? []).some((l: any) => l.address)
  if (!hasAddress) unknown.push('آدرس')
  if (!(company.cooperationRecords ?? []).some((r: any) => (r.organization ?? '').includes('کمیته امداد'))) unknown.push('سابقه همکاری')
  return unknown.join('، ')
}

function buildSheet2(wb: ExcelJS.Workbook, companies: CompanyRow[]) {
  const ws = rtl(wb, 'اطلاعات تکمیلی')
  setWidths(ws, [22, 32, 18, 14, 18, 12, 20, 26, 18, 16, 34])

  const headers = [
    'شناسه داخلی',
    'نام شرکت',
    'شناسه ملی',
    'شماره ثبت',
    'شهر',
    'نوع مجموعه',
    'نوع محل',
    'وب‌سایت',
    'تاریخ آخرین بررسی',
    'وضعیت تأیید',
    'فیلدهای نامشخص',
  ]
  const headerRow = ws.getRow(1)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = safeCell(h)
    styleCell(cell, { bold: true, fill: 'FFF2F2F2' })
  })
  headerRow.height = 24

  let rowIdx = 2
  for (const company of companies) {
    const loc = chooseLocation(company)
    const locTypes = [...new Set((company.locations ?? []).map((l: any) => l.locationType))]
      .map((t) => LOCATION_TYPE_FA[String(t)] ?? String(t))
      .join('، ')
    const row = ws.getRow(rowIdx)
    row.height = 22
    const values = [
      safeCell(company.id),
      safeCell(company.officialName),
      safeCell(company.nationalId ?? ''),
      safeCell(company.registrationNumber ?? ''),
      loc?.city ? safeCell(loc.city) : '',
      ENTITY_FA[company.entityType] ?? safeCell(company.entityType),
      locTypes,
      safeCell(company.website ?? ''),
      company.lastCheckedAt ? safeCell(company.lastCheckedAt.toISOString().slice(0, 10)) : '',
      REVIEW_FA[company.reviewStatus] ?? safeCell(company.reviewStatus),
      unknownFieldsFa(company),
    ]
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      styleCell(cell, { size: 11 })
    })
    rowIdx++
  }
}

/* ---------------- شیت ۳: منابع و شواهد ---------------- */

async function buildSheet3(wb: ExcelJS.Workbook, companyIds: string[]) {
  const ws = rtl(wb, 'منابع و شواهد')
  setWidths(ws, [22, 32, 20, 26, 42, 30, 12, 16, 50, 12, 14])

  const headers = [
    'شناسه شرکت',
    'نام شرکت',
    'نام فیلد',
    'مقدار',
    'URL منبع',
    'عنوان منبع',
    'نوع منبع',
    'تاریخ بررسی',
    'متن شاهد',
    'سطح اطمینان',
    'وضعیت تأیید',
  ]
  const headerRow = ws.getRow(1)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = safeCell(h)
    styleCell(cell, { bold: true, fill: 'FFF2F2F2' })
  })
  headerRow.height = 24

  if (!companyIds.length) return
  const evidence = await db.fieldEvidence.findMany({
    where: { companyId: { in: companyIds } },
    include: { source: true, company: { select: { officialName: true } } },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
  })

  let rowIdx = 2
  for (const ev of evidence) {
    const row = ws.getRow(rowIdx)
    row.height = 22
    const values = [
      safeCell(ev.companyId),
      safeCell(ev.company?.officialName ?? ''),
      safeCell(ev.fieldName),
      safeCell(ev.claimedValue ?? ''),
      safeCell(ev.source?.url ?? ''),
      safeCell(ev.source?.title ?? ''),
      SOURCE_TYPE_FA[ev.source?.sourceType ?? ''] ?? safeCell(ev.source?.sourceType ?? ''),
      safeCell(ev.createdAt.toISOString().slice(0, 10)),
      safeCell(ev.quoteText ?? ''),
      ev.confidence, // عدد
      EVIDENCE_REVIEW_FA[ev.reviewStatus] ?? safeCell(ev.reviewStatus),
    ]
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v
      styleCell(cell, { size: 11 })
    })
    rowIdx++
  }
}

/* ---------------- شیت ۴: گزارش اجرا ---------------- */

function addLabelValue(ws: ExcelJS.Worksheet, rowIdx: number, label: string, value: string, bold = false): number {
  const row = ws.getRow(rowIdx)
  const labelCell = row.getCell(1)
  labelCell.value = safeCell(label)
  styleCell(labelCell, { bold: true, fill: bold ? 'FFF2F2F2' : undefined, size: 11 })
  const valueCell = row.getCell(2)
  valueCell.value = safeCell(value)
  styleCell(valueCell, { size: 11 })
  row.alignment = { vertical: 'middle' }
  return rowIdx + 1
}

async function buildSheet4(wb: ExcelJS.Workbook, jobId?: string | null) {
  const ws = rtl(wb, 'گزارش اجرا')
  setWidths(ws, [30, 96])

  const title = ws.getCell('A1')
  title.value = safeCell('گزارش اجرای سامانه کشف شرکت‌ها و کارخانه‌های ایران')
  styleCell(title, { bold: true, size: 13 })

  let rowIdx = 3
  const jobs = jobId
    ? await db.crawlJob.findMany({ where: { id: jobId } })
    : await db.crawlJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })

  if (jobs.length) {
    for (const job of jobs) {
      const provinces = safeParse(job.provinces, [])
      const cities = safeParse(job.cities, [])
      const candidates = safeParse<Array<{ name: string }>>(job.candidatesState, [])
      rowIdx = addLabelValue(ws, rowIdx, `کار: ${job.name ?? job.id}`, '')
      rowIdx = addLabelValue(ws, rowIdx, 'محدوده بررسی', `استان‌ها: ${provinces.join('، ') || '—'} | شهرها: ${cities.join('، ') || '—'}`)
      rowIdx = addLabelValue(ws, rowIdx, 'وضعیت اجرا', JOB_STATUS_FA[job.status] ?? job.status)
      rowIdx = addLabelValue(ws, rowIdx, 'زمان شروع', job.startedAt ? job.startedAt.toISOString().slice(0, 16).replace('T', ' ') : '—')
      rowIdx = addLabelValue(ws, rowIdx, 'زمان پایان', job.finishedAt ? job.finishedAt.toISOString().slice(0, 16).replace('T', ' ') : '—')
      rowIdx = addLabelValue(ws, rowIdx, 'منابع بررسی‌شده', String(job.statsSourcesChecked))
      rowIdx = addLabelValue(ws, rowIdx, 'شرکت‌های شناسایی‌شده (نامزدها)', String(candidates.length))
      rowIdx = addLabelValue(ws, rowIdx, 'درخواست‌های انجام‌شده', `${job.requestsMade} از ${job.maxRequests}`)
      rowIdx = addLabelValue(ws, rowIdx, 'رکوردهای جدید', String(job.statsNewCompanies))
      rowIdx = addLabelValue(ws, rowIdx, 'به‌روزرسانی‌شده', String(job.statsUpdatedCompanies))
      rowIdx = addLabelValue(ws, rowIdx, 'موارد نامطمئن', String(job.statsUncertain))
      const errors = safeParse<Array<{ message: string }>>(job.errorsLog, [])
      rowIdx = addLabelValue(ws, rowIdx, 'خطاها', `${errors.length} مورد`)
      for (const err of errors.slice(0, 10)) {
        rowIdx = addLabelValue(ws, rowIdx, '  ↳ خطا', err.message)
      }
      rowIdx = addLabelValue(ws, rowIdx, 'محدودیت‌های پوشش', COVERAGE_NOTE)
      rowIdx += 1 // ردیف خالی بین کارها
    }
  } else {
    rowIdx = addLabelValue(ws, rowIdx, 'کار اجراشده', 'هیچ کاری ثبت نشده است')
    rowIdx = addLabelValue(ws, rowIdx, 'محدودیت‌های پوشش', COVERAGE_NOTE)
    rowIdx += 1
  }

  const totalCompanies = await db.company.count({ where: { mergedIntoId: null } })
  const verified = await db.company.count({ where: { mergedIntoId: null, reviewStatus: 'human_verified' } })
  rowIdx = addLabelValue(ws, rowIdx, 'تعداد کل شرکت‌های پایگاه داده', String(totalCompanies), true)
  rowIdx = addLabelValue(ws, rowIdx, 'تعداد تأیید انسانی', String(verified), true)
}

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/* ---------------- سازنده کتاب ---------------- */

export async function buildExportWorkbook(opts: ExportOptions): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'سامانه بانک اطلاعات شرکت‌ها و کارخانه‌های ایران'
  wb.created = new Date()

  const companies = await pickCompanies(opts)
  const province = opts.scope === 'province' ? opts.province : null

  buildSheet1(wb, companies, province, null)
  buildSheet2(wb, companies)
  await buildSheet3(wb, companies.map((c) => c.id))
  await buildSheet4(wb, opts.jobId ?? null)

  const buffer = await wb.xlsx.writeBuffer()
  const bytes = buffer instanceof Uint8Array ? new Uint8Array(buffer) : new Uint8Array(buffer as ArrayBuffer)
  return bytes
}
