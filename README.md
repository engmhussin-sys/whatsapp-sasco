# WorkForce Connect AI

منصة SaaS متعددة الشركات (Multi-Tenant) لتواصل وتشغيل فرق العمل متعددة اللغات،
تبدأ بمحطات الوقود كأول قطاع تطبيقي فوق محركين عامّين (Task Engine + Approval Engine).

## بنية المستودع
```
workforce-connect-ai/
  backend/       — NestJS + Prisma + PostgreSQL (API الحقيقي)
  frontend/      — Next.js (واجهة الويب)
  mobile/        — Flutter (تطبيق الجوال) — قيد الإنشاء
  docs/          — ERD، Architecture Diagram، تقارير المراجعة الأمنية
  deployment/    — ملفات نشر إضافية (Kubernetes وغيرها لاحقًا في المرحلة 3)
  .github/workflows/ — GitHub Actions (Backend CI / Frontend CI / Mobile CI)
  docker-compose.yml — تشغيل كامل الحزمة محليًا (Postgres + Redis + Backend + Frontend)
```

## التشغيل السريع (كل الخدمات معًا)
```bash
docker-compose up --build
```
- Backend API: http://localhost:3000/api/v1 (Swagger: `/api/docs`)
- Frontend: http://localhost:3001

## التشغيل المنفصل لكل مشروع
راجع الـ README الخاص بكل مشروع:
- [`backend/README.md`](./backend/README.md)
- [`frontend/README.md`](./frontend/README.md)
- `mobile/README.md` (سيُضاف مع تسليم تطبيق الجوال)

## الحالة الحالية — MVP Sprint (منتج قابل للاستخدام الفعلي)
| الجزء | الحالة |
|---|---|
| Web Admin: Login/Dashboard/Companies/Stations/Teams/Users | ✅ مكتمل وجاهز للاستخدام الفعلي |
| Mobile: Login/Home/Conversations/Chat/Tasks/Shift/Fuel Request/Profile | ✅ مكتمل (بناءً على العمل السابق) |
| Backend لكل الشاشات أعلاه | ✅ مكتمل، 82/82 اختبار ناجح |
| Seed Data (حسابات تجريبية جاهزة) | ✅ `backend/prisma/seed.ts` |
| Railway Deployment | ✅ راجع `docs/deployment-guide.md` |

**مُجمَّد حاليًا بقرار صريح** (موجود في الكود، لن يُطوَّر حتى Sprint التحسينات القادم):
OCR، الذكاء الاصطناعي، Translation Cache، Image Analysis، Offline Queue،
Company Dictionary، توسيع مزوّدي الخدمة.

راجع `docs/architecture-diagram.md` للتفاصيل الكاملة، و`docs/deployment-guide.md` للنشر.

