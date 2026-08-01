# WorkForce Connect AI

منصة SaaS متعددة الشركات (Multi-Tenant) لتواصل وتشغيل فرق العمل متعددة اللغات،
بدأت بمحطات الوقود كأول قطاع تطبيقي. هذا الدليل يغطي **التشغيل الفعلي** للمشروع
(محليًا وعلى Railway) — وليس شرحًا معماريًا (لذلك راجع `docs/architecture-diagram.md`
لو أردت التفاصيل الداخلية).

---

## 1. بنية المستودع

```
workforce-connect-ai/
  backend/       — NestJS + Prisma + PostgreSQL (REST API + WebSocket)
  frontend/      — Next.js (لوحة تحكم الويب: Super Admin / Company Admin)
  mobile/        — Flutter (تطبيق العامل)
  docs/          — ERD، مخططات العمارة، أدلة النشر والمراجعات الأمنية
  .github/workflows/ — GitHub Actions (backend-ci, frontend-ci, mobile-ci)
  docker-compose.yml — تشغيل الحزمة الكاملة محليًا (Postgres + Redis + Backend + Frontend)
```

## 2. نطاق النسخة الحالية (MVP Sprint)

**شاشات جاهزة للاستخدام الفعلي (وليست Placeholder):**

| الجزء | الشاشات |
|---|---|
| Web Admin | Login، Dashboard، Companies، Stations، Teams، Users |
| Mobile | Login، Home، Conversations، Chat، Tasks، Open/Close Shift، Fuel Request، Profile |

**مُجمَّد بقرار صريح لهذا الـ Sprint** (الكود موجود ولم يُحذَف، لكن لن يُطوَّر
حتى Sprint تحسينات لاحق): OCR، الذكاء الاصطناعي، Translation Cache، Image
Analysis، Offline Queue، Company Dictionary، توسيع مزوّدي الخدمة.

---

## 3. التشغيل المحلي (أسرع طريق)

### المتطلبات
- Docker + Docker Compose (لم يُتحقَّق من هذا المسار فعليًا في بيئة إعداد هذا
  المشروع — راجع قسم "القيود" أدناه)
- **أو** بدون Docker: Node.js 20، PostgreSQL 16، (Redis اختياري — غير مُستخدَم فعليًا بعد)

### المسار أ: عبر Docker Compose
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker-compose up --build
```
- Backend: http://localhost:3000/api/v1 (Swagger: `/api/docs`، Health: `/api/v1/health`)
- Frontend: http://localhost:3001

### المسار ب: بدون Docker
```bash
# 1) Backend
cd backend
cp .env.example .env          # عدّل DATABASE_URL ليطابق Postgres لديك
npm install
npx prisma generate
npx prisma db push            # يُزامن الجداول مباشرة (راجع القسم 6 حول Migrations)
npm run prisma:seed           # يُنشئ بيانات تجريبية كاملة — راجع القسم 5
npm run start:dev             # http://localhost:3000

