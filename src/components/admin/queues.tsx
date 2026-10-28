'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  Inbox,
  Merge,
  ShieldQuestion,
  Table2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useApi, apiRequest } from '@/hooks/use-api'
import { faDigits, faNum, fieldFa } from '@/lib/fa-utils'
import type {
  ConflictQueueItem,
  DuplicateQueueGroup,
  MissingQueueItem,
  QueueResponse,
  UncertainQueueItem,
} from '@/lib/admin-types'
import {
  ActivityBadge,
  ConfidenceCell,
  NeedsReviewBadge,
  OwnershipBadge,
  ReviewBadge,
} from '@/components/admin/status-badges'
import { XCircle } from 'lucide-react'

type SubQueue = 'uncertain' | 'conflict' | 'duplicates' | 'missing'

interface QueuesTabProps {
  onOpenDetail: (id: string) => void
}

/** زبانه صف بررسی — چهار صف: نامطمئن‌ها، تعارض منابع، تکراری‌ها، فیلدهای فاقد اطلاعات */
export function QueuesTab({ onOpenDetail }: QueuesTabProps) {
  const [sub, setSub] = useState<SubQueue>('uncertain')
  const { data, loading, error, refetch } = useApi<QueueResponse>(`/api/queues?type=${sub}`, [sub])

  return (
    <Tabs value={sub} onValueChange={(v) => setSub(v as SubQueue)} dir="rtl" className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <TabsList className="h-auto w-fit min-w-full justify-start sm:min-w-0">
          <TabsTrigger value="uncertain" className="gap-1.5">
            <ShieldQuestion className="size-4" aria-hidden="true" />
            نامطمئن‌ها
          </TabsTrigger>
          <TabsTrigger value="conflict" className="gap-1.5">
            <AlertTriangle className="size-4" aria-hidden="true" />
            تعارض منابع
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-1.5">
            <Copy className="size-4" aria-hidden="true" />
            تکراری‌های احتمالی
          </TabsTrigger>
          <TabsTrigger value="missing" className="gap-1.5">
            <Inbox className="size-4" aria-hidden="true" />
            فیلدهای فاقد اطلاعات
          </TabsTrigger>
        </TabsList>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* نامطمئن‌ها */}
      <TabsContent value="uncertain" className="space-y-3">
        {loading ? (
          <QueueSkeleton />
        ) : data?.type === 'uncertain' ? (
          <UncertainList items={data.items} onOpenDetail={onOpenDetail} onChanged={refetch} />
        ) : null}
      </TabsContent>

      {/* تعارض منابع */}
      <TabsContent value="conflict" className="space-y-3">
        {loading ? (
          <QueueSkeleton />
        ) : data?.type === 'conflict' ? (
          <ConflictList items={data.items} onOpenDetail={onOpenDetail} onChanged={refetch} />
        ) : null}
      </TabsContent>

      {/* تکراری‌ها */}
      <TabsContent value="duplicates" className="space-y-3">
        {loading ? (
          <QueueSkeleton />
        ) : data?.type === 'duplicates' ? (
          <DuplicatesList groups={data.items} onChanged={refetch} />
        ) : null}
      </TabsContent>

      {/* فیلدهای فاقد اطلاعات */}
      <TabsContent value="missing" className="space-y-3">
        {loading ? (
          <QueueSkeleton />
        ) : data?.type === 'missing' ? (
          <MissingList items={data.items} onOpenDetail={onOpenDetail} />
        ) : null}
      </TabsContent>
    </Tabs>
  )
}

function QueueSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyQueue({ text }: { text: string }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
        <Inbox className="size-8 text-emerald-700" aria-hidden="true" />
        <p className="font-medium text-[#1e2f4d]">{text}</p>
        <p className="text-sm text-muted-foreground">همه موارد این صف بررسی و پاک‌سازی شده‌اند.</p>
      </CardContent>
    </Card>
  )
}

/* ---------------- نامطمئن‌ها ---------------- */

