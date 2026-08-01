# WorkForce Connect AI — Frontend (Next.js)

واجهة الويب لمنصة WorkForce Connect AI. تتصل مباشرة بالـ Backend الحقيقي (لا Mock Data).

## المتطلبات
- Node.js 20+
- Backend يعمل محليًا (راجع `../backend/README.md`) أو عنوان API بعيد

## التثبيت والتشغيل

```bash
cp .env.example .env.local     # عدّل NEXT_PUBLIC_API_URL حسب عنوان الـ Backend
npm install
npm run dev                    # يعمل على http://localhost:3001
```

## متغيرات البيئة (`.env.example`)
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

## الحالة الحالية (Part 1 من التسليم)
- ✅ Authentication: Login / Logout / Forgot Password / Reset Password — متصلة فعليًا بالـ API
- ⏳ Dashboards (Super Admin / Company Admin)، Messaging، Tasks — قيد الإنشاء في الأجزاء التالية من نفس الجولة

## البنية
```
src/
  app/                — App Router pages
    login/
    forgot-password/
    reset-password/
  components/          — مكوّنات مشتركة (ProtectedRoute, ...)
  lib/
    api-client.ts      — طبقة اتصال REST حقيقية (لا Mock)، مع تجديد Access Token تلقائيًا
    auth-context.tsx   — إدارة حالة تسجيل الدخول
    token-store.ts      — تخزين الجلسة (localStorage)
    types.ts            — أنواع TypeScript مطابقة لـ DTOs الـ Backend
```
