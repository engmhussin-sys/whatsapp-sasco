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

## متجدد: مشاكل حقيقية واجهناها عند النشر الفعلي على Railway، وإصلاحاتها

القسم التالي يوثّق مشكلتين واجهناهما فعليًا عند أول محاولة نشر حقيقية على
Railway (وليس نظريًا) — احتفظ به كمرجع إن واجهت نفس الأعراض.

### المشكلة 1: Railway (Railpack) يفحص جذر المستودع بدلاً من `backend/`

**العرض:** فشل البناء فورًا، أو Railway يحاول اكتشاف نوع مشروع خاطئ (يبحث
عن `package.json` في الجذر بدل `backend/package.json`)، رغم ضبط **Root
Directory** = `backend` في إعدادات الخدمة.

**السبب:** Railpack (المُحلِّل الافتراضي الجديد لدى Railway) قد **يتجاهل**
إعداد Root Directory أثناء مرحلة اكتشاف نوع المشروع تحديدًا في بعض
المستودعات أحادية الشكل (Monorepo)، حتى لو كان الإعداد محفوظًا فعليًا في
تهيئة الخدمة (يمكن التأكد بأداة "Deployment Info" في Railway).

**الإصلاح (تأكّدنا أنه يعمل فعليًا):**
1. من إعدادات الخدمة على Railway: **Settings → Source → Root Directory** = `backend` (أو `frontend`)
2. **إجباري ومهم**: **Settings → Build → Builder** = اختر **Dockerfile** صراحةً (لا تترك الاكتشاف التلقائي/Railpack يقرر)
3. **Settings → Build → Dockerfile Path** = `Dockerfile`
4. أعد النشر، وتحقّق من أول سطر في build logs: يجب أن يكون
   `[internal] load build definition from Dockerfile` (وليس مسارًا يشير لجذر
   المستودع). **إن ظهر المسار بدون أن يجد الملف**، جرّب القيمة `backend/Dockerfile`
   بدلًا من `Dockerfile` في نفس الحقل — لوحظ اختلاف في تفسير Railway لهذا
   المسار (نسبي إلى Root Directory أحيانًا، ونسبي إلى جذر المستودع أحيانًا
   أخرى) حسب كيفية إنشاء الخدمة أول مرة.

`backend/railway.json` و`frontend/railway.json` المُرفَقان بالفعل يحدّدان
`"builder": "DOCKERFILE"` صراحةً — لكن كما لاحظنا، إعدادات لوحة التحكم قد
تحتاج ضبطًا يدويًا مطابقًا أيضًا عند إنشاء الخدمة لأول مرة قبل أن يُقرأ هذا
الملف بشكل موثوق.

### المشكلة 2: خطأ TypeScript أثناء البناء — `Module '"@prisma/client"' has no exported member 'TaskFieldType'`

**التشخيص الأول (خاطئ، تم تصحيحه):** افترضنا في البداية أن السبب هو ترتيب
خطوات `Dockerfile` (نسخ الكود المصدري قبل/بعد `prisma generate`)، وأعدنا
الترتيب لنمط "انسخ كل شيء أولًا، ثم `generate && build` معًا". **بعد محاولة
نشر فعلية جديدة بهذا الإصلاح، ظهر نفس الخطأ تمامًا**، رغم أن سجلّ البناء أثبت
أن `prisma generate` نجح فعليًا (`✔ Generated Prisma Client`). هذا نفى
فرضية الترتيب تمامًا.

**السبب الحقيقي المؤكَّد:** كان `TaskFieldType` معرَّفًا كـ Prisma enum داخل
`schema.prisma`، لكنه **لم يكن مُستخدَمًا كنوع عمود فعلي في أي Model** —
حقل `TaskTemplate.fields` من نوع `Json` يُخزِّن تعريفات الحقول الديناميكية
دون أن يشير فعليًا لهذا الـ enum كنوع بيانات لعمود حقيقي. **Prisma تُسقِط
تلقائيًا وبصمت أي enum معرَّف لكن غير مُستخدَم كنوع عمود من مخرجات
`prisma generate`** — سلوك مُوثَّق لدى Prisma وليس خطأً عشوائيًا. هذا
يُفسِّر بدقة لماذا نجح `generate` بلا أي رسالة خطأ، بينما ظل الـ enum غائبًا
عن الأنواع المُصدَّرة فعليًا.

**الإصلاح الدائم المُطبَّق:** فصل `TaskFieldType` عن Prisma تمامًا —
أصبح الآن TypeScript enum عاديًا معرَّفًا محليًا في
`backend/src/modules/task-engine/task-field-type.enum.ts`، وحُذف نهائيًا
من `schema.prisma`. هذا هو الحل الأصح معماريًا أيضًا، لأن هذا النوع لم يكن
حقًا مفهومًا على مستوى قاعدة البيانات أصلًا، بل اصطلاح تحقّق على مستوى
التطبيق فقط لبيانات JSON.

