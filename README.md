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

## الحالة الحالية — المرحلة الأولى (Foundation)
| الجزء | الحالة |
|---|---|
| Backend (18 Module، 46 اختبار ناجح) | ✅ مكتمل |
| Frontend — Authentication | ✅ مكتمل (متصل بالـ API الحقيقي) |
| Frontend — Dashboards/Messaging/Tasks | ⏳ قيد الإنشاء (أجزاء تالية من نفس التسليم) |
| Mobile (Flutter) | ⏳ قيد الإنشاء |
| Docker (لكل مشروع + docker-compose) | ✅ مكتمل |
| CI (GitHub Actions) | ✅ مكتمل (backend-ci, frontend-ci, mobile-ci) |

راجع `docs/architecture-diagram.md` للتفاصيل الكاملة.

