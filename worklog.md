# Worklog — سامانه بانک اطلاعات شرکت‌ها و کارخانه‌های ایران

---
Task ID: 0
Agent: main (Z.ai)
Task: تحلیل نیازمندی‌ها، قالب اکسل و آماده‌سازی محیط

Work Log:
- سند نیازمندی‌های کامل (۱۷ بخش) از کارفرما دریافت شد؛ تصمیم کارفرما: ساخت واقعی سامانه + ایجنت هوشمند جست‌وجوگر وب
- فایل /home/z/my-project/upload/kolfile.xlsx تحلیل شد:
  * شیت Sheet1، راست‌به‌چپ (rightToLeft=true)
  * عنوان ادغام‌شده A1:J2 = «فهرست اسامی شرکت های دولتی و خصوصی شاخص» (فونت B Mitra، 12، bold)
  * سرستون‌های چندسطحی ردیف ۳-۵ با ادغام: A3:A5(ردیف)، C3:C5(نام شرکت)، D3+D4:D5(وابسته به وزارت/سازمان/هلدینگ + زیرنویس نوع مالکیت)، E3+E4:E5(وضعیت فعالیت)، F3+F4:F5(کالا/خدمات)، G3+G4:G5(سابقه همکاری با کمیته امداد «دارد/ندارد»)، H3:H5(نام مدیرعامل)، I3+I4:I5(شماره تماس «شرکت/مدیرعامل»)، J3+J4:J5(آدرس «شرکت/دفتر مرکزی»)، B4(استان)
  * عرض ستون‌ها: A:5.66 B:20 C:52 D:28.22 E:25.44 F:13.22 G:10.55 H:46.66 I:17.78 J:100.33
  * داده‌ها از ردیف ۶ (A6='1')
- محیط fullstack راه‌اندازی شد (Next.js 16 + Prisma SQLite + shadcn/ui)
- SDK بررسی شد: zai.functions.invoke('web_search',{query,num})، zai.functions.invoke('page_reader',{url})، zai.chat.completions.create()

Stage Summary:
- قالب اکسل کامل فهمیده شد؛ خروجی اکسل باید عیناً همین ساختار را بازتولید کند (۴ شیت: قالب اصلی + تکمیلی + منابع و شواهد + گزارش اجرا)
- قواعد طلایی ایجنت: هیچ حدسی زده نشود؛ هر فیلد باید منبع + نقل‌قول + سطح اطمینان داشته باشد؛ نبود اطلاعات = نامشخص

---
Task ID: 1
Agent: full-stack-developer
Task: پیاده‌سازی کامل بک‌اند — اسکیمای دیتابیس، موتور ایجنت کراول، مسیرهای API و خروجی اکسل مطابق قالب

