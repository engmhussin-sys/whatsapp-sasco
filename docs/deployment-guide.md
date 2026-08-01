# دليل النشر على Railway — WorkForce Connect AI (MVP)

هذا الدليل يغطي نشر نسخة قابلة للاستخدام فعليًا خلال دقائق، حسب النطاق المُعتمَد لهذا الـ Sprint.

## ⚠️ ملاحظة مهمة قبل البدء: Migrations

بيئة التطوير التي بُني بها هذا المشروع لم تستطع تحميل محرك Prisma الثنائي
(`binaries.prisma.sh` كان محجوبًا بسياسة شبكة تلك البيئة تحديدًا)، لذلك **لا
يوجد سجل Migrations فعلي** (`prisma/migrations/`) بعد — فقط `schema.prisma`.

لذلك يستخدم كل من `Dockerfile` و`railway.json` الأمر:
```
npx prisma db push --skip-generate
```
بدلاً من `prisma migrate deploy`. هذا يُزامن قاعدة البيانات مباشرة مع الـ
schema (آمن تمامًا لأول نشر على قاعدة بيانات فارغة)، لكنه **ليس نظام
Migrations حقيقيًا** (لا يوجد سجل تغييرات تاريخي).

**الخطوة الموصى بها بعد أول نشر ناجح** (على جهازك، حيث الشبكة كاملة):
```bash
cd backend
npx prisma migrate dev --name init   # يُنشئ prisma/migrations/ من الصفر مطابقًا للحالة الحالية
git add prisma/migrations && git commit -m "Add initial migration history"
```
ثم غيّر أمر التشغيل في `railway.json` و`Dockerfile` إلى `prisma migrate deploy`
للنشرات القادمة (أكثر أمانًا للتغييرات المستقبلية على الـ schema).

---

## الخطوات

### 1. إنشاء المشروع على Railway
1. سجّل دخول إلى [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo** → اختر هذا المستودع

### 2. قاعدة البيانات والـ Redis
داخل نفس المشروع على Railway:
1. **+ New** → **Database** → **PostgreSQL** — يُنشئ متغير `DATABASE_URL` تلقائيًا
2. **+ New** → **Database** → **Redis** — يُنشئ متغير `REDIS_URL` تلقائيًا (محجوز للمرحلة القادمة، غير مستخدَم فعليًا الآن)

### 3. خدمة Backend
1. **+ New** → **GitHub Repo** → اختر هذا المستودع، وحدّد **Root Directory: `backend`**
2. Railway سيكتشف `backend/railway.json` و`backend/Dockerfile` تلقائيًا
3. أضف متغيرات البيئة التالية (Settings → Variables):

| المتغير | القيمة |
|---|---|
| `DATABASE_URL` | اربطه بمتغير Postgres تلقائيًا (`${{Postgres.DATABASE_URL}}`) |
| `REDIS_URL` | اربطه بمتغير Redis تلقائيًا (`${{Redis.REDIS_URL}}`) |
| `JWT_ACCESS_SECRET` | قيمة عشوائية قوية (32+ حرفًا) — **غيّرها عن القيمة الافتراضية في `.env.example`** |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_SECRET` | قيمة عشوائية قوية أخرى مختلفة |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `CORS_ORIGIN` | رابط خدمة الـ Frontend على Railway (يُضاف بعد نشرها في الخطوة 4) |
| `PORT` | `3000` (Railway يوفّره تلقائيًا عادةً، لكن حدّده احتياطًا) |

4. بعد أول نشر ناجح، شغّل بيانات البذر (Seed) عبر Railway CLI أو من تبويب **Shell**:
```bash
npm run prisma:seed
```

### 4. خدمة Frontend
1. **+ New** → **GitHub Repo** → نفس المستودع، **Root Directory: `frontend`**
2. متغيرات البيئة (يجب تمريرها كـ **Build Arguments** أيضًا لأن Next.js يضمّنها وقت البناء):

| المتغير | القيمة |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<رابط-خدمة-Backend>.railway.app/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `https://<رابط-خدمة-Backend>.railway.app` |

3. ارجع لخدمة الـ Backend وحدّث `CORS_ORIGIN` بالرابط الفعلي لخدمة الـ Frontend

### 5. التحقق
- Backend: `https://<backend-url>/api/v1/health` → يجب أن يُرجع `{"status":"ok"}`
- Backend: `https://<backend-url>/api/docs` → توثيق Swagger الحي
- Frontend: `https://<frontend-url>/login` → سجّل الدخول بأحد حسابات البذر:

| الدور | البريد | كلمة المرور |
|---|---|---|
| Super Admin | `superadmin@workforceconnect.ai` | `Demo@12345` |
| Company Admin | `admin@demo-fuel-co.com` | `Demo@12345` |
| Team Lead (Supervisor) | `supervisor@demo-fuel-co.com` | `Demo@12345` |
| Worker | `worker@demo-fuel-co.com` | `Demo@12345` |

**غيّر كلمة المرور فورًا لكل حساب فعلي ستستخدمه — هذه بيانات بذر توضيحية فقط.**

### 6. تطبيق الجوال
`mobile/README.md` يوضّح كيفية البناء محليًا. عند التشغيل، مرّر:
```bash
flutter run \
  --dart-define=API_BASE_URL=https://<backend-url>/api/v1 \
  --dart-define=WS_BASE_URL=https://<backend-url>
```

---

## ما تم تجميده هذا الـ Sprint (بقرار صريح من إدارة المنتج)

لا تُطوَّر حاليًا: OCR، الذكاء الاصطناعي، Translation Cache، Image Analysis،
Offline Queue، Company Dictionary، توسيع مزوّدي الخدمة، أي تحسينات مستقبلية.
الكود الحالي لهذه الأجزاء **موجود ولم يُحذَف** لكنه لن يُوسَّع حتى يبدأ Sprint
تحسينات جديد بعد الاستخدام الفعلي.
