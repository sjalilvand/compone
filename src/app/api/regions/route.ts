// GET /api/regions — فهرست استان‌ها و شهرها
import { PROVINCES, CITIES_BY_PROVINCE } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ provinces: PROVINCES, citiesByProvince: CITIES_BY_PROVINCE })
}
