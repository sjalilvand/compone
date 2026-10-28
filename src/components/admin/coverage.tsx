'use client'

import { AlertTriangle, Globe2, Map, ShieldOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useApi } from '@/hooks/use-api'
import { faDate, faNum } from '@/lib/fa-utils'
import type { CoverageResponse } from '@/lib/admin-types'

/** زبانه گزارش پوشش — پوشش استانی و وضعیت منابع */
export function CoverageTab() {
  const { data, loading, error } = useApi<CoverageResponse>('/api/coverage')

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border shadow-sm">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
              <Globe2 className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">منابع بررسی‌شده</p>
              {loading ? (
                <Skeleton className="mt-1 h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-[#1e2f4d]">{faNum(data?.sourcesChecked ?? 0)}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-red-700 text-white">
              <ShieldOff className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">منابع ناموفق</p>
              {loading ? (
                <Skeleton className="mt-1 h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-[#1e2f4d]">{faNum(data?.unreachableSources ?? 0)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-[#1e2f4d]">
            <Map className="size-5 text-amber-600" aria-hidden="true" />
            پوشش استانی
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.provinces ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              هنوز داده‌ای برای نمایش پوشش استانی ثبت نشده است.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="gov-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>استان</TableHead>
                    <TableHead>شرکت‌ها</TableHead>
                    <TableHead>موارد نامطمئن</TableHead>
                    <TableHead>آخرین بررسی</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.provinces ?? []).map((p) => (
                    <TableRow key={p.province}>
                      <TableCell className="font-medium text-[#1e2f4d]">{p.province}</TableCell>
                      <TableCell>{faNum(p.companies)}</TableCell>
                      <TableCell className={p.uncertain > 0 ? 'font-semibold text-amber-700' : ''}>
                        {faNum(p.uncertain)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{faDate(p.lastChecked)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Alert className="border-amber-600 bg-[#fdf6e3]">
        <AlertTriangle className="size-4 text-amber-700" aria-hidden="true" />
        <AlertTitle className="text-[#1e2f4d]">تذکر مهم درباره پوشش</AlertTitle>
        <AlertDescription className="leading-7 text-[#44403c]">
          تا زمان وجود فهرست مرجع معتبر، ادعای پوشش ۱۰۰٪ مجاز نیست؛ اعداد فوق صرفاً نتایج منابع بررسی‌شده‌اند.
        </AlertDescription>
      </Alert>
    </div>
  )
}
