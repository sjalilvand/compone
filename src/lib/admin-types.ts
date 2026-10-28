// انواع داده پنل مدیریت — مطابق قرارداد API بک‌اند (worklog Task 1)

export type JobStatus = 'pending' | 'running' | 'paused' | 'stopping' | 'completed' | 'failed'
export type JobStage = 'planning' | 'discovering' | 'researching' | 'done' | null
export type OwnershipType = 'state' | 'semi_state' | 'private' | 'unknown'
export type ActivityStatus = 'active' | 'semi_active' | 'inactive' | 'unknown'
export type ReviewStatus = 'human_verified' | 'ai_extracted' | 'rejected'
export type EntityType = 'company' | 'factory' | 'other'
export type LocationType = 'hq' | 'factory' | 'branch' | 'sales_office'
export type ContactType = 'phone' | 'mobile' | 'fax' | 'email'
export type OfficerRole = 'ceo' | 'chairman' | 'other'
export type SourceType = 'official' | 'guild' | 'news' | 'directory' | 'other'
export type AuditEntityType = 'company' | 'location' | 'contact' | 'officer' | 'evidence' | 'job' | string
export type AuditActor = 'agent' | 'human' | 'system' | string

/* ---------------- آمار ---------------- */

export interface StatsResponse {
  companies: {
    total: number
    verified: number
    aiExtracted: number
    needsReview: number
    conflicts: number
    conflictEvidence: number
    duplicateSuspects: number
  }
  jobs: { running: number; completed: number; total: number }
  topProvinces: Array<{ province: string; count: number }>
  lastCheckedAt: string | null
}

export interface RegionsResponse {
  provinces: string[]
  citiesByProvince: Record<string, string[]>
}

/* ---------------- کارها ---------------- */

export interface JobQuery {
  q: string
  done: boolean
}

export interface JobCandidate {
  name: string
  url?: string
  hint?: string
  processed: boolean
  note?: string
}

export interface JobErrorEntry {
  time: string
  message: string
}

export interface JobStats {
  sourcesChecked: number
  newCompanies: number
  updatedCompanies: number
  uncertain: number
  errors: number
}