**✅ تم التحقق من هذا الإصلاح بدقة أكبر من أي إصلاح سابق في هذا المشروع:**
أعدت بناء بيئة الاختبار المحلية (stub) لتُطابق تمامًا سلوك Prisma الحقيقي
(بدون `TaskFieldType` ضمن الأنواع المُصدَّرة، تمامًا كما يحدث فعليًا)،
وشغّلت **نفس أمر البناء الحقيقي** (`npm run build` عبر `nest build`، وليس
`tsc --noEmit` فقط)، ثم **شغّلت الخادم المُترجَم فعليًا** وأرسلت طلبات HTTP
حقيقية تلقّت استجابات ناجحة من `/api/v1/health` و`/api/docs`. هذا لا يزال
لا يُغني عن تأكيد النشر الفعلي على Railway (لأن `prisma generate` نفسه ما
زال غير قابل للتشغيل في بيئتي)، لكنه أعلى مستوى تحقق ممكن تحقيقه محليًا.

**درس عام مهم لأي Enum تُضاف مستقبلًا:** أي enum جديد يُضاف إلى
`schema.prisma` **يجب** أن يُستخدَم كنوع عمود فعلي على الأقل في Model واحد،
وإلا فلن يظهر في العميل المُولَّد إطلاقًا. إن كانت الحاجة فقط للتحقق على
مستوى التطبيق (كما في هذه الحالة)، فالحل الصحيح تعريف TypeScript enum محلي
منفصل تمامًا عن Prisma، وليس الاعتماد على `schema.prisma` كمصدر له.

### المشكلة 3 (استباقية): تحذير `Prisma failed to detect the libssl/openssl version`

ظهر هذا التحذير في نفس سجلّ البناء الذي أُرسِل أثناء تشخيص المشكلة 2، ولم
يكن سبب فشل البناء، لكنه **خطر حقيقي منفصل على مستوى وقت التشغيل**: إن
أخطأت Prisma في تخمين نسخة OpenSSL، قد تُحمِّل محرك الاستعلام (Query Engine)
الثنائي الخاطئ، مما قد يُسبب تعطّل التطبيق عند أول استعلام فعلي لقاعدة
البيانات — بعد نجاح النشر ظاهريًا.

**الإصلاح الاستباقي المُطبَّق:** أُضيف `binaryTargets` صراحةً في
`generator client` ضمن `schema.prisma` (`"native"` للتطوير المحلي،
`"linux-musl-openssl-3.0.x"` لبيئة `node:20-alpine` المُستخدَمة في
الإنتاج) بدلًا من الاعتماد على اكتشاف Prisma التلقائي.

**⚠️ لم يُتحقَّق منه فعليًا بعد** — راقب سجلّ النشر القادم للتأكد من زوال هذا
التحذير تمامًا (لاحظ أنه استمر بالظهور في سجلّ المشكلة 4 أدناه، لأن ذلك
السجلّ من نفس محاولة النشر قبل تأكيد أثر هذا الإصلاح).

### المشكلة 4: `Error: Prisma schema validation ... Environment variable not found: DATABASE_URL`

**هذا تقدّم حقيقي مهم**: ظهور هذا الخطأ يعني أن **البناء (Build) نجح بالكامل**
هذه المرة (لا مزيد من أخطاء TypeScript) — المشكلة الآن في **مرحلة التشغيل
(Runtime)** فقط، وهي إعداد بسيط في لوحة Railway وليست خطأ في الكود.

**السبب:** متغيّر البيئة `DATABASE_URL` غير مضبوط أصلًا في إعدادات خدمة
الـ Backend على Railway، فيفشل `npx prisma db push` فور محاولة الاتصال.

**الإصلاح (خطوات دقيقة في لوحة Railway):**
1. تأكّد من وجود إضافة **PostgreSQL** في نفس مشروع Railway (**+ New → Database → PostgreSQL** إن لم تكن موجودة)
2. من خدمة الـ Backend: **Variables** tab → **+ New Variable**
3. الاسم: `DATABASE_URL`
4. القيمة: **لا تكتبها يدويًا** — استخدم مرجعًا لخدمة Postgres عبر زر "Add Reference" أو بكتابة:
   ```
   ${{Postgres.DATABASE_URL}}
   ```
   (استبدل `Postgres` باسم خدمة قاعدة البيانات الفعلي كما يظهر في مشروعك على Railway إن كان مختلفًا)
5. كرّر نفس الشيء لبقية المتغيرات المطلوبة (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, إلخ — الجدول الكامل في القسم 3 أعلاه)
6. أعد النشر (Redeploy)

