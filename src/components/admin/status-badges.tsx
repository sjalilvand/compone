'use client'

import { Badge } from '@/components/ui/badge'
import {
  ACTIVITY_FA,
  JOB_STATUS_FA,
  OWNERSHIP_FA,
  REVIEW_FA,
} from '@/lib/fa-utils'
import type { ActivityStatus, Job, OwnershipType, ReviewStatus } from '@/lib/admin-types'
import { cn } from '@/lib/utils'

/* نشان نوع مالکیت: دولتی=سرمه‌ای، نیمه‌دولتی=کهربایی، خصوصی=زمردی، نامشخص=خاکستری */
export function OwnershipBadge({ value }: { value: string | null }) {
  const v = (value ?? 'unknown') as OwnershipType
  const cls =
    v === 'state'
      ? 'bg-[#1e2f4d] text-white border-[#1e2f4d]'
      : v === 'semi_state'
        ? 'bg-amber-600 text-white border-amber-600'
        : v === 'private'
          ? 'bg-emerald-700 text-white border-emerald-700'
          : 'bg-gray-200 text-gray-700 border-gray-300'
  return <Badge className={cn('border', cls)}>{OWNERSHIP_FA[v] ?? value ?? 'نامشخص'}</Badge>
}

/* نشان وضعیت فعالیت: فعال=زمردی، نیمه‌فعال=کهربایی، غیرفعال=سرخ، نامشخص=خاکستری */
export function ActivityBadge({ value }: { value: string | null }) {
  const v = (value ?? 'unknown') as ActivityStatus
  const cls =
    v === 'active'
      ? 'bg-emerald-700 text-white border-emerald-700'
      : v === 'semi_active'
        ? 'bg-amber-600 text-white border-amber-600'
        : v === 'inactive'
          ? 'bg-red-700 text-white border-red-700'
          : 'bg-gray-200 text-gray-700 border-gray-300'
  return <Badge className={cn('border', cls)}>{ACTIVITY_FA[v] ?? value ?? 'نامشخص'}</Badge>
}

/* نشان وضعیت بررسی: تأییدشده=زمردی، استخراج هوشمند=خاکستری روشن، ردشده=سرخ */
export function ReviewBadge({ value }: { value: string | null }) {
  const v = (value ?? 'ai_extracted') as ReviewStatus
  const cls =
    v === 'human_verified'
      ? 'bg-emerald-700 text-white border-emerald-700'
      : v === 'ai_extracted'
        ? 'bg-slate-200 text-slate-800 border-slate-300'
        : 'bg-red-700 text-white border-red-700'
  return <Badge className={cn('border', cls)}>{REVIEW_FA[v] ?? value ?? '—'}</Badge>
}

/* نشان وضعیت کار — حالت running نقطه تپنده کهربایی دارد */
export function JobStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'running'
      ? 'bg-amber-600 text-white border-amber-600'
      : status === 'stopping'
        ? 'bg-amber-100 text-amber-800 border-amber-400'
        : status === 'completed'
          ? 'bg-emerald-700 text-white border-emerald-700'
          : status === 'failed'
            ? 'bg-red-700 text-white border-red-700'
            : status === 'paused'
              ? 'bg-gray-200 text-gray-700 border-gray-300'
              : 'bg-white text-gray-600 border-gray-300'
  return (
    <Badge className={cn('border gap-1.5', cls)}>
      {status === 'running' && (
        <span className="gov-pulse inline-block size-1.5 rounded-full bg-white" aria-hidden="true" />
      )}
      {JOB_STATUS_FA[status] ?? status}
    </Badge>
  )
}

/* نشان «نیازمند بررسی» با تپش outline کهربایی */
export function NeedsReviewBadge({ reason }: { reason?: string | null }) {
  return (
    <Badge className="gov-outline-pulse border bg-amber-50 text-amber-800 border-amber-600">
      {reason ? (
        <span title={reason} className="cursor-help">
          نیازمند بررسی
        </span>
      ) : (
        'نیازمند بررسی'
      )}
    </Badge>
  )
}

/* درصد اطمینان رنگی: ≥۸۰ زمردی، ۶۰–۷۹ کهربایی، <۶۰ سرخ */
export function ConfidenceCell({ value, evidenceCount }: { value: number; evidenceCount: number }) {
  if (!value || !evidenceCount) return <span className="text-muted-foreground">—</span>
  const cls = value >= 80 ? 'text-emerald-700' : value >= 60 ? 'text-amber-700' : 'text-red-700'
  return <span className={cn('font-semibold', cls)}>{value.toLocaleString('fa-IR')}٪</span>
}

export function jobName(job: Job): string {
  return job.name?.trim() ? job.name : `کار ${job.id.slice(-6)}`
}
