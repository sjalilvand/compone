'use client'

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  ChevronDown,
  Info,
  MapPin,
  Plus,
  PlayCircle,
  Save,
  X,
  Building2,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { useApi, apiRequest } from '@/hooks/use-api'
import { faNum } from '@/lib/fa-utils'
import { COMPANY_TYPE_OPTIONS } from '@/lib/fa-utils'
import type { CreateJobBody, Job, RegionsResponse } from '@/lib/admin-types'
import { cn } from '@/lib/utils'

interface NewJobTabProps {
  onCreated: () => void
}

/** زبانه اجرای جدید — فرم تعریف محدوده و پارامترهای کار کراول */
export function NewJobTab({ onCreated }: NewJobTabProps) {
  const { data: regions, loading: regionsLoading } = useApi<RegionsResponse>('/api/regions')
  const { data: health } = useApi<{ ok: boolean; message: string | null }>('/api/health/sdk')

  const [name, setName] = useState('')
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [customCity, setCustomCity] = useState('')
  const [companyTypes, setCompanyTypes] = useState<string[]>([])
  const [seedQueriesText, setSeedQueriesText] = useState('')
  const [maxRequests, setMaxRequests] = useState('200')
  const [provinceOpen, setProvinceOpen] = useState(false)
  const [provinceError, setProvinceError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'start' | 'save' | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const availableCities = useMemo(() => {
    const set = new Set<string>()
    for (const p of selectedProvinces) {
      for (const c of regions?.citiesByProvince[p] ?? []) set.add(c)
    }
    return Array.from(set)
  }, [selectedProvinces, regions])

  const toggleProvince = (p: string) => {
    setProvinceError(null)
    setSelectedProvinces((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const removeProvince = (p: string) => {
    setSelectedProvinces((prev) => prev.filter((x) => x !== p))
  }

  const toggleCity = (c: string) => {
    setSelectedCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const addCustomCity = () => {
    const v = customCity.trim()
    if (!v) return
    if (!selectedCities.includes(v)) setSelectedCities((prev) => [...prev, v])
    setCustomCity('')
  }

  const toggleCompanyType = (t: string) => {
    setCompanyTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const submit = async (start: boolean) => {
    if (selectedProvinces.length === 0) {
      setProvinceError('انتخاب حداقل یک استان الزامی است')
      toast.error('انتخاب حداقل یک استان الزامی است')
      nameInputRef.current?.focus()
      return
    }
    setProvinceError(null)
    setBusy(start ? 'start' : 'save')
    try {
      const body: CreateJobBody = {
        name: name.trim() || undefined,
        provinces: selectedProvinces,
        cities: selectedCities.length ? selectedCities : undefined,
        companyTypes: companyTypes.length ? companyTypes : undefined,
        seedQueries: seedQueriesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        maxRequests: Math.max(1, Number(maxRequests) || 200),
        start,
      }
      await apiRequest<{ id: string; job: Job }>('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      toast.success(
        start
          ? 'اجرای جدید آغاز شد — پیشرفت را در زبانه «اجراها» دنبال کنید'
          : 'کار جدید در صف ذخیره شد — هر زمان خواستید از زبانه «اجراها» شروع کنید',
      )
      // بازنشانی فرم
      setName('')
      setSelectedProvinces([])
      setSelectedCities([])
      setCompanyTypes([])
      setSeedQueriesText('')
      setMaxRequests('200')
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ایجاد کار ناموفق بود')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* هشدار پیش‌از-اجرای: سرویس هوش مصنوعی/جست‌وجو در دسترس نیست */}
      {health && !health.ok && (
        <Alert className="border-amber-300 bg-amber-50">
          <ShieldAlert className="size-4 text-amber-700" aria-hidden="true" />
          <AlertDescription className="text-xs leading-6 text-amber-900">
            <span className="font-bold">سرویس کشف هوشمند در این محیط فعال نیست —</span> اجرای جدید هنگام شروع با خطا متوقف خواهد شد و
            هیچ جست‌وجوی وبی انجام نمی‌شود. علت: {health.message}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-[#1e2f4d]">
            <Building2 className="size-5 text-amber-600" aria-hidden="true" />
            تعریف اجرای جدید ایجنت کشف
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-4 pt-3 sm:p-6 sm:pt-4">
          {/* نام اجرا */}
          <div className="space-y-2">
            <Label htmlFor="job-name">نام اجرا (اختیاری)</Label>
            <Input
              id="job-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: کشف کارخانه‌های استان یزد"
              className="max-w-xl"
            />
          </div>

          <Separator />

          {/* استان‌ها */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                استان‌ها <span className="text-red-700">(*الزامی)</span>
              </Label>
              {selectedProvinces.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {faNum(selectedProvinces.length)} استان انتخاب شده
                </span>
              )}
            </div>
            <Popover open={provinceOpen} onOpenChange={setProvinceOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={provinceOpen}
                  aria-label="انتخاب استان‌ها"
                  className="w-full max-w-xl justify-between font-normal"
                >
                  <span className="truncate text-muted-foreground">
                    {selectedProvinces.length === 0
                      ? 'انتخاب استان‌ها…'
                      : `${faNum(selectedProvinces.length)} استان انتخاب شده است`}
                  </span>
                  <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
                <Command>
                  <CommandList className="max-h-72">
                    <CommandEmpty>استانی یافت نشد</CommandEmpty>
                    <CommandGroup>
                      {(regions?.provinces ?? []).map((p) => (
                        <CommandItem key={p} value={p} onSelect={() => toggleProvince(p)}>
                          <Check
                            className={cn('ml-2 size-4', selectedProvinces.includes(p) ? 'opacity-100' : 'opacity-0')}
                            aria-hidden="true"
                          />
                          {p}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {regionsLoading && <Skeleton className="h-10 w-full max-w-xl" />}
            {selectedProvinces.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedProvinces.map((p) => (
                  <Badge key={p} className="gap-1 bg-[#1e2f4d] text-white hover:bg-[#1e2f4d]">
                    <MapPin className="size-3" aria-hidden="true" />
                    {p}
                    <button
                      type="button"
                      onClick={() => removeProvince(p)}
                      aria-label={`حذف استان ${p}`}
                      className="mr-1 rounded-full hover:text-amber-300"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {provinceError && <p className="text-sm font-medium text-red-700">{provinceError}</p>}
          </div>

          {/* شهرها */}
          {selectedProvinces.length > 0 && (
            <div className="space-y-2">
              <Label>شهرها (اختیاری — خالی یعنی کل استان)</Label>
              <div className="flex max-w-xl flex-wrap gap-2">
                {availableCities.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCity(c)}
                    aria-pressed={selectedCities.includes(c)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      selectedCities.includes(c)
                        ? 'border-[#1e2f4d] bg-[#1e2f4d] text-white'
                        : 'border-border bg-white text-gray-700 hover:border-[#1e2f4d]/50',
                    )}
                  >
                    {c}
                  </button>
                ))}
                {/* شهرهای سفارشی افزوده‌شده */}
                {selectedCities
                  .filter((c) => !availableCities.includes(c))
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCity(c)}
                      aria-pressed="true"
                      aria-label={`حذف شهر سفارشی ${c}`}
                      className="flex items-center gap-1 rounded-full border border-amber-700 bg-amber-600 px-3 py-1 text-xs text-white"
                    >
                      <MapPin className="size-3" aria-hidden="true" />
                      {c}
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  ))}
              </div>
              <div className="flex max-w-xl gap-2">
                <Input
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomCity()
                    }
                  }}
                  placeholder="افزودن شهر سفارشی (Enter)"
                  aria-label="افزودن شهر سفارشی"
                />
                <Button type="button" variant="outline" size="icon" onClick={addCustomCity} aria-label="افزودن شهر">
                  <Plus className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* نوع مجموعه */}
          <div className="space-y-2">
            <Label>نوع مجموعه (اختیاری — خالی یعنی همه انواع)</Label>
            <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
              {COMPANY_TYPE_OPTIONS.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-[#f0f3f8]"
                >
                  <Checkbox checked={companyTypes.includes(t)} onCheckedChange={() => toggleCompanyType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* عبارت‌های دستی */}
          <div className="space-y-2">
            <Label htmlFor="seed-queries">عبارت‌های جست‌وجوی دستی (اختیاری — هر خط یک عبارت)</Label>
            <Textarea
              id="seed-queries"
              value={seedQueriesText}
              onChange={(e) => setSeedQueriesText(e.target.value)}
              placeholder={'مثلاً:\nفهرست شرکت‌های شهرک صنعتی اردکان\nماشین‌سازی یزد'}
              rows={4}
              className="max-w-xl"
            />
          </div>

          {/* سقف درخواست‌ها */}
          <div className="space-y-2">
            <Label htmlFor="max-requests">سقف درخواست‌ها</Label>
            <Input
              id="max-requests"
              type="number"
              min={1}
              value={maxRequests}
              onChange={(e) => setMaxRequests(e.target.value)}
              className="max-w-40"
              dir="ltr"
            />
            <p className="text-xs leading-6 text-muted-foreground">
              هر جست‌وجو یا خواندن صفحه یک درخواست محسوب می‌شود؛ اجرا هنگام رسیدن به سقف به‌صورت خودکار متوقف و
              قابل ادامه است.
            </p>
          </div>

          {/* قواعد ایجنت */}
          <Alert className="border-amber-600/60 bg-[#fdf6e3]">
            <Info className="size-4 text-amber-700" aria-hidden="true" />
            <AlertDescription className="text-sm leading-7 text-[#44403c]">
              <span className="mb-1 flex items-center gap-1.5 font-semibold text-[#1e2f4d]">
                <ShieldAlert className="size-4 text-amber-700" aria-hidden="true" />
                قواعد ایجنت کشف
              </span>
              هیچ اطلاعاتی حدس زده نمی‌شود؛ هر فیلد با منبع و نقل‌قول ثبت می‌شود؛ مقادیر نامطمئن «نامشخص» می‌مانند
              و به صف بررسی می‌روند.
            </AlertDescription>
          </Alert>

          {/* دکمه‌ها */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => submit(true)}
              disabled={busy !== null}
              className="bg-[#1e2f4d] text-white hover:bg-[#2a4066]"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              {busy === 'start' ? 'در حال شروع…' : 'شروع اجرا'}
            </Button>
            <Button variant="outline" onClick={() => submit(false)} disabled={busy !== null}>
              <Save className="size-4" aria-hidden="true" />
              {busy === 'save' ? 'در حال ذخیره…' : 'ذخیره بدون اجرا'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