**تحسين أُضيف للكود بعد هذا الاكتشاف:** كان الخطأ يتكرر بصيغة مُبهَمة (`P1012`)
مع كل محاولة إعادة تشغيل تلقائية من Railway. أضفنا فحصًا استباقيًا في
`Dockerfile` و`railway.json` يفشل فورًا برسالة واضحة ("FATAL: DATABASE_URL
is not set...") بدل ترك Prisma تُكرِّر رسالة الخطأ المُبهَمة — هذا لا يُصلح
سبب المشكلة (يبقى إعدادًا على لوحة Railway) لكنه يجعل تشخيصها أسرع بكثير
في المرة القادمة.

### المشكلة 5: `The executable "if" could not be found` — السبب الجذري لكل محاولات إصلاح المشكلة 4

**العرض:** بعد إضافة الفحص الاستباقي لـ `DATABASE_URL` (المشكلة 4)، فشل
النشر فورًا في خطوة "Deploy → Create container" (وليس أثناء تشغيل الحاوية)
برسالة: `The executable "if" could not be found`.

**السبب الحقيقي:** **Railway لا يُمرِّر قيمة `startCommand` عبر أي Shell
إطلاقًا** — بل يُقسِّمها مباشرة إلى قائمة كلمات مفصولة بمسافات وينفّذها
كـ exec مباشر (تمامًا كما يفعل Docker مع الصيغة `CMD ["exe", "arg1", ...]`).
لذلك أي منطق Shell (`if`/`then`/`fi`/`&&`) داخل `startCommand` **سيفشل
دائمًا** بنفس الطريقة، بغض النظر عن صحة صياغته النحوية — لأن Railway يحاول
تنفيذ الكلمة الأولى (`if`) كاسم برنامج تنفيذي مباشرة، وهو ليس كذلك.

**الإصلاح الجذري:** نقل كل منطق التشغيل (فحص `DATABASE_URL`، `prisma db
push`، تشغيل الخادم) إلى ملف حقيقي `backend/start.sh`، بحيث يصبح أمر
التشغيل نفسه — في كل من `Dockerfile` CMD و`railway.json` — كلمتين فقط:
`sh start.sh`. هذا محصّن تمامًا ضد هذا النوع من الاختلاف في طريقة التحليل
(سواء عبر Shell أو exec مباشر)، لأن `sh` برنامج تنفيذي حقيقي و`start.sh`
مجرد مسار كوسيط له — لا يوجد أي رمز Shell معقّد يمكن أن يُفسَّر خطأً بعد الآن.

**✅ تم اختبار `start.sh` فعليًا ومباشرة** في بيئتي (كملف قائم بذاته، وليس
عبر Docker) في حالتَي غياب/وجود `DATABASE_URL`، وأعطى النتيجة الصحيحة في
كلتا الحالتين.

### المشكلة 6 (اكتُشفت أثناء اختبار `start.sh` محليًا، ولم تظهر بعد في سجلّات Railway): حزمة `prisma` (الأداة) كانت في `devDependencies`

**لماذا هذه مشكلة:** مرحلة الإنتاج في `Dockerfile` تُثبِّت الحزم عبر `npm
ci --omit=dev`، والتي تستبعد `devDependencies` بالكامل. بما أن `prisma`
(أداة سطر الأوامر، وليس `@prisma/client`) كانت مُصنَّفة كـ devDependency،
فإن استدعاء `npx prisma db push` داخل `start.sh` وقت التشغيل الفعلي كان
سيضطر لتحميل نسخة `prisma` من الإنترنت **في تلك اللحظة** (بطء + نقطة فشل
جديدة إن كانت الشبكة مقيَّدة) **وبنسخة قد تختلف تمامًا** عن النسخة
المُستخدَمة فعليًا لتوليد العميل وقت البناء (لاحظتُ محليًا أنها كانت
ستُحمِّل `prisma@7.9.1` بينما المشروع مبني على v5 — فارق إصدارين رئيسيين).

**الإصلاح:** نقل `prisma` من `devDependencies` إلى `dependencies` في
`package.json`. **تم التحقق فعليًا**: بعد التعديل، شغّلت `npm ci
--omit=dev` (محاكاة دقيقة لخطوة الإنتاج) وتأكدت أن `prisma` أصبحت متاحة
محليًا في `node_modules/.bin/prisma` دون أي حاجة لجلب شبكي.


لا تُطوَّر حاليًا: OCR، الذكاء الاصطناعي، Translation Cache، Image Analysis،
Offline Queue، Company Dictionary، توسيع مزوّدي الخدمة، أي تحسينات مستقبلية.
الكود الحالي لهذه الأجزاء **موجود ولم يُحذَف** لكنه لن يُوسَّع حتى يبدأ Sprint
تحسينات جديد بعد الاستخدام الفعلي.
