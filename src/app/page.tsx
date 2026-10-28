'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LayoutDashboard, PlusCircle, PlayCircle, Building2, ClipboardCheck, Map, History } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminHeader } from '@/components/admin/header'
import { DashboardTab } from '@/components/admin/dashboard'
import { NewJobTab } from '@/components/admin/new-job'
import { JobsTab } from '@/components/admin/jobs'
import { CompaniesTab } from '@/components/admin/companies'
import { CompanyDetailSheet } from '@/components/admin/company-detail'
import { QueuesTab } from '@/components/admin/queues'
import { CoverageTab } from '@/components/admin/coverage'
import { AuditLogTab } from '@/components/admin/audit-log'
import { useApi } from '@/hooks/use-api'
import type { RegionsResponse, StatsResponse } from '@/lib/admin-types'

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard')
  const [runningFromJobsTab, setRunningFromJobsTab] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: stats, refetch: refetchStats } = useApi<StatsResponse>('/api/stats')
  const { data: regions } = useApi<RegionsResponse>('/api/regions')

  // نظرسنجی آمار فقط وقتی کاری در حال اجراست
  const runningNow = stats?.jobs.running ?? 0
  useEffect(() => {
    if (runningNow > 0) {
      const t = setInterval(() => refetchStats(), 5000)
      return () => clearInterval(t)
    }
  }, [runningNow, refetchStats])

  const runningJobs = Math.max(runningNow, runningFromJobsTab)

  const openDetail = useCallback((id: string) => {
    setDetailId(id)
    setDetailOpen(true)
  }, [])

  const downloadFull = () => {
    const a = document.createElement('a')
    a.href = '/api/export?scope=all'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleRefresh = () => {
    refetchStats()
    toast.success('داده‌ها بازخوانی شد')
  }

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-[#f6f7f9]">
      <AdminHeader
        runningJobs={runningJobs}
        onSwitchTab={setTab}
        onRefresh={handleRefresh}
        regions={regions}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6" role="main">
        <Tabs value={tab} onValueChange={setTab} dir="rtl" className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto w-fit min-w-full justify-start sm:min-w-0">
              <TabsTrigger value="dashboard" className="gap-1.5">
                <LayoutDashboard className="size-4" aria-hidden="true" />
                داشبورد
              </TabsTrigger>
              <TabsTrigger value="new-job" className="gap-1.5">
                <PlusCircle className="size-4" aria-hidden="true" />
                اجرای جدید
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5">
                <PlayCircle className="size-4" aria-hidden="true" />
                اجراها
              </TabsTrigger>
              <TabsTrigger value="companies" className="gap-1.5">
                <Building2 className="size-4" aria-hidden="true" />
                شرکت‌ها
              </TabsTrigger>
              <TabsTrigger value="queues" className="gap-1.5">
                <ClipboardCheck className="size-4" aria-hidden="true" />
                صف بررسی
              </TabsTrigger>
              <TabsTrigger value="coverage" className="gap-1.5">
                <Map className="size-4" aria-hidden="true" />
                گزارش پوشش
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-1.5">
                <History className="size-4" aria-hidden="true" />
                تاریخچه تغییرات
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="animate-in fade-in-50 duration-200">
            <DashboardTab onNewJob={() => setTab('new-job')} onDownloadExport={downloadFull} />
          </TabsContent>

          <TabsContent value="new-job" className="animate-in fade-in-50 duration-200">
            <NewJobTab onCreated={() => setTab('jobs')} />
          </TabsContent>

          <TabsContent value="jobs" className="animate-in fade-in-50 duration-200">
            <JobsTab onRunningCountChange={setRunningFromJobsTab} />
          </TabsContent>

          <TabsContent value="companies" className="animate-in fade-in-50 duration-200">
            <CompaniesTab onOpenDetail={openDetail} />
          </TabsContent>

          <TabsContent value="queues" className="animate-in fade-in-50 duration-200">
            <QueuesTab onOpenDetail={openDetail} />
          </TabsContent>

          <TabsContent value="coverage" className="animate-in fade-in-50 duration-200">
            <CoverageTab />
          </TabsContent>

          <TabsContent value="audit" className="animate-in fade-in-50 duration-200">
            <AuditLogTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* پانوشت چسبان */}
      <footer className="mt-auto border-t-2 border-amber-600 bg-[#1e2f4d] py-4 text-center text-xs text-white/80 sm:text-sm">
        سامانه بانک اطلاعات شرکت‌ها و کارخانه‌های ایران — نسخه ۱.۰
      </footer>

      <CompanyDetailSheet
        companyId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChanged={() => refetchStats()}
      />
    </div>
  )
}
