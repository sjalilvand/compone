'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FileSpreadsheet, Download } from 'lucide-react'
import type { RegionsResponse } from '@/lib/admin-types'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  regions: RegionsResponse | null
}

/** گفت‌وگوی خروجی استانی — پس از انتخاب استان، فایل اکسل دانلود می‌شود */
export function ExportDialog({ open, onOpenChange, regions }: ExportDialogProps) {
  const [province, setProvince] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const handleExport = () => {
    if (!province) {
      toast.error('ابتدا استان را انتخاب کنید')
      return
    }
    try {
      setBusy(true)
      const url = `/api/export?scope=province&province=${encodeURIComponent(province)}`
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success('درخواست دانلود خروجی استانی ارسال شد')
      onOpenChange(false)
    } catch {
      toast.error('دانلود خروجی ناموفق بود')
    } finally {
      setTimeout(() => setBusy(false), 800)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e2f4d]">
            <FileSpreadsheet className="size-5 text-amber-600" aria-hidden="true" />
            خروجی اکسل استانی
          </DialogTitle>
          <DialogDescription>
            استان موردنظر را انتخاب کنید؛ فایل اکسل چهارشیتی فقط شامل شرکت‌های همان استان دانلود می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="export-province">استان</Label>
          <Select value={province} onValueChange={setProvince} dir="rtl">
            <SelectTrigger id="export-province" className="w-full">
              <SelectValue placeholder="انتخاب استان…" />
            </SelectTrigger>
            <SelectContent>
              {(regions?.provinces ?? []).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button onClick={handleExport} disabled={busy} className="bg-[#1e2f4d] text-white hover:bg-[#2a4066]">
            <Download className="size-4" aria-hidden="true" />
            دانلود خروجی
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
