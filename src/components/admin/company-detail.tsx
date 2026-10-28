'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  ExternalLink,
  Globe,
  Landmark,
  Link2,
  Pencil,
  Search,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
  GitMerge,
  History,
  Phone,
  MapPin,
  UserRound,
  Handshake,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useApi, apiRequest } from '@/hooks/use-api'
import {
  ACTIVITY_FA,
  ACTOR_FA,
  AUDIT_ENTITY_FA,
  CONTACT_TYPE_FA,
  EVIDENCE_REVIEW_FA,
  LOCATION_TYPE_FA,
  OFFICER_ROLE_FA,
  OWNERSHIP_FA,
  SOURCE_TYPE_FA,
  VERIFICATION_FA,
  faDateTime,
  faDate,
  fieldFa,
  faDigits,
} from '@/lib/fa-utils'
import type {
  ActivityStatus,
  CompaniesResponse,
  CompanyDetail,
  CompanyEvidence,
  EntityType,
  OwnershipType,
} from '@/lib/admin-types'
import { ActivityBadge, OwnershipBadge, ReviewBadge, NeedsReviewBadge } from '@/components/admin/status-badges'
import { cn } from '@/lib/utils'

interface CompanyDetailSheetProps {
  companyId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

/** نگاشت فیلد نمایشی به fieldName شواهد */
const FIELD_TO_EVIDENCE: Record<string, string[]> = {
  officialName: ['company_name'],
  affiliationName: ['affiliation_name'],
  ownershipType: ['ownership_type'],
  activityStatus: ['activity_status'],
  activityDescription: ['activity_description'],
  nationalId: ['national_id'],
  registrationNumber: ['registration_number'],
  website: ['website'],
}

function UnknownValue() {
  return <span className="text-sm italic text-gray-400">نامشخص</span>
}

/** بلوک شواهد یک فیلد — نقل‌قول، منبع، تأیید/رد شاهد */
function EvidenceBlock({
  companyId,
  evidences,
  onReviewed,
}: {
  companyId: string
  evidences: CompanyEvidence[]
  onReviewed: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const best = evidences.reduce((a, b) => (b.confidence > a.confidence ? b : a), evidences[0])

  const reviewEvidence = async (ev: CompanyEvidence, action: 'approve' | 'reject') => {
    setBusyId(ev.id)
    try {
      await apiRequest(`/api/companies/${companyId}/review`, {
        method: 'POST',
        body: JSON.stringify({ action, evidenceId: ev.id }),
      })
      toast.success(action === 'approve' ? 'شاهد تأیید شد' : 'شاهد رد شد')
      onReviewed()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت بررسی ناموفق بود')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={`ev-${best.id}`} className="border-b-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <AccordionTrigger className="py-1 hover:no-underline">
            <Badge
              variant="outline"
              className={cn(
                'gap-1 font-normal',
                best.confidence >= 80
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : best.confidence >= 60
                    ? 'border-amber-600 bg-amber-50 text-amber-800'
                    : 'border-red-400 bg-red-50 text-red-800',
              )}
            >
              <Link2 className="size-3" aria-hidden="true" />
              شاهد: اطمینان {best.confidence.toLocaleString('fa-IR')}٪
              {evidences.length > 1 && ` (${faDigits(evidences.length)} شاهد)`}
            </Badge>
          </AccordionTrigger>
          {best.conflict && <Badge className="bg-red-700 text-white hover:bg-red-700">تعارض</Badge>}
        </div>
        <AccordionContent className="space-y-3 pt-1">
          {evidences.map((ev) => (
            <div key={ev.id} className="rounded-md border bg-gray-50/60 p-3">
              {ev.claimedValue && (
                <p className="mb-1 text-xs text-muted-foreground">
                  مقدار ثبت‌شده: <span className="font-medium text-foreground">{ev.claimedValue}</span>
                </p>
              )}
              {ev.quoteText && <blockquote className="evidence-quote">«{ev.quoteText}»</blockquote>}
              {ev.source && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{ev.source.title || ev.source.url}</span>
                  {ev.source.publisher && <span>ناشر: {ev.source.publisher}</span>}
                  <Badge variant="outline" className="text-[10px]">
                    {SOURCE_TYPE_FA[ev.source.sourceType] ?? ev.source.sourceType}
                  </Badge>
                  <a
                    href={ev.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#1e2f4d] underline-offset-2 hover:underline"
                  >
                    مشاهده منبع
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                  <span>دریافت: {faDate(ev.source.fetchedAt)}</span>
                  {ev.effectiveDate && <span>تاریخ مؤثر: {ev.effectiveDate}</span>}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {EVIDENCE_REVIEW_FA[ev.reviewStatus] ?? ev.reviewStatus}
                </Badge>
                {ev.reviewStatus === 'pending' && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-emerald-700 px-2 text-xs text-emerald-700 hover:bg-emerald-50"
                      onClick={() => reviewEvidence(ev, 'approve')}
                      disabled={busyId === ev.id}
                      aria-label="تأیید این شاهد"
                    >
                      <Check className="size-3" aria-hidden="true" />
                      تأیید
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-red-700 px-2 text-xs text-red-700 hover:bg-red-50"
                      onClick={() => reviewEvidence(ev, 'reject')}
                      disabled={busyId === ev.id}
                      aria-label="رد این شاهد"
                    >
                      <X className="size-3" aria-hidden="true" />
                      رد
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

/** ردیف فیلد اطلاعات اصلی */
function FieldRow({
  label,
  value,
  evidences,
  companyId,
  onReviewed,
}: {
  label: string
  value: string | null
  evidences: CompanyEvidence[]
  companyId: string
  onReviewed: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b py-2.5 last:border-b-0 sm:grid-cols-3 sm:gap-3">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="sm:col-span-2">
        {value ? (
          <span className="text-sm font-medium text-[#1e2f4d] break-all">{value}</span>
        ) : (
          <UnknownValue />
        )}
        {evidences.length > 0 && (
          <div className="mt-1.5">
            <EvidenceBlock companyId={companyId} evidences={evidences} onReviewed={onReviewed} />
          </div>
        )}
      </dd>
    </div>
  )
}

/** شیت جزئیات کامل شرکت با اقدامات بازبینی */
export function CompanyDetailSheet({ companyId, open, onOpenChange, onChanged }: CompanyDetailSheetProps) {
  const enabled = open && Boolean(companyId)
  const { data, loading, error, refetch } = useApi<{ company: CompanyDetail }>(
    enabled ? `/api/companies/${companyId}` : null,
  )
  const company = data?.company ?? null

  const refreshAll = () => {
    refetch()
    onChanged?.()
  }

  /* ---------- گفت‌وگوهای اقدام ---------- */
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  // توجه: تمام هوک‌ها قبل از هر بازگشت زودهنگام فراخوانی شده‌اند
  if (!enabled) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <div className="p-4 sm:p-6">
          {/* عنوان و نشان‌ها — همیشه رندر می‌شود تا دسترس‌پذیری حفظ شود */}
          <SheetHeader className="px-0 pt-0">
            <SheetTitle className="text-xl leading-8 text-[#1e2f4d]">
              {company?.officialName ?? 'جزئیات شرکت'}
            </SheetTitle>
            {company ? (
              <SheetDescription className="flex flex-wrap items-center gap-1.5 pt-1">
                <OwnershipBadge value={company.ownershipType} />
                <ActivityBadge value={company.activityStatus} />
                <ReviewBadge value={company.reviewStatus} />
                {company.needsReview && <NeedsReviewBadge reason={company.reviewReason} />}
                {company.entityType === 'factory' && (
                  <Badge variant="outline" className="border-amber-600 text-amber-800">
                    کارخانه
                  </Badge>
                )}
              </SheetDescription>
            ) : (
              <SheetDescription>مشاهده کامل اطلاعات، شواهد منابع و اقدامات بازبینی</SheetDescription>
            )}
            {company?.needsReview && company.reviewReason && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs leading-6 text-amber-900">
                دلیل نیاز به بررسی: {company.reviewReason}
              </p>
            )}
          </SheetHeader>

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
              <Button size="sm" variant="outline" className="mr-2" onClick={refetch}>
                تلاش دوباره
              </Button>
            </div>
          )}
          {company && (
            <CompanyDetailBody
              company={company}
              onClose={() => onOpenChange(false)}
              onApprove={() => setApproveOpen(true)}
              onReject={() => setRejectOpen(true)}
              onEdit={() => setEditOpen(true)}
              onMerge={() => setMergeOpen(true)}
              onChanged={refreshAll}
              refreshAll={refreshAll}
            />
          )}
        </div>

        {company && (
          <>
            <ApproveDialog
              company={company}
              open={approveOpen}
              onOpenChange={setApproveOpen}
              onDone={refreshAll}
            />
            <RejectDialog
              company={company}
              open={rejectOpen}
              onOpenChange={setRejectOpen}
              onDone={refreshAll}
            />
            <EditDialog
              company={company}
              open={editOpen}
              onOpenChange={setEditOpen}
              onDone={refreshAll}
            />
            <MergeDialog
              company={company}
              open={mergeOpen}
              onOpenChange={setMergeOpen}
              onDone={refreshAll}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ================= بدنه شیت ================= */

function CompanyDetailBody({
  company,
  onApprove,
  onReject,
  onEdit,
  onMerge,
  onChanged,
}: {
  company: CompanyDetail
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
  onMerge: () => void
  onChanged: () => void
  refreshAll: () => void
}) {
  const evidencesFor = (names: string[]) =>
    company.evidence.filter((e) => names.includes(e.fieldName))

  const websiteHost = company.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  return (
    <div className="space-y-6">
      {/* اقدامات */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={onApprove}>
          <ThumbsUp className="size-3.5" aria-hidden="true" />
          تأیید شرکت
        </Button>
        <Button size="sm" variant="outline" className="border-red-700 text-red-700 hover:bg-red-50" onClick={onReject}>
          <ThumbsDown className="size-3.5" aria-hidden="true" />
          رد
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden="true" />
          ویرایش
        </Button>
        <Button size="sm" variant="outline" className="border-[#1e2f4d]" onClick={onMerge}>
          <GitMerge className="size-3.5" aria-hidden="true" />
          ادغام با شرکت دیگر
        </Button>
      </div>

      {/* اطلاعات اصلی */}
      <section aria-labelledby="main-info-h">
        <h3 id="main-info-h" className="mb-2 flex items-center gap-2 text-base font-bold text-[#1e2f4d]">
          <Landmark className="size-4 text-amber-600" aria-hidden="true" />
          اطلاعات اصلی
        </h3>
        <dl>
          <FieldRow
            label="نام رسمی"
            value={company.officialName}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.officialName)}
            companyId={company.id}
            onReviewed={onChanged}
          />
          <FieldRow
            label="وابسته به"
            value={company.affiliationName}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.affiliationName)}
            companyId={company.id}
            onReviewed={onChanged}
          />
          <FieldRow
            label="نوع مالکیت"
            value={OWNERSHIP_FA[company.ownershipType] ?? company.ownershipType}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.ownershipType)}
            companyId={company.id}
            onReviewed={onChanged}
          />
          <FieldRow
            label="وضعیت فعالیت"
            value={ACTIVITY_FA[company.activityStatus] ?? company.activityStatus}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.activityStatus)}
            companyId={company.id}
            onReviewed={onChanged}
          />
          <FieldRow
            label="زمینه فعالیت"
            value={company.activityDescription}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.activityDescription)}
            companyId={company.id}
            onReviewed={onChanged}
          />
          <FieldRow
            label="شناسه ملی"
            value={company.nationalId ? faDigits(company.nationalId) : null}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.nationalId)}
            companyId={company.id}
            onReviewed={onChanged}
          />
          <FieldRow
            label="شماره ثبت"
            value={company.registrationNumber ? faDigits(company.registrationNumber) : null}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.registrationNumber)}
            companyId={company.id}
            onReviewed={onChanged}
          />
          <FieldRow
            label="وب‌سایت"
            value={company.website}
            evidences={evidencesFor(FIELD_TO_EVIDENCE.website)}
            companyId={company.id}
            onReviewed={onChanged}
          />
        </dl>
        {company.website && (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-[#1e2f4d] underline-offset-2 hover:underline"
          >
            <Globe className="size-3.5" aria-hidden="true" />
            {websiteHost}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </section>

      {/* محل‌های فعالیت */}
      <section aria-labelledby="locations-h">
        <h3 id="locations-h" className="mb-2 flex items-center gap-2 text-base font-bold text-[#1e2f4d]">
          <MapPin className="size-4 text-amber-600" aria-hidden="true" />
          محل‌های فعالیت ({faDigits(company.locations.length)})
        </h3>
        {company.locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">محلی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="gov-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>نوع محل</TableHead>
                  <TableHead>استان / شهر</TableHead>
                  <TableHead>آدرس</TableHead>
                  <TableHead>وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.locations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{LOCATION_TYPE_FA[l.locationType] ?? l.locationType}</TableCell>
                    <TableCell>
                      {[l.province, l.city].filter(Boolean).join(' / ') || '—'}
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal break-words">{l.address || '—'}</TableCell>
                    <TableCell>
                      {l.currentStatus === 'active'
                        ? 'فعال'
                        : l.currentStatus === 'inactive'
                          ? 'غیرفعال'
                          : 'نامشخص'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* اطلاعات تماس */}
      <section aria-labelledby="contacts-h">
        <h3 id="contacts-h" className="mb-2 flex items-center gap-2 text-base font-bold text-[#1e2f4d]">
          <Phone className="size-4 text-amber-600" aria-hidden="true" />
          اطلاعات تماس ({faDigits(company.contacts.length)})
        </h3>
        {company.contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">اطلاعات تماسی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="gov-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>نوع</TableHead>
                  <TableHead>مقدار</TableHead>
                  <TableHead>واحد</TableHead>
                  <TableHead>عمومی؟</TableHead>
                  <TableHead>اعتبارسنجی</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{CONTACT_TYPE_FA[c.contactType] ?? c.contactType}</TableCell>
                    <TableCell dir="ltr" className="text-right">
                      {c.value}
                      {c.valueOriginal && c.valueOriginal !== c.value && (
                        <span className="block text-[11px] text-muted-foreground" dir="ltr">
                          {c.valueOriginal}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{c.unitTitle || '—'}</TableCell>
                    <TableCell>{c.isPublic ? 'عمومی' : 'غیرعمومی'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          c.validationStatus === 'verified'
                            ? 'border-emerald-600 text-emerald-800'
                            : c.validationStatus === 'rejected'
                              ? 'border-red-500 text-red-800'
                              : 'border-gray-400 text-gray-600',
                        )}
                      >
                        {VERIFICATION_FA[c.validationStatus] ?? c.validationStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* مسئولان */}
      <section aria-labelledby="officers-h">
        <h3 id="officers-h" className="mb-2 flex items-center gap-2 text-base font-bold text-[#1e2f4d]">
          <UserRound className="size-4 text-amber-600" aria-hidden="true" />
          مسئولان ({faDigits(company.officers.length)})
        </h3>
        {company.officers.length === 0 ? (
          <p className="text-sm text-muted-foreground">مسئولی ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="gov-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>نام</TableHead>
                  <TableHead>سمت</TableHead>
                  <TableHead>دوره</TableHead>
                  <TableHead>منبع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.officers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.personName}</TableCell>
                    <TableCell>{OFFICER_ROLE_FA[o.role] ?? o.role}</TableCell>
                    <TableCell>
                      {o.isCurrent || !o.endDate
                        ? `از ${o.startDate ?? '—'} — جاری`
                        : `${o.startDate ?? '—'} تا ${o.endDate}`}
                    </TableCell>
                    <TableCell>
                      {o.sourceUrl ? (
                        <a
                          href={o.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#1e2f4d] hover:underline"
                          aria-label={`منبع مسئول ${o.personName}`}
                        >
                          <ExternalLink className="size-3" aria-hidden="true" />
                          پیوند
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* سابقه همکاری با کمیته امداد */}
      <section aria-labelledby="coop-h">
        <h3 id="coop-h" className="mb-2 flex items-center gap-2 text-base font-bold text-[#1e2f4d]">
          <Handshake className="size-4 text-amber-600" aria-hidden="true" />
          سابقه همکاری با کمیته امداد ({faDigits(company.cooperationRecords.length)})
        </h3>
        {company.cooperationRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">سابقه‌ای ثبت نشده است.</p>
        ) : (
          <ul className="space-y-2">
            {company.cooperationRecords.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[#1e2f4d]">{r.organization}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      r.verificationStatus === 'verified'
                        ? 'border-emerald-600 text-emerald-800'
                        : r.verificationStatus === 'rejected'
                          ? 'border-red-500 text-red-800'
                          : 'border-gray-400 text-gray-600',
                    )}
                  >
                    {VERIFICATION_FA[r.verificationStatus] ?? r.verificationStatus}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    ثبت: {r.enteredBy === 'agent' ? 'هوش مصنوعی' : r.enteredBy === 'human' ? 'کاربر' : r.enteredBy}
                  </Badge>
                </div>
                {r.cooperationType && <p className="mt-1 text-muted-foreground">نوع: {r.cooperationType}</p>}
                {r.dateText && <p className="text-muted-foreground">تاریخ: {r.dateText}</p>}
                {r.description && <p className="mt-1 leading-6">{r.description}</p>}
                {r.sourceUrl && (
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-[#1e2f4d] hover:underline"
                  >
                    <ExternalLink className="size-3" aria-hidden="true" />
                    منبع
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* تاریخچه تغییرات */}
      <section aria-labelledby="audits-h">
        <h3 id="audits-h" className="mb-2 flex items-center gap-2 text-base font-bold text-[#1e2f4d]">
          <History className="size-4 text-amber-600" aria-hidden="true" />
          تاریخچه تغییرات ({faDigits(company.audits.length)})
        </h3>
        {company.audits.length === 0 ? (
          <p className="text-sm text-muted-foreground">تغییری ثبت نشده است.</p>
        ) : (
          <ScrollArea className="max-h-72 rounded-md border">
            <ul className="divide-y p-0">
              {company.audits.map((a) => (
                <li key={a.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{faDateTime(a.createdAt)}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        a.actor === 'agent'
                          ? 'border-slate-400 text-slate-700'
                          : a.actor === 'human'
                            ? 'border-emerald-600 text-emerald-800'
                            : 'border-amber-600 text-amber-800',
                      )}
                    >
                      {ACTOR_FA[a.actor] ?? a.actor}
                    </Badge>
                    {a.fieldName && <span className="font-medium">{fieldFa(a.fieldName)}</span>}
                  </div>
                  {(a.oldValue || a.newValue) && (
                    <p className="mt-1 leading-6">
                      {a.oldValue && <span className="text-red-800 line-through">{a.oldValue}</span>}
                      {a.oldValue && a.newValue && <span className="mx-1 text-muted-foreground">→</span>}
                      {a.newValue && <span className="text-emerald-800">{a.newValue}</span>}
                    </p>
                  )}
                  {a.reason && <p className="mt-0.5 text-xs text-muted-foreground">دلیل: {a.reason}</p>}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </section>
    </div>
  )
}

/* ================= گفت‌وگوی تأیید شرکت ================= */

function ApproveDialog({
  company,
  open,
  onOpenChange,
  onDone,
}: {
  company: CompanyDetail
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await apiRequest(`/api/companies/${company.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', reason: reason.trim() || undefined }),
      })
      toast.success(`شرکت «${company.officialName}» تأیید شد`)
      onOpenChange(false)
      setReason('')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت تأیید ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1e2f4d]">تأیید شرکت</DialogTitle>
          <DialogDescription>
            شرکت «{company.officialName}» به‌عنوان تأییدشده انسانی ثبت می‌شود. ثبت دلیل اختیاری است.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل تأیید (اختیاری)"
          rows={3}
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={submit} disabled={busy}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {busy ? 'در حال ثبت…' : 'تأیید شرکت'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================= گفت‌وگوی رد شرکت ================= */

function RejectDialog({
  company,
  open,
  onOpenChange,
  onDone,
}: {
  company: CompanyDetail
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      await apiRequest(`/api/companies/${company.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject', reason: reason.trim() || undefined }),
      })
      toast.success(`شرکت «${company.officialName}» رد شد`)
      onOpenChange(false)
      setReason('')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت رد ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-800">رد شرکت</DialogTitle>
          <DialogDescription>
            شرکت «{company.officialName}» رد می‌شود. ثبت دلیل توصیه می‌شود.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل رد (اختیاری)"
          rows={3}
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button className="bg-red-700 text-white hover:bg-red-800" onClick={submit} disabled={busy}>
            <XCircle className="size-4" aria-hidden="true" />
            {busy ? 'در حال ثبت…' : 'رد شرکت'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================= گفت‌وگوی ویرایش ================= */

function EditDialog({
  company,
  open,
  onOpenChange,
  onDone,
}: {
  company: CompanyDetail
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [form, setForm] = useState({
    officialName: company.officialName ?? '',
    affiliationName: company.affiliationName ?? '',
    ownershipType: company.ownershipType,
    activityStatus: company.activityStatus,
    activityDescription: company.activityDescription ?? '',
    nationalId: company.nationalId ?? '',
    registrationNumber: company.registrationNumber ?? '',
    website: company.website ?? '',
    entityType: company.entityType,
  })
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        officialName: company.officialName ?? '',
        affiliationName: company.affiliationName ?? '',
        ownershipType: company.ownershipType,
        activityStatus: company.activityStatus,
        activityDescription: company.activityDescription ?? '',
        nationalId: company.nationalId ?? '',
        registrationNumber: company.registrationNumber ?? '',
        website: company.website ?? '',
        entityType: company.entityType,
      })
      setReason('')
      setReasonError(null)
    }
  }, [open, company])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!reason.trim()) {
      setReasonError('ثبت دلیل ویرایش الزامی است')
      return
    }
    setReasonError(null)
    setBusy(true)
    try {
      await apiRequest(`/api/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          patch: {
            officialName: form.officialName.trim() || undefined,
            affiliationName: form.affiliationName.trim() || undefined,
            ownershipType: form.ownershipType as OwnershipType,
            activityStatus: form.activityStatus as ActivityStatus,
            activityDescription: form.activityDescription.trim() || undefined,
            nationalId: form.nationalId.trim() || undefined,
            registrationNumber: form.registrationNumber.trim() || undefined,
            website: form.website.trim() || undefined,
            entityType: form.entityType as EntityType,
          },
          reason: reason.trim(),
        }),
      })
      toast.success('ویرایش شرکت با موفقیت ثبت شد')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ویرایش ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[#1e2f4d]">ویرایش شرکت</DialogTitle>
          <DialogDescription>
            تغییرات با ثبت دلیل، در تاریخچه تغییرات و به‌عنوان شاهد دستی با اطمینان ۱۰۰٪ ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">نام رسمی</Label>
            <Input id="edit-name" value={form.officialName} onChange={(e) => set('officialName', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-affiliation">وابسته به (وزارت/سازمان/هلدینگ)</Label>
            <Input
              id="edit-affiliation"
              value={form.affiliationName}
              onChange={(e) => set('affiliationName', e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>نوع مالکیت</Label>
              <Select value={form.ownershipType} onValueChange={(v) => set('ownershipType', v)} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['state', 'semi_state', 'private', 'unknown'] as const).map((v) => (
                    <SelectItem key={v} value={v}>
                      {OWNERSHIP_FA[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>وضعیت فعالیت</Label>
              <Select value={form.activityStatus} onValueChange={(v) => set('activityStatus', v)} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['active', 'semi_active', 'inactive', 'unknown'] as const).map((v) => (
                    <SelectItem key={v} value={v}>
                      {ACTIVITY_FA[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-desc">زمینه فعالیت</Label>
            <Textarea
              id="edit-desc"
              rows={2}
              value={form.activityDescription}
              onChange={(e) => set('activityDescription', e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-national-id">شناسه ملی</Label>
              <Input
                id="edit-national-id"
                value={form.nationalId}
                onChange={(e) => set('nationalId', e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-reg-no">شماره ثبت</Label>
              <Input
                id="edit-reg-no"
                value={form.registrationNumber}
                onChange={(e) => set('registrationNumber', e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-website">وب‌سایت</Label>
              <Input
                id="edit-website"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="grid gap-2">
              <Label>نوع مجموعه</Label>
              <Select value={form.entityType} onValueChange={(v) => set('entityType', v)} dir="rtl">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">شرکت</SelectItem>
                  <SelectItem value="factory">کارخانه</SelectItem>
                  <SelectItem value="other">سایر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-reason">
              دلیل ویرایش <span className="text-red-700">(*الزامی)</span>
            </Label>
            <Textarea
              id="edit-reason"
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError && e.target.value.trim()) setReasonError(null)
              }}
              placeholder="مثلاً: تصحیح بر اساس اسناد رسمی ثبت شرکت‌ها"
              aria-invalid={Boolean(reasonError)}
            />
            {reasonError && (
              <p className="text-sm font-medium text-red-700" role="alert">
                {reasonError}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button className="bg-[#1e2f4d] text-white hover:bg-[#2a4066]" onClick={submit} disabled={busy}>
            {busy ? 'در حال ثبت…' : 'ثبت ویرایش'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ================= گفت‌وگوی ادغام ================= */

function MergeDialog({
  company,
  open,
  onOpenChange,
  onDone,
}: {
  company: CompanyDetail
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [q, setQ] = useState('')
  const [searched, setSearched] = useState(false)
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, refetch } = useApi<CompaniesResponse>(
    open && searched ? `/api/companies?q=${encodeURIComponent(q)}&pageSize=20` : null,
    [q, searched],
  )
  const options = useMemo(() => (data?.items ?? []).filter((i) => i.id !== company.id), [data, company.id])

  useEffect(() => {
    if (open) {
      setQ('')
      setSearched(false)
      setTargetId('')
      setReason('')
      setReasonError(null)
    }
  }, [open])

  const submit = async () => {
    if (!targetId) {
      toast.error('شرکت مقصد را انتخاب کنید')
      return
    }
    if (!reason.trim()) {
      setReasonError('ثبت دلیل ادغام الزامی است')
      return
    }
    setReasonError(null)
    setBusy(true)
    try {
      await apiRequest(`/api/companies/${company.id}/merge`, {
        method: 'POST',
        body: JSON.stringify({ targetId, reason: reason.trim() }),
      })
      toast.success('ادغام شرکت‌ها انجام شد')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ادغام ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#1e2f4d]">ادغام با شرکت دیگر</DialogTitle>
          <DialogDescription>
            رکورد فعلی «{company.officialName}» در شرکت مقصد ادغام می‌شود و به‌عنوان تکراری علامت می‌خورد.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setSearched(true)
                  refetch()
                }
              }}
              placeholder="جست‌وجوی شرکت مقصد…"
              aria-label="جست‌وجوی شرکت مقصد"
            />
            <Button
              variant="outline"
              onClick={() => {
                setSearched(true)
                refetch()
              }}
              aria-label="جست‌وجو"
            >
              <Search className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {searched && (
            <div className="max-h-44 overflow-y-auto rounded-md border">
              {loading ? (
                <p className="p-3 text-sm text-muted-foreground">در حال جست‌وجو…</p>
              ) : options.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">شرکتی یافت نشد.</p>
              ) : (
                <ul className="divide-y">
                  {options.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setTargetId(o.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 p-2.5 text-right text-sm hover:bg-[#f0f3f8]',
                          targetId === o.id && 'bg-[#1e2f4d]/10',
                        )}
                        aria-pressed={targetId === o.id}
                      >
                        <span className="font-medium">{o.officialName}</span>
                        <span className="text-xs text-muted-foreground">{o.province ?? '—'}</span>
                        {targetId === o.id && <Check className="size-4 text-emerald-700" aria-hidden="true" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="merge-reason">
              دلیل ادغام <span className="text-red-700">(*الزامی)</span>
            </Label>
            <Textarea
              id="merge-reason"
              rows={2}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError && e.target.value.trim()) setReasonError(null)
              }}
              placeholder="مثلاً: رکورد تکراری همان مجموعه است"
              aria-invalid={Boolean(reasonError)}
            />
            {reasonError && (
              <p className="text-sm font-medium text-red-700" role="alert">
                {reasonError}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button className="bg-[#1e2f4d] text-white hover:bg-[#2a4066]" onClick={submit} disabled={busy}>
            <GitMerge className="size-4" aria-hidden="true" />
            {busy ? 'در حال ادغام…' : 'انجام ادغام'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
