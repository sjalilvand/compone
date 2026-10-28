'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Play, Square, RotateCcw, Eye, Info, XCircle, CheckCircle2, Circle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useApi, apiRequest } from '@/hooks/use-api'
import { faDateTime, faNum, STAGE_FA } from '@/lib/fa-utils'
import type { Job, JobsResponse } from '@/lib/admin-types'
import { JobStatusBadge, jobName } from '@/components/admin/status-badges'

interface JobsTabProps {
  onRunningCountChange?: (count: number) => void
}

/** زبانه اجراها — فهرست کارها با نظرسنجی زنده هنگام اجرا */
export function JobsTab({ onRunningCountChange }: JobsTabProps) {
  const { data, loading, error, refetch } = useApi<JobsResponse>('/api/jobs')
  const [detailJob, setDetailJob] = useState<Job | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const jobs = data?.items ?? []
  const failedJobs = useMemo(() => jobs.filter((j) => j.status === 'failed'), [jobs])
  const lastFailedError = failedJobs[0]?.errors?.[failedJobs[0].errors.length - 1]?.message ?? null
  const hasActive = useMemo(
    () => jobs.some((j) => j.status === 'running' || j.status === 'stopping'),
    [jobs],
  )

  // نظرسنجی هر ۴ ثانیه فقط وقتی کاری در حال اجرا/توقف است
  useEffect(() => {
    if (hasActive) {
      pollTimer.current = setInterval(() => refetch(), 4000)
    }
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current)
        pollTimer.current = null
      }
    }
  }, [hasActive, refetch])

  // اطلاع‌رسانی تعداد کارهای در حال اجرا به سربرگ
  useEffect(() => {
    onRunningCountChange?.(jobs.filter((j) => j.status === 'running').length)
  }, [jobs, onRunningCountChange])

  // تازه‌سازی جزئیات دیالوگ هنگام polling
  useEffect(() => {
    if (detailJob) {
      const fresh = jobs.find((j) => j.id === detailJob.id)
      if (fresh && fresh.updatedAt !== detailJob.updatedAt) setDetailJob(fresh)
    }
  }, [jobs, detailJob])

  const act = async (job: Job, action: 'start' | 'stop' | 'resume') => {
    setBusyId(job.id)
    try {
      await apiRequest<{ job: Job }>(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      })
      const msgs: Record<string, string> = {
        start: `اجرای «${jobName(job)}» آغاز شد`,
        stop: `درخواست توقف «${jobName(job)}» ثبت شد`,
        resume: `ادامه اجرای «${jobName(job)}» صادر شد`,
      }
      toast.success(msgs[action])
      refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'عملیات ناموفق بود')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <XCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* هشدار کارهای ناموفق — علت آخرین شکست به‌صورت شفاف نمایش داده می‌شود */}
      {failedJobs.length > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <XCircle className="size-4 text-red-700" aria-hidden="true" />
          <AlertDescription className="text-xs leading-6 text-red-900">
            <span className="font-bold">{faNum(failedJobs.length)} کار ناموفق ثبت شده است.</span>
            {lastFailedError && <> آخرین علت: {lastFailedError}</>}
            {lastFailedError?.includes('کشف هوشمند در دسترس نیست') && (
              <span className="mt-1 block">
                راهنما: این سامانه برای کشف شرکت‌ها به اعتبارنامه سرویس Z.ai نیاز دارد. بدون آن، پنل، داشبورد و خروجی اکسل کار می‌کنند
                اما اجرای کشف جدید ممکن نیست.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Info className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium text-[#1e2f4d]">هیچ کاری تعریف نشده است</p>
              <p className="text-sm text-muted-foreground">برای شروع، از زبانه «اجرای جدید» یک کار تعریف کنید.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="gov-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>نام</TableHead>
                    <TableHead>محدوده</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>مرحله</TableHead>
                    <TableHead className="min-w-44">پیشرفت</TableHead>
                    <TableHead>آمار</TableHead>
                    <TableHead>بودجه</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium text-[#1e2f4d]">{jobName(job)}</TableCell>
                      <TableCell className="max-w-44">
                        <span className="block truncate" title={[...job.provinces, ...(job.cities.length ? [`${faNum(job.cities.length)} شهر`] : [])].join('، ')}>
                          {job.provinces.length ? job.provinces.join('، ') : '—'}
                          {job.cities.length > 0 && (
                            <span className="text-xs text-muted-foreground"> (+{faNum(job.cities.length)} شهر)</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>{job.currentStage ? STAGE_FA[job.currentStage] : '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={job.progressPercent} className="h-2 w-24" aria-label={`پیشرفت ${jobName(job)}`} />
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {faNum(job.progressPercent)}٪ ({faNum(job.progressDone)}/{faNum(job.progressTotal)})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[11px]" title="منابع بررسی‌شده">
                            منابع: {faNum(job.stats.sourcesChecked)}
                          </Badge>
                          <Badge variant="outline" className="text-[11px] text-emerald-700" title="شرکت‌های جدید">
                            جدید: {faNum(job.stats.newCompanies)}
                          </Badge>
                          <Badge variant="outline" className="text-[11px]" title="به‌روزرسانی">
                            به‌روزرسانی: {faNum(job.stats.updatedCompanies)}
                          </Badge>
                          <Badge variant="outline" className="text-[11px] text-amber-700" title="نامطمئن">
                            نامطمئن: {faNum(job.stats.uncertain)}
                          </Badge>
                          <Badge variant="outline" className="text-[11px] text-red-700" title="خطاها">
                            خطا: {faNum(job.stats.errors)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {faNum(job.requestsMade)} / {faNum(job.maxRequests)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {job.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-emerald-700 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                              onClick={() => act(job, 'start')}
                              disabled={busyId === job.id}
                              aria-label={`شروع کار ${jobName(job)}`}
                            >
                              <Play className="size-3.5" aria-hidden="true" />
                              شروع
                            </Button>
                          )}
                          {job.status === 'running' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-red-700 text-red-700 hover:bg-red-50"
                              onClick={() => act(job, 'stop')}
                              disabled={busyId === job.id}
                              aria-label={`توقف کار ${jobName(job)}`}
                            >
                              <Square className="size-3.5" aria-hidden="true" />
                              توقف
                            </Button>
                          )}
                          {job.status === 'paused' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-amber-700 text-amber-700 hover:bg-amber-50"
                              onClick={() => act(job, 'resume')}
                              disabled={busyId === job.id}
                              aria-label={`ادامه کار ${jobName(job)}`}
                            >
                              <RotateCcw className="size-3.5" aria-hidden="true" />
                              ادامه
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setDetailJob(job)}
                            aria-label={`جزئیات کار ${jobName(job)}`}
                          >
                            <Eye className="size-3.5" aria-hidden="true" />
                            جزئیات
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* گفت‌وگوی جزئیات کار */}
      <Dialog open={detailJob !== null} onOpenChange={(o) => !o && setDetailJob(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {detailJob && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#1e2f4d]">جزئیات کار: {jobName(detailJob)}</DialogTitle>
                <DialogDescription>
                  محدوده: {detailJob.provinces.join('، ') || '—'}
                  {detailJob.cities.length > 0 && ` — شهرها: ${detailJob.cities.join('، ')}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* بودجه */}
                <div className="rounded-md border bg-[#f0f3f8] p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[#1e2f4d]">بودجه درخواست‌ها</span>
                    <span className="text-muted-foreground">
                      {faNum(detailJob.requestsMade)} از {faNum(detailJob.maxRequests)} درخواست (
                      {faNum(detailJob.progressPercent)}٪ پیشرفت)
                    </span>
                  </div>
                  <Progress value={Math.min(100, Math.round((detailJob.requestsMade / Math.max(1, detailJob.maxRequests)) * 100))} className="mt-2 h-2" />
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>شروع: {faDateTime(detailJob.startedAt)}</span>
                    <span>پایان: {faDateTime(detailJob.finishedAt)}</span>
                    <span>انواع مجموعه: {detailJob.companyTypes.length ? detailJob.companyTypes.join('، ') : 'همه'}</span>
                  </div>
                </div>

                {/* کوئری‌ها */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-[#1e2f4d]">
                    کوئری‌های برنامه‌ریزی‌شده ({faNum(detailJob.queries.length)})
                  </h4>
                  {detailJob.queries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">هنوز کوئری‌ای برنامه‌ریزی نشده است.</p>
                  ) : (
                    <Accordion type="single" collapsible className="rounded-md border">
                      <AccordionItem value="queries" className="border-0">
                        <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                          نمایش فهرست کوئری‌ها
                        </AccordionTrigger>
                        <AccordionContent className="max-h-56 overflow-y-auto px-3 pb-3">
                          <ul className="space-y-1.5">
                            {detailJob.queries.map((q, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                {q.done ? (
                                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-label="انجام‌شده" />
                                ) : (
                                  <Circle className="mt-0.5 size-4 shrink-0 text-gray-400" aria-label="در انتظار" />
                                )}
                                <span dir="auto" className={q.done ? '' : 'text-muted-foreground'}>
                                  {q.q}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>

                {/* نامزدها */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-[#1e2f4d]">
                    نامزدهای کشف‌شده ({faNum(detailJob.candidates.length)})
                  </h4>
                  {detailJob.candidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">هنوز نامزدی کشف نشده است.</p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-3">
                      {detailJob.candidates.map((c, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium">{c.name}</span>
                            {c.hint && <span className="block truncate text-xs text-muted-foreground">{c.hint}</span>}
                          </div>
                          <Badge variant="outline" className={c.processed ? 'text-emerald-700' : 'text-amber-700'}>
                            {c.processed ? 'بررسی‌شده' : 'در صف'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* خطاها */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-[#1e2f4d]">
                    خطاها ({faNum(detailJob.errors.length)})
                  </h4>
                  {detailJob.errors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">خطایی ثبت نشده است.</p>
                  ) : (
                    <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-red-200 bg-red-50/50 p-3">
                      {detailJob.errors.map((e, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs leading-6">
                          <XCircle className="mt-1 size-3.5 shrink-0 text-red-700" aria-hidden="true" />
                          <span>
                            <span className="text-muted-foreground">{faDateTime(e.time)} — </span>
                            {e.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