Work Log:
- prisma/schema.prisma: ۸ مدل (Company, CompanyLocation, CompanyContact, CompanyOfficer, CooperationRecord, Source, FieldEvidence, CrawlJob, AuditLog) با حفظ دقیق بلوک datasource/generator؛ `bun run db:push` موفق. فهرست‌ها به‌صورت رشته JSON ذخیره می‌شوند.
- src/lib/regions.ts: PROVINCES (۳۱ استان استاندارد فارسی) + CITIES_BY_PROVINCE (۴ تا ۸ شهر معتبر هر استان).
- src/lib/normalize.ts: normalizePersian (ی/ک/ة/أ، ارقام فارسی/عربی→ASCII، حذف اعراب و کشیده، فاصله اطراف ZWNJ)، normalizeNameKey (حذف پرانتز، عبارت «گروه صنعتی»، پسوندهای شرکت/کارخانه/هلدینگ/گروه/co/ltd/...، lowercase)، normalizePhone (+98/0098/98→0، 9xxxxxxxxx→09..., اعتبارسنجی /^0\d{10}$/ یا ۸–۱۰ رقم محلی؛ هیچ عددی ساخته نمی‌شود)، normalizeProvince (تطبیق فازی با نام‌های جایگزین)، safeCell (محافظ تزریق فرمول اکسل + سقف ۳۰۰۰)، jaccardSimilarity.
- src/lib/agent/sdk.ts: وب‌رپ‌های z-ai-web-dev-sdk با retry حداکثر ۲ و timeout ۶۰s: webSearch (نرمال‌سازی شکل‌های مختلف پاسخ → {url,title,snippet}[])، readPage (null در خطا)، chat، chatJSON (حذف ```json + استخراج بلوک JSON متوازن)، htmlToText با cheerio (سقف ۱۲۰۰۰ نویسه، برش میانه ۶۰۰۰+۶۰۰۰).
- src/lib/agent/prompts.ts: سه پرامپت فارسی — buildQueryPlanningPrompt (۱۲–۲۰ کوئری متنوع)، buildDiscoveryPrompt (نامزدهای صریح حداکثر ۱۵)، buildExtractionPrompt (قواعد طلایی کارفرما: ممنوعیت حدس، نقل‌قول ≤۲۰۰ نویسه برای هر فیلد، نبود اطلاعات ≠ ندارد، وب‌سایت فعال ≠ کارخانه فعال، ceo_phone فقط با تصریح، emdad فقط has/has_not/unknown، ownership فقط با تصریح؛ شِمای JSON خروجی با evidence[{field,value,quote,confidence,source_index,effective_date}]).
- src/lib/agent/engine.ts: موتور درون‌پردازشی با Map انتظار (running)، ensureJobRecovery (running→paused پس از ری‌استارت + AuditLog)، startJob/requestStop/isJobRunning. حلقه runJob با نقاط بازرسی قبل از هر فراخوانی خارجی: ۴ مرحله planning→discovering→researching→done؛ بودجه requestsMade/maxRequests (توقف خودکار با پیام «سقف بودجه درخواست‌ها»)، ذخیره وضعیت پس از هر کوئری/نامزد (قابل resume)؛ جست‌وجوی هدفمند «"نام" تماس با ما آدرس»، خواندن حداکثر ۲ صفحه، استخراج LLM، نرمال‌سازی، upsert شرکت (فقط فیلدهای خالی به‌روزرسانی می‌شوند؛ بازنویسی بی‌صدا ممنوع)، محل/تماس/مدیرعامل/سابقه کمیته امداد، ثبت FieldEvidence برای هر فیلد با Source (heuristic نوع منبع + بونوس اطمینان ۱۰ برای منبع رسمی)، تشخیص تعارض (مقادیر متفاوت یک فیلد → conflict=true + needsReview)، اطمینان <۶۰ → needsReview، تشخیص احتمال تکرار نام (جاکارد ≥۰.۸)، AuditLog برای هر رکورد.
- src/lib/excel/export.ts: چهار شیت با rightToLeft، فونت B Mitra، همه مقادیر از safeCell:
  * Sheet1 — عین قالب کارفرما: عرض‌های A 5.66 … J 100.33؛ عنوان ادغام A1:J2؛ سرستون‌های ردیف ۳–۵ با ادغام‌های دقیق (A3:A5، B4 بدون ادغام، C3:C5، D3+D4:D5، E3+E4:E5، F3+F4:F5، G3+G4:G5، H3:H5، I3+I4:I5، J3+J4:J5)؛ داده از ردیف ۶ (ارتفاع ۳۰، حاشیه thin)؛ ستون G فقط «دارد» یا «نداردِ تأییدشده» وگرنه خالی.
  * اطلاعات تکمیلی — شناسه داخلی/نام/شناسه ملی/شماره ثبت/شهر/نوع مجموعه/نوع محل/وب‌سایت/تاریخ آخرین بررسی/وضعیت تأیید/فیلدهای نامشخص (هدر F2F2F2).
  * منابع و شواهد — یک ردیف به‌ازای هر FieldEvidence با URL/عنوان/نوع منبع/تاریخ/متن شاهد/سطح اطمینان (عدد)/وضعیت تأیید.
  * گزارش اجرا — بلوک کار (محدوده، وضعیت، زمان‌ها، منابع بررسی‌شده، نامزدها، درخواست‌ها، جدید/به‌روزرسانی/نامطمئن/خطاها + ۱۰ خطای اول، نکته ثابت پوشش) + ردیف‌های نهایی کل شرکت‌ها و تأیید انسانی.
- ۱۲ مسیر API (همه `export const dynamic = 'force-dynamic'`، پیام خطای فارسی): stats، regions، jobs (GET/POST)، jobs/[id] (GET/PATCH)، companies (GET)، companies/[id] (GET/PATCH)، companies/[id]/review (POST)، companies/[id]/merge (POST)، queues، coverage، audit، export.
- src/lib/api-helpers.ts: serializeJob/serializeCompanyListItem/serializeCompanyDetail + اعتبارسنجی واژگان ثابت.
- اصلاح باگ یافت‌شده در تست: normalizeNameKey واژه‌های واقعی نام (پارس/صنعتی/تولیدی) را حذف می‌کرد → کلید خالی؛ فهرست پسوندها دقیقاً طبق مشخصات محدود شد.
- src/lib/db.ts: سطح لاگ Prisma از query به error (کاهش نویز dev.log). صفحه / و src/app/page.tsx دست‌نخورده — HTTP 200.

API Contract (امضای دقیق مسیرها و شکل پاسخ — برای مصرف فرانت‌اند):
- GET /api/stats → { companies: { total, verified, aiExtracted, needsReview, conflicts, conflictEvidence, duplicateSuspects }, jobs: { running, completed, total }, topProvinces: [{ province, count }] (حداکثر ۸), lastCheckedAt: string|null }
- GET /api/regions → { provinces: string[], citiesByProvince: Record<string,string[]> }
- GET /api/jobs → { items: Job[] } — Job = { id, name, provinces: string[], cities: string[], companyTypes: string[], seedQueries: string[], maxRequests, requestsMade, status: 'pending'|'running'|'paused'|'stopping'|'completed'|'failed', currentStage: 'planning'|'discovering'|'researching'|'done'|null, progressDone, progressTotal, progressPercent (0–100), queries: [{q,done}], candidates: [{name,url?,hint?,processed,note?}], errors: [{time,message}], stats: { sourcesChecked, newCompanies, updatedCompanies, uncertain, errors }, startedAt, finishedAt, createdAt, updatedAt }
- POST /api/jobs body { name?, provinces: string[] (الزامی، معتبر با regions), cities?, companyTypes?, seedQueries?, maxRequests?, start? } → 201 { id, job: Job } | 400 { error }
- GET /api/jobs/[id] → { job: Job, runningInMemory: boolean }
- PATCH /api/jobs/[id] body { action: 'start'|'stop'|'resume' } → { job: Job, runningInMemory }
- GET /api/companies?q=&province=&city=&ownership=&status=&review=&needsReview=&page=&pageSize= → { items: ListItem[], total, page, pageSize } — ListItem = { id, officialName, ownershipType, activityStatus, reviewStatus, needsReview, reviewReason, affiliationName, ceoName, province, city, address, confidence (میانگین شواهد), evidenceCount, lastCheckedAt, createdAt }
- GET /api/companies/[id] → { company: Detail } — Detail = تمام فیلدهای Company + locations[], contacts[], officers[], cooperationRecords[], evidence[] (هرکدام با source: {url,title,publisher,sourceType,fetchedAt}|null، مرتب بر اساس confidence نزولی) + audits[] (حداکثر ۱۰۰)
- PATCH /api/companies/[id] body { patch: { officialName?, ownershipType?, activityStatus?, activityDescription?, affiliationName?, nationalId?, registrationNumber?, website?, entityType? }, locations?: [{id?, locationType, province, city, address, ...}], contacts?: [{id?, contactType, value, unitTitle, isPublic}], reason (الزامی) } → بدون reason: 400 {error:'ثبت دلیل ویرایش الزامی است'}؛ موفق: { company: Detail } + AuditLog(human) + FieldEvidence دستی (confidence 100, approved) + reviewStatus='human_verified'
- POST /api/companies/[id]/review body { action: 'approve'|'reject', reason?, evidenceId? } → { ok, company: Detail }
- POST /api/companies/[id]/merge body { targetId, reason (الزامی) } → { ok, sourceId, targetId }
- GET /api/queues?type=uncertain → { type, items: ListItem[] } | type=conflict → { type, items: [{companyId, companyName, fieldName, claimedValue, confidence, sourceUrl, quoteText, evidenceId, createdAt}] } | type=duplicates → { type, items: [{key, items: [{id, officialName, province}]}] } | type=missing → { type, items: [{field, fieldFa, missingCount, samples: [{id, officialName}]}] }
- GET /api/coverage → { provinces: [{province, companies, uncertain, lastChecked}], sourcesChecked, unreachableSources }
- GET /api/audit?limit=&entityType= → { items: AuditLog[] (نزولی createdAt) }
- GET /api/export?jobId=&scope=all|province&province=... → ۲۰۰ باینری xlsx با هدرهای Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet و Content-Disposition: attachment; filename="companies-export-YYYYMMDD.xlsx" | 400 {error} (province بدون مقدار). توجه: مقدار province باید URL-encode شود.

Stage Summary:
- بک‌اند کامل و دود-تست‌شده: اسکیما، موتور ایجنت ۴مرحله‌ای با بودجه/توقف/ادامه، ۱۲ مسیر API، خروجی اکسل چهارشیتی مطابق قالب
- دود-تست واقعی: کار «تست دود» (یزد/اردکان) اجرا شد → ۲۰ کوئری LLM، ۱۱۴ نامزد کشف‌شده، ۷ شرکت واقعی با شواهد/مدیرعامل/آدرس ثبت شد؛ توقف خودکار روی سقف بودجه و resume موفق؛ خروجی xlsx با openpyxl راستی‌آزمایی شد (شیت‌ها، rightToLeft، ادغام‌ها، عنوان، عرض ستون‌ها، ردیف داده)
- قواعد طلایی در پرامپت استخراج نهادینه شد: هر مقدار با نقل‌قول + منبع + اطمینان؛ نامشخص = unknown (نه «ندارد»)؛ تعارض منابع → صف بازبینی
- برای فرانت‌اند: همه پاسخ‌ها JSON با کلیدهای بالا؛ خطاها { error: پیام فارسی }؛ پیشرفت کار از progressPercent و currentStage قابل نمایش است؛ صف‌ها از /api/queues?type=... خوانده می‌شوند

---
Task ID: 2
Agent: frontend-developer (Z.ai)
Task: پیاده‌سازی کامل فرانت‌اند پنل مدیریت — صفحه تک‌صفحه‌ای RTL فارسی با هفت زبانه، مطابق قرارداد API بک‌اند

Work Log:
- src/app/layout.tsx: `<html lang="fa" dir="rtl">`، عنوان «بانک اطلاعات شرکت‌ها و کارخانه‌های ایران»، فونت Vazirmatn از CDN (Vazirmatn-font-face.css) در head، Toaster از sonner با dir=rtl؛ حذف فونت‌های Geist و متادیتای پیش‌فرض
- src/app/globals.css: ساختار متغیرهای شادکن حفظ شد؛ --primary سرمه‌ای سازمانی #1e2f4d (روشن‌تر #3b5378 در dark)، متغیرهای --gold (#b8860b) / --navy / پس‌زمینه‌های ملایم؛ body فونت Vazirmatn؛ کلاس جداول کلاسیک `.gov-table` (border-collapse، حاشیه نازک کامل، هدر سرمه‌ای با متن سفید، text-align راست)؛ اسکرول‌بار سفارشی؛ انیمیشن‌های gov-pulse (نقطه وضعیت اجرا) و gov-outline-pulse (نشان «نیازمند بررسی»)؛ استایل جعبه نقل‌قول شاهد `.evidence-quote` با خط طلایی
- src/lib/admin-types.ts: تمام اشکال API با TypeScript دقیق (StatsResponse, RegionsResponse, Job, CompaniesResponse, CompanyDetail + زیرمدل‌ها، QueueResponse به‌صورت union، CoverageResponse، AuditResponse)
- src/lib/fa-utils.ts: قالب‌بندی fa-IR (faNum/faDigits/faDate/faDateTime/faPercent) + نقشه‌های برچسب فارسی (مالکیت/فعالیت/بررسی/وضعیت کار/مرحله/نوع محل/نوع تماس/سمت/نوع منبع/موجودیت حسابرسی/عامل/نقشه fieldName→فارسی) + COMPANY_TYPE_OPTIONS
- src/hooks/use-api.ts: هوک سبک useApi<T>(url, deps) با loading مشتق‌شده (سازگار با قانون react-hooks/set-state-in-effect)، خطای فارسی از بدنه {error} سرور، refetch با tick؛ apiRequest برای mutations با پرتاب خطای فارسی
- src/components/admin/: header.tsx (سربرگ سرمه‌ای با نوار طلایی ۳px، نشان Building2 طلایی، منوی Dropdown «خروجی اکسل» با خروجی کامل/استانی، دکمه بازخوانی، نشانگر کارهای در حال اجرا با نقطه تپنده → پرش به زبانه اجراها)، export-dialog.tsx (انتخاب استان → /api/export?scope=province با encodeURIComponent)، status-badges.tsx (نشان‌های مالکیت دولتی=سرمه‌ای/نیمه‌دولتی=کهربایی/خصوصی=زمردی/نامشخص=خاکستری، فعال/نیمه‌فعال/غیرفعال، تأییدشده/استخراج هوشمند/ردشده، وضعیت کار با نقطه تپنده، درصد اطمینان رنگی ≥۸۰ زمردی/۶۰–۷۹ کهربایی/<۶۰ سرخ)، dashboard.tsx (۶ کارت آماری + پوشش استانی با Progress + حالت خالی با تشریح خط لوله ۴مرحله‌ای ایجنت)، new-job.tsx (چندانتخابی استان‌ها با Popover+Command و چیپ‌های Badge قابل حذف، چیپ‌های شهر + افزودن شهر سفارشی با Enter، چک‌باکس‌های نوع مجموعه، Textarea کوئری‌های دستی، سقف درخواست‌ها با متن راهنما، Alert قواعد طلایی، اعتبارسنجی «انتخاب حداقل یک استان الزامی است»، دکمه‌های شروع اجرا/ذخیره بدون اجرا)، jobs.tsx (نظرسنجی ۴ثانیه‌ای فقط هنگام running|stopping، جدول ۸ستونه با پیشرفت/آمار/بودجه، عملیات شروع/توقف/ادامه/جزئیات، دیالوگ جزئیات با آکاردئون کوئری‌ها ✓/○، نامزدها، خطاها با زمان فارسی)، companies.tsx (۷ فیلتر + سوییچ «فقط نیازمند بررسی»، جدول ۹ستونه، صفحه‌بندی فارسی، Tooltip دلیل بررسی)، company-detail.tsx (شیت کناری با عنوان/نشان‌ها همیشه‌رندر برای دسترس‌پذیری، ۴ گفت‌وگوی تأیید/رد/ویرایش/ادغام — ویرایش و ادغام با اعتبارسنجی سمت کاربر «ثبت دلیل … الزامی است»، بلوک شواهد هر فیلد با چیپ «شاهد: اطمینان ۹۰٪» + آکاردئون نقل‌قول + منبع/ناشر/نوع منبع/لینک خارجی/target_blank + تأیید/رد شاهد + نشان تعارض، جداول محل/تماس/مسئولان، فهرست کمیته امداد، تاریخچه تغییرات)، queues.tsx (۴ زیرزبانه: نامطمئن‌ها با ستون دلیل، تعارض منابع گروه‌بندی‌شده بر companyId+fieldName با «تأیید این نسخه»، تکراری‌ها با RadioGroup «رکورد اصلی» + ادغام بقیه با دلیل ثابت، فیلدهای فاقد اطلاعات با کارت آمار و چیپ نمونه‌ها)، coverage.tsx (کارت‌های منابع + جدول پوشش استانی + Alert طلایی تذکر پوشش)، audit-log.tsx (فیلتر نوع موجودیت + جدول ScrollArea با نقشه موجودیت/عامل فارسی)
- src/app/page.tsx: پوسته root با dir=rtl و bg-[#f6f7f9]، min-h-screen flex flex-col + footer mt-auto (پانوشت چسبان)، Tabs کنترل‌شده ۷زبانه با نوار اسکرول‌پذیر موبایل، شیت جزئیات در سطح صفحه (مشترک بین شرکت‌ها و صف بررسی)، نظرسنجی آمار فقط هنگام اجرای فعال، شمارنده اجراهای فعال از max(stats, زبانه اجراها)
- اصلاحات حین راستی‌آزمایی: رفع خطای react-hooks (setState در effect، ref در render، interface خالی)، رفع هشدار دسترس‌پذیری Radix با انتقال SheetHeader/SheetTitle بیرون از شرط loading، فارسی‌سازی sr-only «Close» شیت به «بستن»
- محدودیت رعایت‌شده: هیچ کار کراول جدیدی شروع/ادامه نشد (بودجه جست‌وجوی کارفرما حفظ شد)؛ هیچ فایل بک‌اندی تغییر نکرد

Verification (agent-browser):
- باز شدن / با عنوان فارسی، dir=rtl، lang=fa — بدون خطای کنسول
- هر ۷ زبانه کلیک و اسنپ‌شات شد؛ داشبورد اعداد واقعی بک‌اند: کل ۷، تأییدشده ۱، استخراج هوشمند ۶، پوشش یزد ۶/البرز ۱، آخرین بررسی ۶ آبان ۱۴۰۵
- شرکت‌ها: فیلتر ownership=unknown اعمال شد (۷ ردیف)؛ کلیک ردیف اول → شیت جزئیات با شواهد واقعی (نقل‌قول «شرکت شهرک های صنعتی استان یزد»، اطمینان ۹۰–۱۰۰٪، لینک منبع target=_blank)؛ گفت‌وگوی ویرایش با دلیل خالی → خطای درون‌خطی «ثبت دلیل ویرایش الزامی است»
- اجراها: کار «تست دود» (متوقف‌شده) با پیشرفت ۲۲٪ (۲۹/۱۳۴)، بودجه ۴۵/۴۵، دیالوگ جزئیات با ۲۰ کوئری و ۱۱۴ نامزد باز شد
- صف بررسی: ۴ زیرزبانه رندر شد (سه صف خالی واقعی + «فیلدهای فاقد اطلاعات» با وب‌سایت۶/شناسه ملی۵/مدیرعامل۴ و چیپ‌های نمونه)
- گزارش پوشش: منابع ۲۰، جدول استانی، Alert طلایی؛ تاریخچه تغییرات: رکوردهای واقعی agent/human با زمان شمسی
- خروجی اکسل: منوی هدر → «خروجی کامل» درخواست GET /api/export?scope=all با ۲۰۰ (curl: content-type صحیح xlsx، ۱۶۳۱۷ بایت)؛ «خروجی استانی» با انتخاب یزد → GET /api/export?scope=province&province=%DB%8C%D8%B2%D8%AF با ۲۰۰
- موبایل ۳۷۵px: بدون سرریز افقی صفحه؛ جداول داخل wrapperهای overflow-x-auto
- bun run lint پاک؛ tsc --noEmit برای فایل‌های فرانت‌اند بدون خطا؛ dev.log بدون خطای جدید

Backend notes (فقط گزارش — تغییر داده نشد):
- src/lib/normalize.ts خط ۱۸۵: safeCell با امضای بازگشت string در حالت عددی خودِ number را برمی‌گرداند (TS2321 در tsc --noEmit؛ بی‌اثر در زمان اجرا چون ExcelJS عدد را می‌پذیرد) — پیشنهاد: `return Number.isFinite(value) ? String(value) : ''`
- پاسخ‌های GET تمام مسیرهای مصرف‌شده مطابق قرارداد Task 1 بودند؛ هیچ ناسازگاری شکل داده یافت نشد

---
Task ID: 5
Agent: main (Z.ai)
Task: راستی‌آزمایی نهایی سیستم کامل، رفع باگ باقی‌مانده و تحویل

Work Log:
- باگ گزارش‌شده Task 2 اصلاح شد: safeCell در src/lib/normalize.ts برای ورودی number اکنون String(value) برمی‌گرداند (رفع خطای تایپ)
- bun run lint: پاک
- dev.log: فقط درخواست‌های 200، بدون خطای runtime
- بررسی مرورگری کامل با agent-browser انجام شد:
  * داشبورد: ۶ کارت آمار واقعی (کل ۷، تأییدشده ۱، استخراج هوشمند ۶) + پوشش استانی
  * شرکت‌ها: جدول با شرکت‌های واقعی (شرکت شهرک‌های صنعتی استان یزد، فولاد الماس یزد، کولر گستر یزد) + فیلترها + صفحه‌بندی
  * شیت جزئیات شرکت: فیلدهای نامشخص = «نامشخص»، چیپ شاهد با اطمینان، آکاردئون شاهد شامل نقل‌قول مستقیم + ناشر + لینک منبع + تاریخ + دکمه تأیید/رد
  * اجراها: کار «تست دود» متوقف‌شده، پیشرفت ۲۲٪ (۲۹/۱۳۴)، بودجه ۴۵/۴۵، دکمه ادامه/جزئیات
  * فرم اجرای جدید: انتخاب استان (الزامی)، شهرها، نوع مجموعه، سقف درخواست
  * صف بررسی (۴ زیرتب)، گزارش پوشش (۲۰ منبع بررسی‌شده، جدول استانی، هشدار طلایی عدم ادعای پوشش ۱۰۰٪)، تاریخچه تغییرات با AuditLog واقعی
  * بدون خطای کنسول مرورگر
- خروجی اکسل با openpyxl راستی‌آزمایی شد: ۴ شیت (Sheet1 قالب اصلی + اطلاعات تکمیلی + منابع و شواهد + گزارش اجرا)، همه RTL=True، عنوان A1:J2 صحیح، داده از ردیف ۶
- فایل‌های تحویلی در /home/z/my-project/download/: نمونه-خروجی-اکسل.xlsx + ۸ اسکرین‌شات راستی‌آزمایی

Stage Summary:
- سیستم کامل، قابل اجرا و راستی‌آزمایی‌شده: ایجنت هوشمند ۴مرحله‌ای + پنل مدیریت فارسی RTL + پایگاه داده ۹ جدولی + خروجی اکسل مطابق kolfile.xlsx
- آماده تحویل به کارفرما؛ صفحه / تنها مسیر کاربر است
