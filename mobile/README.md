# WorkForce Connect AI — Mobile (Flutter)

تطبيق الجوال الأساسي لمنصة WorkForce Connect AI، ببنية Clean Architecture + Feature-First،
يتصل بنفس الـ Backend الحقيقي المستخدَم في تطبيق الويب — **بدون أي بيانات وهمية (Mock Data)**.

## ⚠️ ملاحظة مهمة حول التحقق

هذا المشروع **لم يُبنَ أو يُختبَر فعليًا** داخل بيئة التطوير التي أنشأت هذا الكود، لأن
`pub.dev` و`storage.googleapis.com` (مصدرا Flutter SDK وحزم pub) كانا محجوبَين بسياسة
شبكة تلك البيئة. تم كتابة الكود بعناية يدوية قصوى، مع فحوصات ثابتة (static checks) للتأكد
من:
- صحة كل مسارات `import`/`part` (لا توجد مسارات مكسورة)
- تصريح كل حزمة مُستوردة في `pubspec.yaml`
- تطابق كل استدعاء `sl<T>()` مع تعريف فعلي في `injection_container.dart`
- تطابق كل `RouteNames.x` بين التعريف والاستخدام

لكن **لم يتم تشغيل `flutter analyze` أو `flutter test` أو `flutter build` فعليًا**.
يجب تشغيل الأوامر التالية على جهازك أولًا قبل اعتماد الكود نهائيًا:

```bash
cd mobile
flutter create . --project-name workforce_connect_ai --org com.workforceconnect --platforms android,ios
# ⚠️ ملاحظة: هذا الأمر يُنشئ مجلدَي android/ وios/ (لم يُرفَقا في هذا التسليم
# لأنهما يحتاجان أدوات Flutter الرسمية لتوليدهما بشكل صحيح). قد يطلب دمج
# ملفات موجودة — اختر الاحتفاظ بملفات lib/ وpubspec.yaml المُرفَقة.

flutter pub get
flutter analyze
flutter test
flutter build apk --debug   # أو: flutter build ios --debug
```

إن ظهرت أخطاء تجميع، أغلبها متوقَّع أن تكون طفيفة (فروق نسخ حزم، أو تفاصيل صياغة)
وليست أخطاء بنيوية — البنية والمنطق (Clean Architecture، الطبقات، الـ DI، الـ Routing)
سليمة ومُراجَعة يدويًا بعمق.

## 🎨 الهوية البصرية (SASCO)

التطبيق الآن بتصميم احترافي كامل بلون SASCO المؤسسي (أخضر `#0C7C42`):
- Theme شامل (أزرار، حقول إدخال، بطاقات، حوارات، Chips) في `lib/core/theme/`
- خط Cairo (عبر `google_fonts`) — واضح للعربية والإنجليزية معًا
- شاشتا Splash وLogin مُعاد تصميمهما بالكامل بهوية العلامة
- الشاشة الرئيسية بترويسة متدرّجة اللون + بطاقات أنيقة

**الشعار الرسمي لم يُدرَج عمدًا** — لا أملك ملف الشعار الفعلي، وإنشاء نسخة
مُخمَّنة منه غير مناسب. بدلًا من ذلك، كل الشاشات تعرض شعارًا احتياطيًا أنيقًا
(أيقونة محطة وقود بلون العلامة) حتى تضيف الملفات الحقيقية. **راجع
`assets/images/README.md`** للمواصفات الدقيقة والخطوات — الأمر يستغرق دقيقتين
بمجرد توفّر ملف الشعار لديك.

## 📱 بناء APK لمشاركته عبر واتساب (اختبار سريع)

```bash
cd mobile
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL=https://<رابط-Backend-الفعلي-على-Railway>/api/v1 \
  --dart-define=WS_BASE_URL=https://<رابط-Backend-الفعلي-على-Railway>
```

