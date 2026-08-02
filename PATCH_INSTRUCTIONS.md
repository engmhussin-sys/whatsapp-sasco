# تعليمات تطبيق هذا التحديث عبر GitHub Desktop

هذا الأرشيف يحتوي على **4 ملفات فقط** (التعديلات المطلوبة لإصلاح أخطاء
`flutter analyze` على Flutter 3.44)، كل ملف في مساره الصحيح تمامًا داخل
هيكلية المشروع:

```
mobile/lib/core/theme/app_theme.dart
mobile/lib/features/shift/presentation/bloc/shift_cubit.dart
mobile/lib/features/shift/presentation/pages/shift_page.dart
mobile/lib/features/chat/presentation/bloc/chat_bloc.dart
```

## الخطوات

1. فُك ضغط هذا الأرشيف
2. انسخ مجلد `mobile/` بالكامل من الأرشيف المفكوك، والصقه فوق مجلد
   `mobile/` الموجود في نسخة المستودع المحلية لديك (استبدل عند السؤال) —
   هذا سيستبدل الملفات الأربعة فقط دون التأثير على أي ملف آخر
3. افتح **GitHub Desktop** — سيظهر لك تلقائيًا أن 4 ملفات تغيّرت
4. راجع الفروقات (Diff) إن أردت، ثم اكتب رسالة Commit مثل:
   `fix: Flutter 3.44 compatibility (CardThemeData/DialogThemeData, ShiftCubit.close rename)`
5. **Commit to main** ثم **Push origin**

## بعد الدفع (Push)

على جهازك (حيث Flutter مثبَّت فعليًا)، شغّل:

```bash
cd mobile
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter build apk --release
```

أرسل لي أي خطأ يظهر — لم أستطع تشغيل هذه الأوامر من طرفي (قيد بيئي موثَّق
سابقًا: `pub.dev` محجوب في بيئة التطوير لدي).
