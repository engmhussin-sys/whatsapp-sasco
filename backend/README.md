# WorkForce Connect AI — Backend (NestJS)

API الحقيقي لكامل المنصة. Multi-Tenant، Prisma/PostgreSQL، WebSocket، محركا Task/Approval العامّان،
ووحدات قطاع محطات الوقود (Shift/Station/Tank/Inspection/FuelRequest).

## المتطلبات
- Node.js 20+
- PostgreSQL 16 (أو عبر Docker)
- Redis 7 (أو عبر Docker) — محجوز حاليًا لطبقة الـ caching/queues في المرحلة الثانية

## التثبيت والتشغيل محليًا

```bash
cp .env.example .env        # عدّل القيم حسب بيئتك (أسرار JWT خاصة، إلخ)
docker-compose up -d        # يشغّل Postgres + Redis فقط
npm install
npx prisma generate
npx prisma migrate dev      # ينشئ الجداول من prisma/schema.prisma
npm run start:dev           # http://localhost:3000
```

Swagger (توثيق API تفاعلي حي): `http://localhost:3000/api/docs`

## الاختبارات
```bash
npm test                 # اختبارات الوحدة (46 اختبار حاليًا)
npm run lint
npm run build             # تحقق TypeScript كامل + بناء الإنتاج
```

## متغيرات البيئة (`.env.example`)
| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | رابط اتصال PostgreSQL |
| `REDIS_URL` | رابط اتصال Redis |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | توقيع/مدة صلاحية الـ Access Token |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | توقيع/مدة صلاحية الـ Refresh Token |
| `CORS_ORIGIN` | نطاقات الـ Frontend المسموح بها |
| `PORT` | منفذ تشغيل الـ API |

## Docker
```bash
docker build -t wfc-backend .
docker run -p 3000:3000 --env-file .env wfc-backend
```
أو استخدم `docker-compose.yml` في جذر المستودع لتشغيل الحزمة كاملة.

## البنية
راجع `docs/architecture-diagram.md` و`docs/database-erd.md` في جذر المستودع للتفاصيل الكاملة.