function UncertainList({
  items,
  onOpenDetail,
  onChanged,
}: {
  items: UncertainQueueItem[]
  onOpenDetail: (id: string) => void
  onChanged: () => void
}) {
  if (items.length === 0) return <EmptyQueue text="صف نامطمئن‌ها خالی است" />
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="gov-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>نام شرکت</TableHead>
                <TableHead>استان، شهر</TableHead>
                <TableHead>مالکیت</TableHead>
                <TableHead>وضعیت فعالیت</TableHead>
                <TableHead>وضعیت بررسی</TableHead>
                <TableHead>دلیل نیاز به بررسی</TableHead>
                <TableHead>اطمینان</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-[#1e2f4d]">{c.officialName}</TableCell>
                  <TableCell>{[c.province, c.city].filter(Boolean).join('، ') || '—'}</TableCell>
                  <TableCell>
                    <OwnershipBadge value={c.ownershipType} />
                  </TableCell>
                  <TableCell>
                    <ActivityBadge value={c.activityStatus} />
                  </TableCell>
                  <TableCell>
                    <ReviewBadge value={c.reviewStatus} />
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-xs leading-6 text-amber-900">
                    {c.reviewReason || '—'}
                  </TableCell>
                  <TableCell>
                    <ConfidenceCell value={c.confidence} evidenceCount={c.evidenceCount} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => onOpenDetail(c.id)}
                      aria-label={`مشاهده ${c.officialName}`}
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      مشاهده
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t p-3 text-xs text-muted-foreground">
          مجموع {faNum(items.length)} مورد در صف نامطمئن‌ها — پس از بررسی و تأیید، رکورد از این صف حذف می‌شود.
        </p>
      </CardContent>
    </Card>
  )
}

/* ---------------- تعارض منابع ---------------- */

