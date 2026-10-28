// GET/PATCH /api/jobs/[id] — جزئیات کار و کنترل اجرا (start/stop/resume)
import { db } from '@/lib/db'
import { ensureJobRecovery, startJob, requestStop, isJobRunning } from '@/lib/agent/engine'
import { serializeJob, jsonError } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await ensureJobRecovery()
    const job = await db.crawlJob.findUnique({ where: { id } })
    if (!job) return jsonError('کار یافت نشد', 404)
    return Response.json({ job: serializeJob(job), runningInMemory: isJobRunning(id) })
  } catch (e) {
    return Response.json({ error: `خطا در دریافت کار: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await ensureJobRecovery()
    const job = await db.crawlJob.findUnique({ where: { id } })
    if (!job) return jsonError('کار یافت نشد', 404)

    const body = await request.json().catch(() => null)
    const action = body?.action
    if (action !== 'start' && action !== 'stop' && action !== 'resume') {
      return jsonError('کنش نامعتبر است؛ مقادیر مجاز: start، stop، resume')
    }

    if (action === 'start') {
      if (job.status === 'completed') return jsonError('این کار تکمیل شده است', 400)
      await startJob(id)
    } else if (action === 'stop') {
      if (job.status === 'running') {
        await requestStop(id)
      } else {
        await db.crawlJob.update({ where: { id }, data: { status: 'paused' } })
      }
    } else if (action === 'resume') {
      if (job.status === 'running') {
        // در حال اجراست؛ کافی نیست
      } else {
        await db.crawlJob.update({ where: { id }, data: { status: 'pending', finishedAt: null } })
        await startJob(id)
      }
    }

    const updated = await db.crawlJob.findUnique({ where: { id } })
    return Response.json({ job: serializeJob(updated), runningInMemory: isJobRunning(id) })
  } catch (e) {
    return Response.json({ error: `خطا در کنترل کار: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
