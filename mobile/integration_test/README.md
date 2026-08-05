# اختبارات التكامل (Integration Tests) — تطبيق الموبايل

اختبارات حقيقية تُشغِّل التطبيق الفعلي وتتفاعل معه، ضد **خادم حقيقي** (وليس محاكاة) — تُثبِت أن تدفّق تسجيل الدخول الفعلي يعمل من البداية للنهاية.

## التشغيل محليًا

```bash
cd mobile
flutter test integration_test/app_test.dart \
  --dart-define=API_BASE_URL=https://whatsapp-sasco-production.up.railway.app/api/v1 \
  --dart-define=WS_BASE_URL=https://whatsapp-sasco-production.up.railway.app
```

القيم الافتراضية لبيانات الدخول تطابق حساب العامل التجريبي في `seed.ts` تمامًا (`worker@demo-fuel-co.com` / `Demo@12345`). لاستخدام حساب آخر:

```bash
flutter test integration_test/app_test.dart \
  --dart-define=API_BASE_URL=... \
  --dart-define=WS_BASE_URL=... \
  --dart-define=TEST_EMAIL=your@email.com \
  --dart-define=TEST_PASSWORD=YourPassword
```

## التشغيل على جهاز/محاكي حقيقي

```bash
flutter test integration_test/app_test.dart -d <device-id> --dart-define=...
```
(`flutter devices` لعرض الأجهزة المتاحة)

## ماذا يُغطّي هذا الملف حاليًا
- تسجيل دخول ناجح ببريد وكلمة مرور صحيحين → الوصول لواجهة الصفحة الرئيسية
- تسجيل دخول بكلمة مرور خاطئة → البقاء في شاشة الدخول (لا تنقّل خاطئ)

## الإضافة التالية المقترحة
تدفّقات إضافية (إرسال رسالة دردشة، فتح/إغلاق وردية، تقديم مهمة) — كل منها يحتاج إضافة `Key`s مماثلة على الحقول الحرجة في شاشاته أولًا (نفس النمط المُطبَّق هنا على شاشة الدخول)، ثم ملف اختبار مستقل يتبع نفس البنية.