function ConflictList({
  items,
  onOpenDetail,
  onChanged,
}: {
  items: ConflictQueueItem[]
  onOpenDetail: (id: string) => void
  onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const map = new Map<string, ConflictQueueItem[]>()
    for (const it of items) {
      const k = `${it.companyId}::${it.fieldName}`
      const arr = map.get(k) ?? []
      arr.push(it)
      map.set(k, arr)
    }
    return Array.from(map.entries())
  }, [items])

  const approveVariant = async (ev: ConflictQueueItem) => {
    setBusyId(ev.evidenceId)
    try {
      await apiRequest(`/api/companies/${ev.companyId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', evidenceId: ev.evidenceId }),
      })
      toast.success('این نسخه از مقدار تأیید شد')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت تأیید ناموفق بود')
    } finally {
      setBusyId(null)
    }
  }

  if (groups.length === 0) return <EmptyQueue text="تعارض منابعی وجود ندارد" />

  return (
    <div className="space-y-3">
      {groups.map(([key, evs]) => (
        <Card key={key} className="border shadow-sm">
          <CardHeader className="flex-row items-center justify-between gap-2 border-b bg-[#f0f3f8] py-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onOpenDetail(evs[0].companyId)}
                className="font-bold text-[#1e2f4d] underline-offset-2 hover:underline"
              >
                {evs[0].companyName}
              </button>
              <Badge variant="outline" className="border-amber-600 text-amber-800">
                فیلد: {fieldFa(evs[0].fieldName)}
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => onOpenDetail(evs[0].companyId)}
              aria-label="مشاهده شرکت"
            >
              <Eye className="size-3.5" aria-hidden="true" />
              مشاهده
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {evs.map((ev) => (
              <div key={ev.evidenceId} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1e2f4d]">
                      {ev.claimedValue || <span className="italic text-gray-400">نامشخص</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      اطمینان: {ev.confidence.toLocaleString('fa-IR')}٪
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-emerald-700 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => approveVariant(ev)}
                    disabled={busyId === ev.evidenceId}
                    aria-label="تأیید این نسخه"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    تأیید این نسخه
                  </Button>
                </div>
                {ev.quoteText && <blockquote className="evidence-quote mt-2">«{ev.quoteText}»</blockquote>}
                {ev.sourceUrl && (
                  <a
                    href={ev.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#1e2f4d] underline-offset-2 hover:underline"
                  >
                    مشاهده منبع
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ---------------- تکراری‌های احتمالی ---------------- */

function DuplicatesList({
  groups,
  onChanged,
}: {
  groups: DuplicateQueueGroup[]
  onChanged: () => void
}) {
  const [primary, setPrimary] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const mergeGroup = async (group: DuplicateQueueGroup) => {
    const key = group.key
    const targetId = primary[key] ?? group.items[0]?.id
    if (!targetId) return
    const sources = group.items.filter((i) => i.id !== targetId)
    if (sources.length === 0) {
      toast.info('در این گروه فقط یک رکورد وجود دارد')
      return
    }
    setBusyKey(key)
    try {
      for (const s of sources) {
        await apiRequest(`/api/companies/${s.id}/merge`, {
          method: 'POST',
          body: JSON.stringify({ targetId, reason: 'ادغام رکورد تکراری از صف بررسی' }),
        })
      }
      toast.success(`${faNum(sources.length)} رکورد تکراری در رکورد اصلی ادغام شد`)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ادغام ناموفق بود')
    } finally {
      setBusyKey(null)
    }
  }

  if (groups.length === 0) return <EmptyQueue text="تکراریِ احتمالی‌ای یافت نشد" />

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <Card key={g.key} className="border shadow-sm">
          <CardHeader className="border-b bg-[#f0f3f8] py-3">
            <CardTitle className="flex items-center gap-2 text-sm text-[#1e2f4d]">
              <Copy className="size-4 text-amber-600" aria-hidden="true" />
              گروه تکراری: {g.key}
              <Badge variant="outline">{faNum(g.items.length)} رکورد</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <RadioGroup
              dir="rtl"
              value={primary[g.key] ?? g.items[0]?.id ?? ''}
              onValueChange={(v) => setPrimary((p) => ({ ...p, [g.key]: v }))}
              className="gap-2"
            >
              {g.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <RadioGroupItem value={it.id} id={`${g.key}-${it.id}`} />
                  <Label htmlFor={`${g.key}-${it.id}`} className="cursor-pointer font-normal">
                    {it.officialName}
                    <span className="mr-1 text-xs text-muted-foreground">({it.province ?? 'بدون استان'})</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="mt-2 text-xs text-muted-foreground">رکورد انتخاب‌شده به‌عنوان «رکورد اصلی» حفظ می‌شود.</p>
            <Button
              size="sm"
              className="mt-3 bg-[#1e2f4d] text-white hover:bg-[#2a4066]"
              onClick={() => mergeGroup(g)}
              disabled={busyKey === g.key}
            >
              <Merge className="size-3.5" aria-hidden="true" />
              {busyKey === g.key ? 'در حال ادغام…' : 'ادغام بقیه در اصلی'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ---------------- فیلدهای فاقد اطلاعات ---------------- */

function MissingList({
  items,
  onOpenDetail,
}: {
  items: MissingQueueItem[]
  onOpenDetail: (id: string) => void
}) {
  if (items.length === 0) return <EmptyQueue text="همه فیلدهای کلیدی پر شده‌اند" />
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        فیلدهایی که در رکوردهای موجود، مقدار معتبری ندارند — برای تکمیل، شرکت‌های نمونه را بررسی کنید.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m) => (
          <Card key={m.field} className="border shadow-sm">
            <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-semibold text-[#1e2f4d]">
                <Table2 className="ml-1 inline size-4 text-amber-600" aria-hidden="true" />
                {m.fieldFa}
              </CardTitle>
              <Badge className="bg-amber-600 text-white hover:bg-amber-600">
                {faNum(m.missingCount)} رکورد
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 p-4 pt-0">
              {m.samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenDetail(s.id)}
                  className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-amber-600 hover:text-amber-800"
                >
                  {s.officialName}
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
