'use client'

import { useState } from 'react'
import { History, RefreshCw, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { useApi } from '@/hooks/use-api'
import { ACTOR_FA, AUDIT_ENTITY_FA, faDateTime, fieldFa } from '@/lib/fa-utils'
import type { AuditResponse } from '@/lib/admin-types'
import { cn } from '@/lib/utils'

const ENTITY_OPTIONS = ['company', 'location', 'contact', 'officer', 'evidence', 'job'] as const

const ENTITY_FA: Record<string, string> = {
  company: 'شرکت',
  location: 'محل',
  contact: 'تماس',
  officer: 'مسئول',
  evidence: 'شاهد',
  job: 'کار',
}

/** زبانه تاریخچه تغییرات — لاگ حسابرسی کل سامانه */
export function AuditLogTab() {
  const [entityType, setEntityType] = useState('all')
  const { data, loading, error, refetch } = useApi<AuditResponse>(
    `/api/audit?limit=200${entityType !== 'all' ? `&entityType=${entityType}` : ''}`,
    [entityType],
  )

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <Card className="border shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label>نوع موجودیت</Label>
            <Select value={entityType} onValueChange={setEntityType} dir="rtl">
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه موجودیت‌ها</SelectItem>
                {ENTITY_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ENTITY_FA[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={refetch} aria-label="بازخوانی تاریخچه">
            <RefreshCw className="size-4" aria-hidden="true" />
            بازخوانی
          </Button>
          <span className="mr-auto text-xs text-muted-foreground">
            ۲۰۰ تغییر آخر — به‌ترتیب زمان نزولی
          </span>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <XCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              <History className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium text-[#1e2f4d]">تغییری ثبت نشده است</p>
              <p className="text-sm text-muted-foreground">
                با شروع اجراهای ایجنت یا ویرایش رکوردها، تاریخچه در اینجا نمایش داده می‌شود.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="overflow-x-auto">
                <Table className="gov-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>زمان</TableHead>
                      <TableHead>موجودیت</TableHead>
                      <TableHead>فیلد</TableHead>
                      <TableHead>قبلی</TableHead>
                      <TableHead>جدید</TableHead>
                      <TableHead>عامل</TableHead>
                      <TableHead>دلیل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {faDateTime(a.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-[#1e2f4d]/40 text-[#1e2f4d]">
                            {AUDIT_ENTITY_FA[a.entityType] ?? a.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{fieldFa(a.fieldName)}</TableCell>
                        <TableCell className="max-w-52 whitespace-normal text-xs text-red-800">
                          {a.oldValue ? (
                            <span className="line-through">{a.oldValue}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-normal text-xs text-emerald-800">
                          {a.newValue || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              a.actor === 'agent'
                                ? 'border-slate-400 text-slate-700'
                                : a.actor === 'human'
                                  ? 'border-emerald-600 text-emerald-800'
                                  : 'border-amber-600 text-amber-800',
                            )}
                          >
                            {ACTOR_FA[a.actor] ?? a.actor}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-52 whitespace-normal text-xs text-muted-foreground">
                          {a.reason || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
