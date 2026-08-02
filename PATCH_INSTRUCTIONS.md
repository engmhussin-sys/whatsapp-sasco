# إصلاح خطأ بناء APK — تعارض إصدارات حزمة record

## الملف المُعدَّل
`mobile/pubspec.yaml` — سطر واحد فقط:
```
record: ^5.1.2   →   record: ^6.0.0
```

## السبب
خطأ حقيقي معروف في حزمة `record` نفسها (وليس في كود المشروع): الإصدار
`record_linux 0.7.2` الذي يُحلّ تلقائيًا مع `record: ^5.1.2` غير متوافق مع
`record_platform_interface` الأحدث (مفقودة تطبيقات لدوال مثل `startStream`).
هذا خطأ مُوثَّق في تقارير Issues مشابهة لمشاريع أخرى غير هذا المشروع.
النسخة `^6.0.0` من `record` تُزامن الحزم الفرعية (`record_android`,
`record_linux`, `record_platform_interface`, إلخ) بشكل صحيح داخليًا.

**لم يتغيّر أي كود** — الكود الحالي في `voice_recorder_button.dart` يستخدم
بالفعل الواجهة العامة الثابتة لحزمة `record` (`AudioRecorder`,
`RecordConfig`, `.hasPermission()`, `.start()`, `.stop()`, `.dispose()`)
والتي لم تتغيّر عبر هذا الانتقال — تحقّقتُ من هذا يدويًا مقابل توثيق
الحزمة الرسمي.

## الخطوات
1. فُك ضغط هذا الأرشيف
2. استبدل `mobile/pubspec.yaml` بالملف المُرفَق
3. في الطرفية:
```bash
cd mobile
flutter clean
flutter pub get
flutter build apk --release
```

## ⚠️ إن لم يُحل الخطأ بالكامل
هذا إصلاح مبني على أدلة قوية (توثيق رسمي + تقارير Issues مشابهة) وليس
تجربة مباشرة — **لم أستطع تشغيل `flutter pub get` أو `flutter build apk`
من طرفي** (نفس القيد البيئي الموثَّق طوال هذا المشروع: `pub.dev` محجوب).

إن ظهر خطأ من نوع "version solving failed" أو ما شابه بعد `flutter pub get`،
شغّل:
```bash
flutter pub outdated
```
وأرسل لي المخرجات كاملة — سأحدّد عندها الإصدار الدقيق المطلوب لـ
`dependency_overrides` بدلًا من التخمين.
