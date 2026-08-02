import 'package:flutter/material.dart';

/// SASCO brand palette. Primary green matches the company's established
/// corporate color (Saudi Automotive Services Co. — fuel stations,
/// Tadawul: 4050). Exact hex values below are a professional, modern
/// interpretation of that identity — swap `brand`/`brandDark` for the
/// company's official brand-guideline hex codes if/when you have them
/// (this is the ONLY place that needs to change; every screen references
/// these constants rather than hardcoding colors).
class AppColors {
  AppColors._();

  // Primary — SASCO green
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
}
