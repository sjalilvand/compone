// داشبورد تحلیلی سامانه — محاسبه زنده از پایگاه داده (Server Component)
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Globe,
  MapPin,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'
import { db } from '@/lib/db'
import {
  ACTIVITY_FA,
  JOB_STATUS_FA,
  OFFICER_ROLE_FA,
  OWNERSHIP_FA,
  REVIEW_FA,
  SOURCE_TYPE_FA,
  STAGE_FA,
  faDateTime,
  faNum,
  faPercent,
} from '@/lib/fa-utils'
import { Chip, Donut, HBar, SectionCard, StatCard, type DonutSegment } from '@/components/dashboard/charts'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'داشبورد تحلیلی — بانک اطلاعات شرکت‌ها و کارخانه‌های ایران',
  description: 'نمای تحلیلی خروجی‌های استخراج‌شده سامانه: پوشش استانی، تکمیل ستون‌های قالب، شواهد و منابع',
}

const COLORS = {
  navy: '#1e2f4d',
  steel: '#3f6398',
  gold: '#c9a227',
  green: '#1f7a4d',
  red: '#8f3b3b',
  gray: '#a8b0bb',
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const v of values) out[v] = (out[v] ?? 0) + 1
  return out
}

export default async function DashboardPage() {
  const [companies, evidence, sources, jobs, auditCount] = await Promise.all([
    db.company.findMany({
      include: {
        locations: true,
        contacts: true,
        officers: true,
        cooperationRecords: true,
        _count: { select: { evidence: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.fieldEvidence.findMany({
      select: { companyId: true, fieldName: true, confidence: true, reviewStatus: true, conflict: true },
    }),
    db.source.findMany({ select: { url: true, sourceType: true, accessStatus: true } }),
    db.crawlJob.findMany({ orderBy: { createdAt: 'desc' }, take: 3 }),
    db.auditLog.count(),
  ])

  const total = companies.length

  /* ---------- KPI ---------- */
  const humanVerified = companies.filter((c) => c.reviewStatus === 'human_verified').length
  const aiExtracted = companies.filter((c) => c.reviewStatus === 'ai_extracted').length
  const rejectedCompanies = companies.filter((c) => c.reviewStatus === 'rejected').length
  const pendingEvidence = evidence.filter((e) => e.reviewStatus === 'pending').length
  const approvedEvidence = evidence.filter((e) => e.reviewStatus === 'approved').length
  const conflicts = evidence.filter((e) => e.conflict).length
  const factories = companies.filter((c) => c.entityType === 'factory').length

  const provinceSet = new Map<string, Set<string>>()
  const citySet = new Map<string, Set<string>>()
  for (const c of companies) {
    for (const l of c.locations) {
      if (l.province) {
        if (!provinceSet.has(l.province)) provinceSet.set(l.province, new Set())
        provinceSet.get(l.province)!.add(c.id)
      }
      const cityKey = l.city ? `${l.province ?? '—'} / ${l.city}` : null
      if (cityKey) {
        if (!citySet.has(cityKey)) citySet.set(cityKey, new Set())
        citySet.get(cityKey)!.add(c.id)
      }
    }
  }
  const provinceCounts = [...provinceSet.entries()].map(([p, set]) => ({ label: p, value: set.size })).sort((a, b) => b.value - a.value)
  const cityCounts = [...citySet.entries()].map(([k, set]) => ({ label: k, value: set.size })).sort((a, b) => b.value - a.value).slice(0, 8)

  /* ---------- دونات‌ها ---------- */
  const ownershipRaw = countBy(companies.map((c) => c.ownershipType))
  const ownershipSegments: DonutSegment[] = [
    { label: OWNERSHIP_FA.state, value: ownershipRaw.state ?? 0, color: COLORS.navy },
    { label: OWNERSHIP_FA.semi_state, value: ownershipRaw.semi_state ?? 0, color: COLORS.steel },
    { label: OWNERSHIP_FA.private, value: ownershipRaw.private ?? 0, color: COLORS.gold },
    { label: OWNERSHIP_FA.unknown, value: ownershipRaw.unknown ?? 0, color: COLORS.gray },
  ]

  const activityRaw = countBy(companies.map((c) => c.activityStatus))
  const activitySegments: DonutSegment[] = [
    { label: ACTIVITY_FA.active, value: activityRaw.active ?? 0, color: COLORS.green },
    { label: ACTIVITY_FA.semi_active, value: activityRaw.semi_active ?? 0, color: COLORS.gold },
    { label: ACTIVITY_FA.inactive, value: activityRaw.inactive ?? 0, color: COLORS.red },
    { label: ACTIVITY_FA.unknown, value: activityRaw.unknown ?? 0, color: COLORS.gray },
  ]

  const reviewSegments: DonutSegment[] = [
    { label: REVIEW_FA.human_verified, value: humanVerified, color: COLORS.green },
    { label: REVIEW_FA.ai_extracted, value: aiExtracted, color: COLORS.steel },
    { label: REVIEW_FA.rejected, value: rejectedCompanies, color: COLORS.red },
  ]

  const confidenceValues = evidence.map((e) => e.confidence)
  const avgConfidence = confidenceValues.length ? Math.round(confidenceValues.reduce((s, x) => s + x, 0) / confidenceValues.length) : 0
  const confHigh = confidenceValues.filter((v) => v >= 70).length
  const confMid = confidenceValues.filter((v) => v >= 40 && v < 70).length
  const confLow = confidenceValues.filter((v) => v < 40).length
  const confidenceSegments: DonutSegment[] = [
    { label: 'اطمینان بالا (۷۰+)', value: confHigh, color: COLORS.green },
    { label: 'اطمینان متوسط (۴۰ تا ۶۹)', value: confMid, color: COLORS.gold },
    { label: 'اطمینان پایین (کمتر از ۴۰)', value: confLow, color: COLORS.red },
  ]

  /* ---------- پوشش ستون‌های قالب خروجی (kolfile) ---------- */
  const filledAffiliation = companies.filter((c) => (c.affiliationName ?? '').trim() !== '').length
  const filledStatus = companies.filter((c) => c.activityStatus !== 'unknown').length
  const filledGoods = companies.filter((c) => (c.activityDescription ?? '').trim() !== '').length
  const filledEmdad = companies.filter((c) => c.cooperationRecords.length > 0 || evidence.some((e) => e.companyId === c.id && e.fieldName === 'emdad_cooperation')).length
  const filledCeo = companies.filter((c) => c.officers.length > 0).length
  const filledPhone = companies.filter((c) => c.contacts.length > 0).length
  const filledAddress = companies.filter((c) => c.locations.some((l) => (l.address ?? '').trim() !== '')).length
  const filledProvince = provinceSet.size > 0 ? companies.filter((c) => c.locations.some((l) => l.province)).length : 0

  const templateCoverage = [
    { col: 'نام شرکت (ستون ۳)', filled: total, note: 'برای هر رکورد الزامی است' },
    { col: 'استان (ستون ۲)', filled: filledProvince, note: 'از محل فعالیت مستندشده' },
    { col: 'مدیرعامل (ستون ۸)', filled: filledCeo, note: 'شامل مدیرعامل یا رئیس هیئت‌مدیره' },
    { col: 'وضعیت فعالیت (ستون ۵)', filled: filledStatus, note: 'غیر از «نامشخص»' },
    { col: 'کالا / خدمات (ستون ۶)', filled: filledGoods, note: 'شرح زمینه فعالیت' },
    { col: 'آدرس (ستون ۱۰)', filled: filledAddress, note: 'آدرس دفتر مرکزی یا کارخانه' },
    { col: 'شماره تماس (ستون ۹)', filled: filledPhone, note: 'تلفن ثابت یا همراه' },
    { col: 'وابسته به (ستون ۴)', filled: filledAffiliation, note: 'وزارت / هلدینگ / سازمان مادر' },
    { col: 'سابقه کمیته امداد (ستون ۷)', filled: filledEmdad, note: 'بدون سابقه مستند = نامشخص' },
  ]

  /* ---------- منابع ---------- */
  const domainCounts = countBy(
    sources.map((s) => {
      try {
        return new URL(s.url).hostname.replace(/^www\./, '')
      } catch {
        return 'نامعتبر'
      }
    }),
  )
  const topDomains = Object.entries(domainCounts)
    .map(([d, v]) => ({ label: d, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
  const sourceTypeRaw = countBy(sources.map((s) => s.sourceType))
  const unreachable = sources.filter((s) => s.accessStatus !== 'ok').length

  const latest = companies.slice(0, 10)

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-12">
      {/* سربرگ سرمه‌ای سازمانی */}
      <header className="border-b-[3px] border-amber-600 bg-[#1e2f4d] text-white shadow-md">
        <div className="container mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-amber-600/60">
              <BarChart3 className="size-6 text-amber-500" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-6 sm:text-lg">داشبورد تحلیلی خروجی‌های سامانه</h1>
              <p className="text-xs text-white/70 sm:text-sm">
                بانک اطلاعات شرکت‌ها و کارخانه‌های ایران — محاسبه‌شده از داده‌های مستند پایگاه دانش • {faDateTime(new Date())}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/export?scope=all"
              className="inline-flex items-center gap-2 rounded-md border border-amber-600/70 bg-amber-600/15 px-3 py-2 text-xs font-medium text-amber-100 transition-colors hover:border-amber-500 hover:bg-amber-600/25 hover:text-white"
            >
              <FileSpreadsheet className="size-4" aria-hidden="true" />
              خروجی کامل اکسل (۴ شیت)
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-white/30 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/10"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              پنل مدیریت
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl space-y-5 px-4 pt-6">
        {total === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-600/30 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              هنوز هیچ مجموعه‌ای ثبت نشده است. برای شروع، از <Link href="/" className="font-bold underline">پنل مدیریت</Link> یک اجرای جدید
              (انتخاب استان و شهر) بسازید تا ایجنت پس از جست‌وجوی وب، شرکت‌ها را با سند و شواهد ثبت کند.
            </div>
          </div>
        ) : null}

        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={<Building2 className="size-5" />} label="مجموع مجموعه‌های ثبت‌شده" value={total} sub={`${faNum(factories)} کارخانه / ${faNum(total - factories)} شرکت و سایر`} tone="navy" />
          <StatCard icon={<ShieldCheck className="size-5" />} label="تأییدشده توسط کارشناس" value={humanVerified} sub={`${faNum(aiExtracted)} در انتظار بازبینی انسانی`} tone="green" />
          <StatCard icon={<Database className="size-5" />} label="شواهد میدانی مستند" value={evidence.length} sub={`${faNum(approvedEvidence)} تأییدشده • ${faNum(pendingEvidence)} در انتظار`} tone="gold" />
          <StatCard icon={<Globe className="size-5" />} label="منابع وب استنادشده" value={sources.length} sub={`${faNum(topDomains.length)} دامنه متمایز • ${faNum(unreachable)} غیرقابل دسترس`} tone="navy" />
          <StatCard icon={<MapPin className="size-5" />} label="پوشش استانی" value={`${faNum(provinceCounts.length)} از ۳۱`} sub="استان‌های دارای رکورد مستند" tone="gold" />
          <StatCard icon={<AlertTriangle className="size-5" />} label="تعارض‌های شناسایی‌شده" value={conflicts} sub={`${faNum(auditCount)} رخداد در تاریخ تغییرات`} tone={conflicts > 0 ? 'red' : 'slate'} />
        </div>

        {/* دونات‌ها */}
        <div className="grid gap-5 lg:grid-cols-3">
          <SectionCard title="ترکیب مالکیت" desc="طبقه‌بندی دولتی / نیمه‌دولتی / خصوصی — موارد بدون مدرک، «نامشخص» می‌مانند">
            <Donut segments={ownershipSegments} centerValue={faNum(total)} centerLabel="مجموعه" />
          </SectionCard>
          <SectionCard title="وضعیت فعالیت" desc="بر پایه آخرین مدرک قابل استناد هر مجموعه">
            <Donut segments={activitySegments} centerValue={faNum(total)} centerLabel="مجموعه" />
          </SectionCard>
          <SectionCard title="وضعیت بازبینی انسانی" desc="هر رکورد پیش از ورود به خروجی نهایی باید بازبینی شود">
            <Donut segments={reviewSegments} centerValue={faNum(total)} centerLabel="مجموعه" />
          </SectionCard>
        </div>

        {/* پوشش ستون‌های قالب + اطمینان */}
        <div className="grid gap-5 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="پوشش ستون‌های قالب خروجی اکسل"
            desc="درصد مجموعه‌هایی که برای هر ستون قالب «فهرست اسامی شرکت‌های دولتی و خصوصی شاخص» مدرک معتبر دارند؛ ستون‌های بدون مدرک در خروجی «نامشخص» ثبت می‌شوند (اصل عدم حدس)."
          >
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {templateCoverage.map((row) => (
                <HBar
                  key={row.col}
                  label={row.col}
                  value={row.filled}
                  total={total}
                  color={row.filled === 0 ? COLORS.gray : row.filled === total ? COLORS.green : COLORS.gold}
                  valueText={`${faPercent(total ? Math.round((row.filled / total) * 100) : 0)} (${faNum(row.filled)} از ${faNum(total)})`}
                />
              ))}
            </div>
          </SectionCard>
          <div className="space-y-5">
            <SectionCard title="توزیع اطمینان شواهد" desc={`میانگین اطمینان: ${faNum(avgConfidence)} از ۱۰۰`}>
              <Donut segments={confidenceSegments} centerValue={faNum(avgConfidence)} centerLabel="میانگین اطمینان" size={140} />
            </SectionCard>
            <SectionCard title="نوع منابع" desc="طبقه‌بندی منابع استنادشده توسط ایجنت">
              <div className="flex flex-wrap gap-2">
                {Object.entries(SOURCE_TYPE_FA).map(([k, fa]) =>
                  sourceTypeRaw[k] ? <Chip key={k} label={`${fa}: ${faNum(sourceTypeRaw[k])}`} tone={k === 'official' ? 'gold' : 'blue'} /> : null,
                )}
                {!sources.length ? <span className="text-xs text-slate-400">منبعی ثبت نشده است.</span> : null}
              </div>
            </SectionCard>
          </div>
        </div>

        {/* توزیع جغرافیایی + دامنه‌ها */}
        <div className="grid gap-5 lg:grid-cols-3">
          <SectionCard className="lg:col-span-2" title="توزیع جغرافیایی مجموعه‌ها" desc="شمار مجموعه‌های مستند به تفکیک استان و شهر — هدف‌گذاری سامانه، پوشش هر ۳۱ استان است">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500">به تفکیک استان</h3>
                {provinceCounts.length ? (
                  provinceCounts.map((p) => <HBar key={p.label} label={p.label} value={p.value} total={total} color={COLORS.navy} />)
                ) : (
                  <p className="text-xs text-slate-400">محلی ثبت نشده است.</p>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500">به تفکیک شهر (۸ مورد نخست)</h3>
                {cityCounts.length ? (
                  cityCounts.map((p) => <HBar key={p.label} label={p.label} value={p.value} total={total} color={COLORS.steel} />)
                ) : (
                  <p className="text-xs text-slate-400">شهری ثبت نشده است.</p>
                )}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="دامنه‌های پراستناد" desc="منابعی که بیشترین شواهد از آن‌ها استخراج شده است">
            {topDomains.length ? (
              <div className="space-y-3">
                {topDomains.map((d) => (
                  <HBar key={d.label} label={d.label} value={d.value} total={sources.length} color={COLORS.gold} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">منبعی ثبت نشده است.</p>
            )}
          </SectionCard>
        </div>

        {/* جدول آخرین مجموعه‌ها */}
        <SectionCard title="آخرین مجموعه‌های ثبت‌شده" desc="۱۰ رکورد اخیر به ترتیب زمان ثبت — جزئیات و شواهد هر رکورد در پنل مدیریت قابل بررسی است">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 pl-2 font-medium">#</th>
                  <th className="pb-2 px-2 font-medium">نام مجموعه</th>
                  <th className="pb-2 px-2 font-medium">استان / شهر</th>
                  <th className="pb-2 px-2 font-medium">مالکیت</th>
                  <th className="pb-2 px-2 font-medium">فعالیت</th>
                  <th className="pb-2 px-2 font-medium">مدیرعامل</th>
                  <th className="pb-2 px-2 font-medium">شواهد</th>
                  <th className="pb-2 pr-2 font-medium">بازبینی</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((c, i) => {
                  const loc = c.locations[0]
                  const ceo = c.officers.find((o) => o.role === 'ceo') ?? c.officers[0]
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pl-2 text-slate-400">{faNum(i + 1)}</td>
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-[#1e2f4d]">{c.officialName}</div>
                        {c.affiliationName ? <div className="text-[11px] text-slate-400">وابسته به {c.affiliationName}</div> : null}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">{loc ? `${loc.province ?? 'نامشخص'} / ${loc.city ?? 'نامشخص'}` : 'نامشخص'}</td>
                      <td className="py-2.5 px-2">
                        <Chip
                          label={OWNERSHIP_FA[c.ownershipType] ?? c.ownershipType}
                          tone={c.ownershipType === 'state' ? 'blue' : c.ownershipType === 'private' ? 'gold' : 'gray'}
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <Chip
                          label={ACTIVITY_FA[c.activityStatus] ?? c.activityStatus}
                          tone={c.activityStatus === 'active' ? 'green' : c.activityStatus === 'inactive' ? 'red' : 'gray'}
                        />
                      </td>
                      <td className="py-2.5 px-2 text-slate-700">
                        {ceo ? (
                          <div>
                            <div>{ceo.personName}</div>
                            <div className="text-[10px] text-slate-400">{OFFICER_ROLE_FA[ceo.role] ?? ceo.role}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">نامشخص</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-[#1e2f4d]">{faNum(c._count.evidence)}</td>
                      <td className="py-2.5 pr-2">
                        <Chip
                          label={REVIEW_FA[c.reviewStatus] ?? c.reviewStatus}
                          tone={c.reviewStatus === 'human_verified' ? 'green' : c.reviewStatus === 'rejected' ? 'red' : 'blue'}
                        />
                      </td>
                    </tr>
                  )
                })}
                {!latest.length ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      رکوردی ثبت نشده است.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* اجراهای اخیر */}
        <SectionCard title="آخرین اجراهای ایجنت کشف" desc="وضعیت اجراهای جست‌وجوی هوشمند — راه‌اندازی اجرای جدید از پنل مدیریت انجام می‌شود">
          {jobs.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {jobs.map((j) => {
                const pct = j.progressTotal > 0 ? Math.round((j.progressDone / j.progressTotal) * 100) : 0
                return (
                  <div key={j.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-[#1e2f4d]">{j.name ?? 'اجرای بدون نام'}</span>
                      <Chip
                        label={JOB_STATUS_FA[j.status] ?? j.status}
                        tone={j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : j.status === 'running' ? 'gold' : 'gray'}
                      />
                    </div>
                    <div className="mb-1 text-[11px] text-slate-500">
                      مرحله: {j.currentStage ? (STAGE_FA[j.currentStage] ?? j.currentStage) : '—'} • درخواست‌ها: {faNum(j.requestsMade)} از {faNum(j.maxRequests)}
                    </div>
                    <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#1e2f4d]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>پیشرفت: {faNum(j.progressDone)}/{faNum(j.progressTotal)}</span>
                      <span>منابع بررسی‌شده: {faNum(j.statsSourcesChecked)}</span>
                      <span className="font-bold text-emerald-700">مجموعه جدید: {faNum(j.statsNewCompanies)}</span>
                      {j.statsErrors > 0 ? <span className="text-rose-600">خطا: {faNum(j.statsErrors)}</span> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400">هنوز اجرایی ثبت نشده است.</p>
          )}
        </SectionCard>

        <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-2">
            <ClipboardList className="size-4 text-slate-400" aria-hidden="true" />
            همه آمارها به‌صورت زنده از پایگاه داده محلی محاسبه می‌شوند و تنها داده‌های دارای سند و منبع را شامل می‌گردند.
          </span>
          <span>تولیدشده توسط سامانه هوشمند بانک اطلاعات شرکت‌ها و کارخانه‌های ایران</span>
        </footer>
      </div>
    </main>
  )
}
