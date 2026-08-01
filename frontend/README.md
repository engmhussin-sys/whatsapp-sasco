# WorkForce Connect AI — Frontend (Next.js)

واجهة الويب لمنصة WorkForce Connect AI. تتصل مباشرة بالـ Backend الحقيقي (لا Mock Data) —
كل استدعاء API يمرّ عبر `NEXT_PUBLIC_API_URL` من البيئة حصريًا، لا يوجد أي رابط ثابت داخل الكود.

## المتطلبات
- Node.js 20 (راجع `.nvmrc`)
- Backend يعمل محليًا (راجع `../backend/README.md`) أو عنوان API بعيد (Railway)

## التثبيت والتشغيل محليًا

```bash
cp .env.local.example .env.local     # Next.js يحمّله تلقائيًا، ومُستبعَد من git
npm install
npm run dev                          # http://localhost:3001
```

## متغيرات البيئة
| الملف | الاستخدام |
|---|---|
| `.env.local.example` | انسخه إلى `.env.local` للتطوير المحلي |
| `.env.example` | نفس المتغيرات، مرجع لضبط Build Arguments على Railway |

| المتغير | الوصف |
|---|---|
| `NEXT_PUBLIC_API_URL` | عنوان REST API الخاص بالـ Backend (يجب أن يتضمن `/api/v1`) |
| `NEXT_PUBLIC_WS_URL` | عنوان WebSocket الخاص بالـ Backend (بدون مسار) |

## البناء للإنتاج
```bash
npm run build
npm start
```

## Docker
```bash
docker build -t wfc-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 \
  --build-arg NEXT_PUBLIC_WS_URL=https://api.example.com \
  .
docker run -p 3001:3000 wfc-frontend
```

## النشر على Railway
`railway.json` جاهز في هذا المجلد. الخطوات الكاملة في `../docs/deployment-guide.md`.
**تذكير**: متغيرات `NEXT_PUBLIC_*` تُضمَّن وقت البناء في Next.js — يجب ضبطها
كـ Build Arguments على Railway، وليس فقط كمتغيرات تشغيل عادية.

## الحالة الحالية (MVP Sprint)
✅ جميع الشاشات المطلوبة لهذا الـ Sprint جاهزة للاستخدام الفعلي: Login،
Dashboard، Companies، Stations، Teams، Users، Messaging، Tasks، Approvals، Shifts.

## البنية
```
src/
  app/
    login/ forgot-password/ reset-password/
    super-admin/{dashboard,companies,subscription}/
    company-admin/{dashboard,users,teams,stations,roles}/
    messaging/  tasks/{approvals,shifts}/
  components/          — مكوّنات مشتركة (ProtectedRoute, DashboardShell, ...)
  lib/
    api-client.ts      — طبقة اتصال REST حقيقية (لا Mock)، مع تجديد Access Token تلقائيًا
    auth-context.tsx   — إدارة حالة تسجيل الدخول
    token-store.ts     — تخزين الجلسة (localStorage)
    types.ts           — أنواع TypeScript مطابقة لـ DTOs الـ Backend
    api/                — وحدات نداء API مقسّمة حسب الميزة (companies, users, stations, tasks, messaging)
```