export interface Job {
  id: string
  name: string | null
  provinces: string[]
  cities: string[]
  companyTypes: string[]
  seedQueries: string[]
  maxRequests: number
  requestsMade: number
  status: JobStatus
  currentStage: JobStage
  progressDone: number
  progressTotal: number
  progressPercent: number
  queries: JobQuery[]
  candidates: JobCandidate[]
  errors: JobErrorEntry[]
  stats: JobStats
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface JobsResponse {
  items: Job[]
}

export interface CreateJobBody {
  name?: string
  provinces: string[]
  cities?: string[]
  companyTypes?: string[]
  seedQueries?: string[]
  maxRequests?: number
  start?: boolean
}

/* ---------------- شرکت‌ها ---------------- */

export interface CompanyListItem {
  id: string
  officialName: string
  ownershipType: OwnershipType
  activityStatus: ActivityStatus
  reviewStatus: ReviewStatus
  needsReview: boolean
  reviewReason: string | null
  affiliationName: string | null
  ceoName: string | null
  province: string | null
  city: string | null
  address: string | null
  confidence: number
  evidenceCount: number
  lastCheckedAt: string | null
  createdAt: string
}

export interface CompaniesResponse {
  items: CompanyListItem[]
  total: number
  page: number
  pageSize: number
}

export interface CompaniesQuery {
  q?: string
  province?: string
  city?: string
  ownership?: string
  status?: string
  review?: string
  needsReview?: string
  page?: number
  pageSize?: number
}

export interface EvidenceSource {
  url: string
  title: string | null
  publisher: string | null
  sourceType: SourceType
  fetchedAt: string
}

export interface CompanyEvidence {
  id: string
  entityType: string
  entityId: string | null
  fieldName: string
  claimedValue: string | null
  quoteText: string | null
  effectiveDate: string | null
  confidence: number
  reviewStatus: 'pending' | 'approved' | 'rejected'
  conflict: boolean
  createdAt: string
  source: EvidenceSource | null
}

export interface CompanyLocationItem {
  id: string
  companyId: string
  locationType: LocationType
  name: string | null
  province: string | null
  city: string | null
  county: string | null
  address: string | null
  postalCode: string | null
  currentStatus: string | null
}

export interface CompanyContactItem {
  id: string
  companyId: string
  contactType: ContactType
  value: string
  valueOriginal: string | null
  unitTitle: string | null
  isPublic: boolean
  validationStatus: 'unverified' | 'verified' | 'rejected'
}

export interface CompanyOfficerItem {
  id: string
  companyId: string
  personName: string
  role: OfficerRole
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  sourceUrl: string | null
}

export interface CooperationRecordItem {
  id: string
  companyId: string
  organization: string
  cooperationType: string | null
  dateText: string | null
  description: string | null
  sourceUrl: string | null
  verificationStatus: 'unverified' | 'verified' | 'rejected'
  enteredBy: 'agent' | 'human' | string
  createdAt: string
}

export interface CompanyAudit {
  id: string
  entityType: AuditEntityType
  entityId: string | null
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  reason: string | null
  actor: AuditActor
  jobId: string | null
  createdAt: string
}

export interface CompanyDetail {
  id: string
  officialName: string
  normalizedName: string
  brandName: string | null
  alternateNames: string | null
  nationalId: string | null
  registrationNumber: string | null
  entityType: EntityType
  ownershipType: OwnershipType
  activityStatus: ActivityStatus
  activityDescription: string | null
  affiliationName: string | null
  website: string | null
  reviewStatus: ReviewStatus
  needsReview: boolean
  reviewReason: string | null
  sourceJobId: string | null
  firstSeenAt: string
  lastCheckedAt: string | null
  createdAt: string
  updatedAt: string
  mergedIntoId: string | null
  locations: CompanyLocationItem[]
  contacts: CompanyContactItem[]
  officers: CompanyOfficerItem[]
  cooperationRecords: CooperationRecordItem[]
  evidence: CompanyEvidence[]
  audits: CompanyAudit[]
}

export interface CompanyPatch {
  officialName?: string
  ownershipType?: OwnershipType
  activityStatus?: ActivityStatus
  activityDescription?: string
  affiliationName?: string
  nationalId?: string
  registrationNumber?: string
  website?: string
  entityType?: EntityType
}

/* ---------------- صف‌های بررسی ---------------- */

export type UncertainQueueItem = CompanyListItem

export interface ConflictQueueItem {
  companyId: string
  companyName: string
  fieldName: string
  claimedValue: string | null
  confidence: number
  sourceUrl: string | null
  quoteText: string | null
  evidenceId: string
  createdAt: string
}

export interface DuplicateQueueGroup {
  key: string
  items: Array<{ id: string; officialName: string; province: string | null }>
}

export interface MissingQueueItem {
  field: string
  fieldFa: string
  missingCount: number
  samples: Array<{ id: string; officialName: string }>
}

export type QueueResponse =
  | { type: 'uncertain'; items: UncertainQueueItem[] }
  | { type: 'conflict'; items: ConflictQueueItem[] }
  | { type: 'duplicates'; items: DuplicateQueueGroup[] }
  | { type: 'missing'; items: MissingQueueItem[] }

/* ---------------- پوشش و حسابرسی ---------------- */

export interface CoverageResponse {
  provinces: Array<{ province: string; companies: number; uncertain: number; lastChecked: string | null }>
  sourcesChecked: number
  unreachableSources: number
}

export interface AuditLogItem {
  id: string
  entityType: AuditEntityType
  entityId: string | null
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  reason: string | null
  actor: AuditActor
  jobId: string | null
  createdAt: string
}

export interface AuditResponse {
  items: AuditLogItem[]
}
