// design_tokens.dart — المصدر الوحيد لقيم التصميم. لا تعدّل قيمة هنا إلا بقرار تصميمي.
//
// قاعدة: أي رقم أو لون في أي widget يجب أن يأتي من هذا الملف.
// إن احتجت قيمة غير موجودة — أضفها هنا أولاً، ولا تكتبها في الشاشة.
//
// مصدر: design_handoff_atheel_community/dart/design_tokens.dart —
// يُدمج القيم المُطبَّقة سابقًا قطعة قطعة عبر جلسات متفرقة (أنصاف
// أقطار V3، مدد الحركة، localizedDigits) في مصدر واحد كنوني بدل
// تكرارها في كل ملف يحتاجها.

import 'package:flutter/material.dart';

/// أنصاف الأقطار — نسخة ٣ (منحنية، بعد كسر المربعات)
abstract final class R {
  static const double card = 20; // بطاقة عادية
  static const double button = 16; // زر / حقل إدخال
  static const double tile = 26; // بلاطة كبيرة في الرئيسية
  static const double sheetTop = 30; // الورقة المرتفعة فوق الرأس
  static const double headerBottom = 28; // انحناء الرأس الملوّن
  static const double homeHeaderBottom = 36; // رأس الرئيسية أعمق
  static const double bubble = 24; // فقاعة الرسالة
  static const double bubbleTail = 8; // الزاوية المدبّبة جهة المرسل
  static const double pill = 999; // كبسولة كاملة

  static BorderRadius get cardR => BorderRadius.circular(card);
  static BorderRadius get buttonR => BorderRadius.circular(button);
  static BorderRadius get tileR => BorderRadius.circular(tile);
  static BorderRadius get headerR => const BorderRadius.vertical(bottom: Radius.circular(headerBottom));
  static BorderRadius get homeHeaderR => const BorderRadius.vertical(bottom: Radius.circular(homeHeaderBottom));
  static BorderRadius get sheetR => const BorderRadius.vertical(top: Radius.circular(sheetTop));

  /// فقاعة الرسالة: الزاوية المدبّبة أسفل جهة المرسل، وتنقلب مع RTL.
  static BorderRadius bubbleR({required bool isMine, required bool isRtl}) {
    const b = Radius.circular(bubble);
    const t = Radius.circular(bubbleTail);
    if (isMine) {
      return isRtl
          ? const BorderRadius.only(topLeft: b, topRight: b, bottomLeft: t, bottomRight: b)
          : const BorderRadius.only(topLeft: b, topRight: b, bottomLeft: b, bottomRight: t);
    }
    return isRtl
        ? const BorderRadius.only(topLeft: b, topRight: b, bottomLeft: b, bottomRight: t)
        : const BorderRadius.only(topLeft: b, topRight: b, bottomLeft: t, bottomRight: b);
  }
}

/// المسافات — لا تستخدم أرقاماً خارج هذه القائمة
abstract final class Gap {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 26;
}

/// أحجام النص — الحد الأدنى لنص الرسالة 17
abstract final class FS {
  static const double micro = 10;
  static const double caption = 11.5;
  static const double small = 12.5;
  static const double body = 14;
  static const double label = 15.5;
  static const double title = 16;
  static const double message = 17;
  static const double heading = 19;
  static const double display = 26;
}

/// الحدود الدنيا للمس — عمال بقفازات
abstract final class Touch {
  static const double min = 44;
  static const double primaryButton = 52;
  static const double sosDiameter = 170;
  static const double sosHoldSeconds = 3;
}

/// مدد الحركة ومنحنياتها
abstract final class Motion {
  static const Duration fast = Duration(milliseconds: 200);
  static const Duration base = Duration(milliseconds: 300);
  static const Duration progress = Duration(milliseconds: 550);
  static const Duration scanSweep = Duration(milliseconds: 2400);
  static const Duration cardStagger = Duration(milliseconds: 50);
  static const Duration sosHold = Duration(seconds: 3);

  static const Curve enter = Cubic(0.2, 0.8, 0.2, 1);
  static const Curve overshoot = Cubic(0.2, 1.4, 0.4, 1);
}

/// أنماط جاهزة — استخدمها بدل بناء BoxDecoration في كل شاشة
abstract final class Deco {
  static BoxDecoration card(BuildContext c) => BoxDecoration(
        color: Colors.white,
        borderRadius: R.cardR,
        border: Border.all(color: Theme.of(c).dividerColor),
      );

  static BoxDecoration tintCard(Color tint, Color border) => BoxDecoration(
        color: tint,
        borderRadius: R.cardR,
        border: Border.all(color: border, width: 2),
      );

  static BoxDecoration header(Color brand, Color brandDark, {bool home = false}) => BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [brand, brandDark]),
        borderRadius: home ? R.homeHeaderR : R.headerR,
      );
}

/// تحويل الأرقام إلى عربية-هندية في العربية والأردية فقط
String localizedDigits(String input, String langCode) {
  if (langCode != 'ar' && langCode != 'ur') return input;
  const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return input.replaceAllMapped(RegExp(r'[0-9]'), (m) => arabicIndic[int.parse(m.group(0)!)]);
}

/// عائلة الخط حسب اللغة — Cairo لا يغطّي ديفاناغري/بنغالي/إثيوبي
String fontFamilyFor(String langCode) => switch (langCode) {
      'hi' => 'Noto Sans Devanagari',
      'bn' => 'Noto Sans Bengali',
      'am' => 'Noto Sans Ethiopic',
      _ => 'Cairo',
    };

/// اللغات المدعومة واتجاهها
const Map<String, bool> kIsRtlByLang = {
  'ar': true,
  'ur': true,
  'hi': false,
  'bn': false,
  'en': false,
  'tl': false,
  'am': false,
};