# 2) Frontend (طرفية جديدة)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3001
```

---

## 4. النشر على Railway

دليل كامل خطوة بخطوة في **[`docs/deployment-guide.md`](./docs/deployment-guide.md)**،
يغطي: إنشاء خدمتَي Backend/Frontend، ربط Postgres، متغيرات البيئة المطلوبة
لكل خدمة، إعداد CORS بين الخدمتين، وتشغيل الـ Seed بعد أول نشر.

---

## 5. بيانات تجريبية (Seed)

`npm run prisma:seed` (من داخل `backend/`) ينشئ مجموعة بيانات كاملة قابلة
للاستخدام فورًا — وليست بيانات وهمية جزئية:

- Super Admin على مستوى المنصة
- شركة تجريبية (Demo Fuel Company) بخطة اشتراك فعلية
- **محطتان** (الرياض وجدة)، كل منهما بخزانات وقود بمستويات حالية
- فريق واحد، مستخدم Team Lead (بدور Supervisor مخصّص)، ومستخدم Worker
- Approval Flow كامل خطوتين (Worker → Supervisor → Manager) لطلبات الوقود
- قالب مهمة ديناميكي (Open Shift Checklist) + **مهمة فعلية مُسنَدة** للعامل
- **طلب وقود فعلي** يمرّ حاليًا بخطوة موافقة المشرف (لتجربة شاشة Approvals فورًا)
- محادثة مباشرة بين Supervisor وWorker مع رسالة أولى

**كل الحسابات تستخدم نفس كلمة المرور: `Demo@12345`** — غيّرها فورًا لأي استخدام حقيقي.

| الدور | البريد الإلكتروني |
|---|---|
| Super Admin | `superadmin@workforceconnect.ai` |
| Company Admin | `admin@demo-fuel-co.com` |
| Team Lead (Supervisor) | `supervisor@demo-fuel-co.com` |
| Worker | `worker@demo-fuel-co.com` |

السكربت **idempotent** (يمكن تشغيله أكثر من مرة بأمان دون تكرار البيانات) —
باستثناء الـ Fuel Request والمهمة والمحادثة التجريبية التي تُنشأ مرة واحدة
فقط إن لم تكن موجودة مسبقًا.

---

## 6. حول Migrations (شفافية مهمة)

بيئة تطوير هذا المشروع لم تستطع تحميل محرك Prisma الثنائي (`binaries.prisma.sh`
كان محجوبًا بسياسة شبكة تلك البيئة تحديدًا)، لذلك **لا يوجد سجل Migrations
حقيقي** (`prisma/migrations/`) بعد — فقط `schema.prisma`. الـ Dockerfile
وRailway يستخدمان `prisma db push` (مزامنة مباشرة، آمنة لأول نشر على قاعدة
بيانات فارغة) بدلًا من `prisma migrate deploy`.

**اعتبر هذا دَينًا تقنيًا يجب سداده مبكرًا**، على جهازك حيث الشبكة كاملة:
```bash
cd backend
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "Add initial migration history"
```
ثم غيّر أمر التشغيل في `backend/Dockerfile` و`backend/railway.json` من
`db push` إلى `migrate deploy` للنشرات القادمة.

---

## 7. Environment Variables

| الملف | الاستخدام |
|---|---|
| `backend/.env.example` | مرجع كامل لكل متغيرات الـ Backend (قاعدة البيانات، JWT، CORS) |
| `frontend/.env.example` | مرجع لمتغيرات وقت البناء على Railway |
| `frontend/.env.local.example` | انسخه إلى `.env.local` للتطوير المحلي (Next.js يحمّله تلقائيًا) |
| `mobile/.env.example` | يُمرَّر عبر `--dart-define` عند التشغيل (راجع `mobile/README.md`) |

**Frontend لا يحتوي على أي URL ثابت داخل الكود** — كل استدعاء API يمرّ عبر
`process.env.NEXT_PUBLIC_API_URL` حصريًا (مع قيمة احتياطية لـ `localhost`
فقط لراحة التطوير المحلي، تُستبدَل دائمًا بقيمة البيئة الفعلية عند تعيينها).

## 8. CORS

`backend/src/main.ts` يقرأ `CORS_ORIGIN` كقائمة مفصولة بفواصل. **لا تعتمد
على قيمة افتراضية عامة (`*`)** — مواصفة CORS ترفض `*` أساسًا عند استخدام
`credentials: true`، لذلك القيمة الافتراضية عند عدم ضبط المتغير هي
`localhost` فقط (للتطوير)، ويجب ضبطه صراحة في الإنتاج ليشمل رابط الـ
Frontend على Railway (مثال كامل في `.env.example`).

---

## 9. الاختبارات والجودة

```bash
cd backend
npm test          # 82 اختبار وحدة
npm run lint
npm run build      # فحص TypeScript كامل + بناء الإنتاج

cd ../frontend
npm run lint
npm run build      # فحص TypeScript + بناء 19 صفحة
```

## 10. القيود البيئية المُفصَح عنها (لهذا المشروع تحديدًا)

بيئة تطوير هذا الكود فرضت قيود شبكة حجبت بعض عمليات التحقق الكاملة رغم أن
الكود نفسه رُوجع يدويًا بعناية:
- **Prisma Migrations**: لا يمكن توليدها (`binaries.prisma.sh` محجوب) — راجع القسم 6
- **Flutter**: لا يمكن تشغيل `flutter pub get`/`analyze`/`test`/`build` (`pub.dev` محجوب) — راجع `mobile/README.md`
- **Docker**: `docker`/`docker-compose` غير مثبَّتين في بيئة الإعداد — لم يُختبَر بناء الصور فعليًا، فقط رُوجعت يدويًا

**ما تم التحقق منه فعليًا وليس افتراضًا**: Backend (`tsc` + 82 اختبار Jest +
إقلاع DI Container الكامل)، Frontend (`next build` لـ 19 صفحة + `next lint`).
