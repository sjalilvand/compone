// قالب‌بندی اعداد و تاریخ فارسی + برچسب‌های فارسی واژگان سامانه

const faNumberFormatter = new Intl.NumberFormat('fa-IR')

/** عدد با ارقام فارسی — برای ورودی نامعتبر «—» */
export function faNum(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  if (Number.isNaN(n)) return typeof value === 'string' && value.trim() ? value : '—'
  return faNumberFormatter.format(n)
}

/** عدد بدون جداکننده هزارگان (برای شناسه‌ها) */
export function faDigits(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** تاریخ شمسی فارسی */
export function faDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return dateFormatter.format(d)
}

/** تاریخ و ساعت شمسی فارسی */
export function faDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return dateTimeFormatter.format(d)
}

/** درصد فارسی */
export function faPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${faNum(value)}٪`
}

/* ---------------- برچسب‌های فارسی ---------------- */

export const OWNERSHIP_FA: Record<string, string> = {
  state: 'دولتی',
  semi_state: 'نیمه‌دولتی',
  private: 'خصوصی',
  unknown: 'نامشخص',
}

export const ACTIVITY_FA: Record<string, string> = {
  active: 'فعال',
  semi_active: 'نیمه‌فعال',
  inactive: 'غیرفعال',
  unknown: 'نامشخص',
}

export const REVIEW_FA: Record<string, string> = {
  human_verified: 'تأییدشده',
  ai_extracted: 'استخراج هوشمند',
  rejected: 'ردشده',
}

export const JOB_STATUS_FA: Record<string, string> = {
  pending: 'در صف',
  running: 'در حال اجرا',
  paused: 'متوقف‌شده',
  stopping: 'در حال توقف',
  completed: 'تکمیل‌شده',
  failed: 'ناموفق',
}

export const STAGE_FA: Record<string, string> = {
  planning: 'برنامه‌ریزی کوئری‌ها',
  discovering: 'کشف مجموعه‌ها',
  researching: 'بررسی نامزدها',
  done: 'پایان',
}

export const LOCATION_TYPE_FA: Record<string, string> = {
  hq: 'دفتر مرکزی',
  factory: 'کارخانه',
  branch: 'شعبه',
  sales_office: 'دفتر فروش',
}

export const CONTACT_TYPE_FA: Record<string, string> = {
  phone: 'تلفن',
  mobile: 'موبایل',
  fax: 'فکس',
  email: 'ایمیل',
}

export const OFFICER_ROLE_FA: Record<string, string> = {
  ceo: 'مدیرعامل',
  chairman: 'رئیس هیئت‌مدیره',
  other: 'سایر',
}

export const SOURCE_TYPE_FA: Record<string, string> = {
  official: 'منبع رسمی',
  guild: 'منبع اصناف',
  news: 'منبع خبری',
  directory: 'فهرست/دفترچه',
  other: 'منبع دیگر',
}

export const AUDIT_ENTITY_FA: Record<string, string> = {
  company: 'شرکت',
  location: 'محل',
  contact: 'تماس',
  officer: 'مسئول',
  evidence: 'شاهد',
  job: 'کار',
}

export const ACTOR_FA: Record<string, string> = {
  agent: 'ایجنت',
  human: 'کاربر',
  system: 'سیستم',
}

export const VERIFICATION_FA: Record<string, string> = {
  unverified: 'تأییدنشده',
  verified: 'تأییدشده',
  rejected: 'ردشده',
}

export const EVIDENCE_REVIEW_FA: Record<string, string> = {
  pending: 'در انتظار بررسی',
  approved: 'تأییدشده',
  rejected: 'ردشده',
}

/** نقشه نام فیلد انگلیسی شواهد → فارسی */
export const FIELD_FA: Record<string, string> = {
  company_name: 'نام رسمی',
  affiliation_name: 'وابسته به',
  ownership_type: 'نوع مالکیت',
  activity_status: 'وضعیت فعالیت',
  activity_description: 'زمینه فعالیت',
  entity_type: 'نوع مجموعه',
  emdad_cooperation: 'سابقه همکاری با کمیته امداد',
  ceo_name: 'مدیرعامل',
  ceo_phone: 'تلفن مدیرعامل',
  company_phone: 'تلفن شرکت',
  address: 'آدرس',
  province: 'استان',
  city: 'شهر',
  website: 'وب‌سایت',
  national_id: 'شناسه ملی',
  registration_number: 'شماره ثبت',
  email: 'ایمیل',
  phone: 'تلفن',
  status: 'وضعیت',
  batch: 'ثبت دسته‌ای',
}

export function fieldFa(name: string | null | undefined): string {
  if (!name) return '—'
  return FIELD_FA[name] ?? name
}

/** برچسب مجموعه‌های قابل انتخاب در فرم اجرا */
export const COMPANY_TYPE_OPTIONS = [
  'شرکت‌های دولتی',
  'شرکت‌های نیمه‌دولتی',
  'شرکت‌های خصوصی',
  'کارخانه‌ها و واحدهای تولیدی',
  'شرکت‌های خدماتی و بازرگانی',
] as const
