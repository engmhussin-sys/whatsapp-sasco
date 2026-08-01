# WorkForce Connect AI — Backend (NestJS)

API الحقيقي لكامل المنصة. Multi-Tenant، Prisma/PostgreSQL، WebSocket، محركا Task/Approval العامّان،
ووحدات قطاع محطات الوقود (Shift/Station/Tank/Inspection/FuelRequest).

## المتطلبات
- Node.js 20 (راجع `.nvmrc` — `nvm use` يضبطها تلقائيًا)
- PostgreSQL 16 (أو عبر Docker)
- Redis 7 (أو عبر Docker) — محجوز حاليًا، غير مُستخدَم فعليًا في هذا الـ Sprint

## التثبيت والتشغيل محليًا

```bash
cp .env.example .env        # عدّل القيم حسب بيئتك (أسرار JWT، CORS_ORIGIN، إلخ)
docker-compose up -d postgres redis   # من جذر المستودع — يشغّل Postgres + Redis فقط
npm install
npx prisma generate
npx prisma db push          # يُزامن الجداول مع schema.prisma مباشرة
npm run prisma:seed         # بيانات تجريبية كاملة — راجع README الجذر، القسم 5
npm run start:dev           # http://localhost:3000
```

⚠️ **لا يوجد سجل Migrations حقيقي بعد** (`prisma/migrations/`) — راجع القسم
السادس من README الجذر لسبب ذلك وخطوة توليده لاحقًا. `npx prisma migrate dev`
سيعمل بشكل طبيعي على جهازك (خلافًا لبيئة إعداد هذا المشروع) وسيُنشئ السجل من الصفر.

Swagger (توثيق API تفاعلي حي): `http://localhost:3000/api/docs`
Health check: `http://localhost:3000/api/v1/health`

## الاختبارات
```bash
npm test                 # 82 اختبار وحدة
npm run lint
npm run build             # تحقق TypeScript كامل + بناء الإنتاج
```

## متغيرات البيئة (`.env.example`)
| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | رابط اتصال PostgreSQL |
| `REDIS_URL` | رابط اتصال Redis (محجوز، غير مُستخدَم فعليًا بعد) |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | توقيع/مدة صلاحية الـ Access Token |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | توقيع/مدة صلاحية الـ Refresh Token |
| `CORS_ORIGIN` | نطاقات الـ Frontend المسموح بها، مفصولة بفواصل — **لا قيمة افتراضية آمنة في الإنتاج، اضبطها صراحة** |
| `PORT` | منفذ تشغيل الـ API |

## Docker
```bash
docker build -t wfc-backend .
docker run -p 3000:3000 --env-file .env wfc-backend
```
الحاوية تُشغّل `prisma db push` ثم `npm run start:prod` تلقائيًا عند الإقلاع (راجع `Dockerfile`).
أو استخدم `docker-compose.yml` في جذر المستودع لتشغيل الحزمة كاملة.

## النشر على Railway
`railway.json` جاهز في هذا المجلد. الخطوات الكاملة في `docs/deployment-guide.md`.

## البنية
راجع `docs/architecture-diagram.md` و`docs/database-erd.md` في جذر المستودع للتفاصيل الكاملة.
