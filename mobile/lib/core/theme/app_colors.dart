import 'package:flutter/material.dart';

/// Atheel Tech brand palette (V3 rebrand — see V3_DESIGN_UPDATE.md).
/// Primary green matches the Atheel Tech logo's own color (#0C7C42)
/// almost exactly, so no palette change was needed for the rebrand
/// itself — only the logo asset, wordmark text, and app name changed.
class AppColors {
  AppColors._();

  // Primary — Atheel Tech green
  static const Color brand = Color(0xFF0C7C42);
  static const Color brandDark = Color(0xFF085C31);
  static const Color brandLight = Color(0xFFE6F4EC);

  // Secondary accent — warm amber, evokes fuel/energy without competing
  // with the primary green; used sparingly (badges, highlights only).
  static const Color accent = Color(0xFFF2A93B);

  static const Color success = Color(0xFF16A34A);
  static const Color danger = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);

  static const Color surfaceLight = Color(0xFFF7F9F8);
  static const Color surfaceDark = Color(0xFF0E1512);
  static const Color textPrimary = Color(0xFF11201A);
  static const Color textSecondary = Color(0xFF5B6B63);
  static const Color divider = Color(0xFFE2E8E4);

  /// CHAT_SPEC.md §1: اسم المرسِل في المحادثات الجماعية "بلون مشتق من
  /// senderId (نفس المرسِل = نفس اللون دائماً)". لوحة ثابتة بدل توليد
  /// عشوائي — يضمن تبايناً كافياً مع الخلفية البيضاء لكل قيمة، بخلاف
  /// hue عشوائي قد ينتج لوناً باهتاً غير مقروء.
  static const List<Color> senderPalette = [
    Color(0xFF0C7C42), // brand
    Color(0xFF1D4ED8), // blue
    Color(0xFF7C3AED), // violet
    Color(0xFFC2410C), // burnt orange
    Color(0xFF0891B2), // teal
    Color(0xFFBE185D), // magenta
    Color(0xFF4D7C0F), // olive
  ];
}
