'use client'

import { useState } from 'react'
import { FilterX, Search, ChevronRight, ChevronLeft, MousePointerClick } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useApi } from '@/hooks/use-api'
import { faDate, faDigits, faNum } from '@/lib/fa-utils'
import type { CompaniesQuery, CompaniesResponse, RegionsResponse } from '@/lib/admin-types'
import {
  ActivityBadge,
  ConfidenceCell,
  NeedsReviewBadge,
  OwnershipBadge,
  ReviewBadge,
} from '@/components/admin/status-badges'
import { XCircle } from 'lucide-react'

const PAGE_SIZE = 20

interface CompaniesTabProps {
  onOpenDetail: (id: string) => void
}

interface FilterDraft {
  q: string
  province: string
  city: string
  ownership: string
  status: string
  review: string
  needsReview: boolean
}

const EMPTY_FILTER: FilterDraft = {
  q: '',
  province: 'all',
  city: '',
  ownership: 'all',
  status: 'all',
  review: 'all',
  needsReview: false,
}

/** زبانه شرکت‌ها — فیلتر، جدول، صفحه‌بندی و باز کردن جزئیات */
export function CompaniesTab({ onOpenDetail }: CompaniesTabProps) {
  const { data: regions } = useApi<RegionsResponse>('/api/regions')

  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTER)
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTER)
  const [page, setPage] = useState(1)

  const query: CompaniesQuery = {
    q: applied.q || undefined,
    province: applied.province !== 'all' ? applied.province : undefined,
    city: applied.city || undefined,
    ownership: applied.ownership !== 'all' ? applied.ownership : undefined,
    status: applied.status !== 'all' ? applied.status : undefined,
    review: applied.review !== 'all' ? applied.review : undefined,
    needsReview: applied.needsReview ? 'true' : undefined,
    page,
    pageSize: PAGE_SIZE,
  }

  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const url = `/api/companies?${params.toString()}`

  const { data, loading, error } = useApi<CompaniesResponse>(url, [url])

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const setD = (patch: Partial<FilterDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const applyFilters = () => {
    setPage(1)
    setApplied({ ...draft })
  }

  const resetFilters = () => {
    setDraft(EMPTY_FILTER)
    setApplied(EMPTY_FILTER)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* نوار فیلتر */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-q">جست‌وجو</Label>
              <div className="relative">
                <Search
                  className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="f-q"
                  value={draft.q}
                  onChange={(e) => setD({ q: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="نام شرکت…"
                  className="pr-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>استان</Label>
              <Select value={draft.province} onValueChange={(v) => setD({ province: v })} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه استان‌ها</SelectItem>
                  {(regions?.provinces ?? []).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-city">شهر</Label>
              <Input id="f-city" value={draft.city} onChange={(e) => setD({ city: e.target.value })} placeholder="مثلاً: یزد" />
            </div>
            <div className="space-y-1.5">
              <Label>نوع مالکیت</Label>
              <Select value={draft.ownership} onValueChange={(v) => setD({ ownership: v })} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="state">دولتی</SelectItem>
                  <SelectItem value="semi_state">نیمه‌دولتی</SelectItem>
                  <SelectItem value="private">خصوصی</SelectItem>
                  <SelectItem value="unknown">نامشخص</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>وضعیت فعالیت</Label>
              <Select value={draft.status} onValueChange={(v) => setD({ status: v })} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="semi_active">نیمه‌فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                  <SelectItem value="unknown">نامشخص</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>وضعیت بررسی</Label>
              <Select value={draft.review} onValueChange={(v) => setD({ review: v })} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="human_verified">تأییدشده انسانی</SelectItem>
                  <SelectItem value="ai_extracted">استخراج هوشمند</SelectItem>
                  <SelectItem value="rejected">ردشده</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch
                id="f-needs-review"
                checked={draft.needsReview}
                onCheckedChange={(v) => setD({ needsReview: v })}
                aria-label="فقط نیازمند بررسی"
              />
              <Label htmlFor="f-needs-review" className="cursor-pointer text-sm">
                فقط نیازمند بررسی
              </Label>
            </div>
            <div className="flex items-end gap-2">
              <Button className="bg-[#1e2f4d] text-white hover:bg-[#2a4066]" onClick={applyFilters}>
                اعمال فیلتر
              </Button>
              <Button variant="outline" onClick={resetFilters}>
                <FilterX className="size-4" aria-hidden="true" />
                بازنشانی
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <XCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* جدول نتایج */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <MousePointerClick className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium text-[#1e2f4d]">شرکتی مطابق فیلترها یافت نشد</p>
              <p className="text-sm text-muted-foreground">
                فیلترها را تغییر دهید یا با «اجرای جدید» داده‌های تازه کشف کنید.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="gov-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>نام شرکت</TableHead>
                      <TableHead>استان، شهر</TableHead>
                      <TableHead>مالکیت</TableHead>
                      <TableHead>وضعیت فعالیت</TableHead>
                      <TableHead>مدیرعامل</TableHead>
                      <TableHead>اطمینان</TableHead>
                      <TableHead>شواهد</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>آخرین بررسی</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((c) => (
                      <TableRow
                        key={c.id}
                        data-clickable="true"
                        onClick={() => onOpenDetail(c.id)}
                        className="cursor-pointer"
                        aria-label={`مشاهده جزئیات ${c.officialName}`}
                      >
                        <TableCell className="font-medium text-[#1e2f4d]">
                          {c.officialName}
                          {c.affiliationName && (
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              وابسته به: {c.affiliationName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{[c.province, c.city].filter(Boolean).join('، ') || '—'}</TableCell>
                        <TableCell>
                          <OwnershipBadge value={c.ownershipType} />
                        </TableCell>
                        <TableCell>
                          <ActivityBadge value={c.activityStatus} />
                        </TableCell>
                        <TableCell>{c.ceoName || '—'}</TableCell>
                        <TableCell>
                          <ConfidenceCell value={c.confidence} evidenceCount={c.evidenceCount} />
                        </TableCell>
                        <TableCell>{c.evidenceCount > 0 ? faDigits(c.evidenceCount) : '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <ReviewBadge value={c.reviewStatus} />
                            {c.needsReview && (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <NeedsReviewBadge />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent dir="rtl" className="max-w-64 text-xs">
                                    {c.reviewReason || 'این رکورد نیازمند بررسی انسانی است'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {faDate(c.lastCheckedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* صفحه‌بندی */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm">
                <span className="text-muted-foreground">
                  مجموع: {faNum(total)} شرکت — صفحه {faNum(page)} از {faNum(totalPages)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="صفحه قبل"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                    قبلی
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="صفحه بعد"
                  >
                    بعدی
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
