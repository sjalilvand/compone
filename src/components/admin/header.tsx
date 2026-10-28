'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Building2, Download, FileSpreadsheet, RefreshCw, MapPinned } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ExportDialog } from '@/components/admin/export-dialog'
import type { RegionsResponse } from '@/lib/admin-types'

interface AdminHeaderProps {
  runningJobs: number
  onSwitchTab: (tab: string) => void
  onRefresh: () => void
  regions: RegionsResponse | null
}

/** سربرگ سرمه‌ای سازمانی با نوار طلایی */
export function AdminHeader({ runningJobs, onSwitchTab, onRefresh, regions }: AdminHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false)

  const downloadFull = () => {
    const a = document.createElement('a')
    a.href = '/api/export?scope=all'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <header
      className="sticky top-0 z-40 border-b-[3px] border-amber-600 bg-[#1e2f4d] text-white shadow-md"
      role="banner"
    >
      <div className="container mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-4">
        {/* بخش راست: نشان و عنوان */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-amber-600/60">
            <Building2 className="size-6 text-amber-500" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-6 sm:text-lg">
              بانک اطلاعات شرکت‌ها و کارخانه‌های ایران
            </h1>
            <p className="truncate text-xs text-white/70 sm:text-sm">
              پنل مدیریت سامانه هوشمند شناسایی شرکت‌ها و کارخانه‌ها
            </p>
          </div>
        </div>

        {/* بخش چپ: ابزارها */}
        <div className="flex items-center gap-2">
          {/* پیوند به داشبورد تحلیلی */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-white/30 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
            aria-label="مشاهده داشبورد تحلیلی خروجی‌ها"
          >
            <BarChart3 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">داشبورد تحلیلی</span>
          </Link>

          {/* نشانگر کارهای در حال اجرا */}
          {runningJobs > 0 && (
            <button
              type="button"
              onClick={() => onSwitchTab('jobs')}
              className="flex items-center gap-2 rounded-md border border-amber-600/70 bg-amber-600/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-600/25"
              aria-label={`فعلاً ${runningJobs} کار در حال اجراست — مشاهده اجراها`}
            >
              <span className="gov-pulse inline-block size-2 rounded-full bg-amber-400" aria-hidden="true" />
              {runningJobs.toLocaleString('fa-IR')} کار در حال اجرا
            </button>
          )}

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRefresh}
                  aria-label="بازخوانی داده‌ها"
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent dir="rtl">بازخوانی داده‌ها</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-600/70 bg-amber-600/15 text-amber-100 hover:border-amber-500 hover:bg-amber-600/25 hover:text-white"
                aria-label="منوی خروجی اکسل"
              >
                <Download className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">خروجی اکسل</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                دانلود فایل اکسل (۴ شیت)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={downloadFull} className="cursor-pointer">
                <FileSpreadsheet className="size-4 text-amber-600" aria-hidden="true" />
                خروجی کامل (۴ شیت)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExportOpen(true)} className="cursor-pointer">
                <MapPinned className="size-4 text-amber-600" aria-hidden="true" />
                خروجی استانی…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} regions={regions} />
    </header>
  )
}