الملف الناتج: `build/app/outputs/flutter-apk/app-release.apk` — يمكن إرساله
مباشرة عبر واتساب لأي شخص لتثبيته وتجربته (يحتاج المستلم تفعيل "تثبيت من
مصادر غير معروفة" على أندرويد).

**بديل أسرع للتجربة الأولى فقط** (بدون بناء نهائي محسَّن):
```bash
flutter build apk --debug --dart-define=API_BASE_URL=... --dart-define=WS_BASE_URL=...
```

## التشغيل بعد التحقق

```bash
cp .env.example .env
flutter run \
  --dart-define=API_BASE_URL=http://localhost:3000/api/v1 \
  --dart-define=WS_BASE_URL=http://localhost:3000
```

## البنية المعمارية

```
lib/
  core/                      — بنية تحتية مشتركة
    di/                      — Dependency Injection (get_it، تسجيل يدوي)
    network/                 — Dio + WebSocket (Socket.io) + Auth Interceptor
    storage/                 — Secure Storage (JWT) + SQLite (Offline-first) + Sync
    error/                   — Failures (domain) + Exceptions (data)
    usecase/                 — UseCase<Type, Params> الأساسي
    router/                  — go_router مع حراسة مصادقة كاملة
    theme/                   — Light/Dark themes
    notifications/           — Local (حقيقي) + Firebase (stub موثّق)
    ai/                      — واجهات STT/Translation/TTS (تجهيزًا للمرحلة الثانية)
  features/
    authentication/          — عمق كامل (Splash, Login, Forgot Password) + اختبارات
    chat/                    — عمق كامل — WebSocket حقيقي، تسجيل/تشغيل صوت حقيقي + اختبارات
    tasks/                   — نماذج ديناميكية (11 نوع حقل)
    approvals/ shift/ fuel_requests/ stations/ profile/  — عمق أخف (راجع القسم أدناه)
  shared/                    — مكوّنات UI مشتركة
test/
  features/authentication/…  — 6 سيناريوهات AuthBloc
  features/chat/…            — 6 سيناريوهات ChatBloc (بما فيها منع تكرار الرسائل عبر Socket)
```

## قرار النطاق: العمق المتفاوت بين الـ Features

**Authentication و Chat** بُنيا بعمق كامل (UseCase منفصل لكل عملية + اختبارات Bloc شاملة)
لأنهما الأكثر تعقيدًا وحساسية (WebSocket الحقيقي، تدوير التوكن).

**Approvals / Shift / Fuel Requests / Stations / Profile** بُنيت بنفس طبقات Clean
Architecture (data/domain/presentation كاملة) لكن:
- تُستخدَم **Cubit** بدلاً من **Bloc** (أبسط، مناسبة لشاشات ذات منطق مباشر)
- UseCases مُجمَّعة في ملف واحد لكل Feature بدلاً من ملف منفصل لكل عملية (لأنها Wrappers رفيعة بلا منطق أعمال إضافي)
- **لا يوجد اختبار Bloc/Cubit منفصل لكل Feature بعد** — هذه فجوة معروفة ومُفصَح عنها، وليست ادّعاءً بإنجاز غير موجود.

## فجوات معروفة (Known Gaps)

**✅ خطأ حقيقي اكتُشف وأُصلح في هذه الجولة:** `pubspec.yaml` كان يحتوي على
خطأ صياغة YAML أساسي (شرطة نصية غير محاطة بعلامات اقتباس في حقل
`description`) كان سيُفشل `flutter pub get` **فورًا** من أول أمر — لم
يُكتشَف سابقًا لأن كل فحوصاتي السابقة اقتصرت على كود Dart نفسه، دون
التحقق من صحة `pubspec.yaml` كملف YAML مستقل. تم إصلاحه والتحقق منه فعليًا
عبر مُحلِّل YAML حقيقي.


1. **التعريب غير مكتمل التطبيق**: البنية التحتية لتعدد اللغات (`easy_localization`،
   `SupportedLocales` القابلة للتوسع دون إعادة هيكلة، ملفات `ar.json`/`en.json`) جاهزة
   وتعمل، لكن **معظم نصوص الواجهة مكتوبة مباشرة بالعربية (hardcoded)** وليست مُمرَّرة
   عبر `.tr()`. تحويل باقي النصوص هو عمل ميكانيكي (استبدال نص بمفتاح ترجمة) في كل ملف
   `presentation/pages/*.dart`.
2. **Offline Queue مُفعَّل كنموذج مرجعي واحد فقط** (`ChatRepositoryImpl.sendTextMessage`)
   — البنية (`OfflineQueueService`, `SyncService`) كاملة وقابلة لإعادة الاستخدام، لكن
   باقي الـ Repositories لا تستخدمها تلقائيًا بعد.
3. **Firebase Push غير مُفعَّل فعليًا** (لا يوجد مشروع Firebase مُهيَّأ / `google-services.json`)
   — الواجهة (`PushNotificationService`) جاهزة، التنفيذ الحقيقي يحتاج ربط مشروع Firebase.
4. **android/ وios/ غير مُرفَقين** — يُنشآن عبر `flutter create .` كما هو موضّح أعلاه.
5. **حقل الصوت (AUDIO) في النماذج الديناميكية** لا يُعيد استخدام `VoiceRecorderButton` من
   Chat حاليًا — الحقل معروض لكن التسجيل الفعلي له متروك كخطوة تالية صغيرة.

## متغيرات البيئة
راجع `.env.example`. تُمرَّر فعليًا عبر `--dart-define` عند التشغيل/البناء (كما في مثال
الأمر أعلاه)، وليس عبر ملف `.env` يُقرأ في runtime (لتفادي حزمة إضافية غير ضرورية في Phase 1).
