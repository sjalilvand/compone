'use client'

import {
  Building2,
  ShieldCheck,
  Sparkles,
  ClipboardCheck,
  AlertTriangle,
  PlayCircle,
  Map,
  Clock,
  Plus,
  Download,
  Compass,
  SearchCheck,
  ListChecks,
  Database,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useApi } from '@/hooks/use-api'
import { faDate, faNum } from '@/lib/fa-utils'
import type { StatsResponse } from '@/lib/admin-types'

interface DashboardTabProps {
  onNewJob: () => void
  onDownloadExport: () => void
}

function StatCard({
  icon: Icon,
  title,
  value,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: number
  tone: 'navy' | 'emerald' | 'amber' | 'red' | 'slate'
  loading: boolean
}) {
  const tones: Record<string, string> = {
    navy: 'bg-[#1e2f4d] text-white',
    emerald: 'bg-emerald-700 text-white',
    amber: 'bg-amber-600 text-white',
    red: 'bg-red-700 text-white',
    slate: 'bg-slate-600 text-white',
  }
  return (
    <Card className="border shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-16" />
          ) : (
            <p className="text-2xl font-bold text-[#1e2f4d]">{faNum(value)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** زبانه داشبورد — نمای کلی آمار سامانه */
export function DashboardTab({ onNewJob, onDownloadExport }: DashboardTabProps) {
  const { data, loading, error } = useApi<StatsResponse>('/api/stats')

  const stats = data
  const total = stats?.companies.total ?? 0
  const maxProvinceCount = stats?.topProvinces?.[0]?.count ?? 0

  return (
    <div className="space-y-6">
      {/* کارت‌های آماری */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Building2} title="کل شرکت‌ها" value={stats?.companies.total ?? 0} tone="navy" loading={loading} />
        <StatCard icon={ShieldCheck} title="تأییدشده انسانی" value={stats?.companies.verified ?? 0} tone="emerald" loading={loading} />
        <StatCard icon={Sparkles} title="استخراج هوشمند" value={stats?.companies.aiExtracted ?? 0} tone="slate" loading={loading} />
        <StatCard icon={ClipboardCheck} title="نیازمند بررسی" value={stats?.companies.needsReview ?? 0} tone="amber" loading={loading} />
        <StatCard icon={AlertTriangle} title="تعارض منابع" value={stats?.companies.conflicts ?? 0} tone="red" loading={loading} />
        <StatCard icon={PlayCircle} title="اجراهای فعال" value={stats?.jobs.running ?? 0} tone="navy" loading={loading} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>خطا در دریافت آمار</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* حالت خالی — هنوز شرکتی ثبت نشده */}
      {!loading && total === 0 && (
        <Card className="border-amber-600/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-[#1e2f4d]">
              <Compass className="size-5 text-amber-600" aria-hidden="true" />
              بانک اطلاعات خالی است — اولین اجرای کشف را آغاز کنید
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-7 text-muted-foreground">
              ایجنت هوشمند سامانه در چهار مرحله، وب را جست‌وجو می‌کند و شرکت‌ها و کارخانه‌های واقعی را همراه
              منبع و شواهد ثبت می‌کند:
            </p>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Compass, title: '۱) برنامه‌ریزی', desc: 'تولید ۱۲ تا ۲۰ کوئری جست‌وجوی متنوع برای محدوده انتخابی' },
                { icon: SearchCheck, title: '۲) کشف', desc: 'یافتن نامزدهای واقعی شرکت/کارخانه از نتایج جست‌وجو' },
                { icon: ListChecks, title: '۳) بررسی نامزدها', desc: 'خواندن صفحات، استخراج ساخت‌یافته و ثبت منبع هر فیلد' },
                { icon: Database, title: '۴) ذخیره با شواهد', desc: 'ثبت مقدار + نقل‌قول + منبع + سطح اطمینان؛ موارد نامطمئن به صف بررسی می‌رود' },
              ].map((s) => (
                <li key={s.title} className="rounded-lg border bg-[#f0f3f8] p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <s.icon className="size-4 text-amber-700" aria-hidden="true" />
                    <span className="text-sm font-semibold text-[#1e2f4d]">{s.title}</span>
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">{s.desc}</p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={onNewJob} className="bg-[#1e2f4d] text-white hover:bg-[#2a4066]">
                <Plus className="size-4" aria-hidden="true" />
                اجرای جدید
              </Button>
              <Button variant="outline" onClick={onDownloadExport}>
                <Download className="size-4" aria-hidden="true" />
                دانلود خروجی اکسل
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* پوشش استانی و آخرین به‌روزرسانی */}
      {!loading && total > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#1e2f4d]">
                <Map className="size-5 text-amber-600" aria-hidden="true" />
                بیشترین پوشش استانی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-2">
              {(stats?.topProvinces ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">هنوز داده‌ای برای نمایش پوشش استانی ثبت نشده است.</p>
              )}
              {(stats?.topProvinces ?? []).map((p) => (
                <div key={p.province}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1e2f4d]">{p.province}</span>
                    <span className="text-muted-foreground">{faNum(p.count)} شرکت</span>
                  </div>
                  <Progress
                    value={maxProvinceCount > 0 ? Math.round((p.count / maxProvinceCount) * 100) : 0}
                    aria-label={`پوشش استان ${p.province}`}
                    className="h-2.5"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-[#1e2f4d]">
                <Clock className="size-5 text-amber-600" aria-hidden="true" />
                آخرین به‌روزرسانی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-2">
              <p className="text-sm leading-7 text-muted-foreground">
                {stats?.lastCheckedAt
                  ? `آخرین بررسی منابع: ${faDate(stats.lastCheckedAt)}`
                  : 'هنوز هیچ منبعی بررسی نشده است.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={onNewJob} className="bg-[#1e2f4d] text-white hover:bg-[#2a4066]">
                  <Plus className="size-4" aria-hidden="true" />
                  اجرای جدید
                </Button>
                <Button size="sm" variant="outline" onClick={onDownloadExport}>
                  <Download className="size-4" aria-hidden="true" />
                  دانلود خروجی
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
