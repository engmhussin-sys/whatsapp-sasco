// اختبارات نظام التصميم — design_handoff_atheel_community/PROMPT_CATCHUP.md
// تحوّل قواعد التصميم من رجاء إلى شرط بناء: أي انحراف يظهر في
// `flutter test` فوراً بدل الاعتماد على مراجعة يدوية متكرّرة.

import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('لا ألوان حرفية في طبقة العرض', () {
    final bad = <String>[];
    for (final f in Directory('lib/features').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      for (final m in RegExp(r'Color\(0x[0-9A-Fa-f]{8}\)').allMatches(f.readAsStringSync())) {
        bad.add('${f.path}: ${m.group(0)}');
      }
    }
    expect(bad, isEmpty, reason: 'استخدم AppColors:\n${bad.join('\n')}');
  });

  test('لا إيموجي في الواجهة', () {
    final bad = <String>[];
    final emoji = RegExp(r'[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]', unicode: true);
    // النطاق: lib/features فقط (طبقة العرض الفعلية) وليس lib/core بأكمله،
    // الذي يضمّ خدمات بلا واجهة (تعليق برمجي في tts_service.dart لا يظهر للمستخدم إطلاقاً).
    for (final f in Directory('lib/features').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      if (emoji.hasMatch(f.readAsStringSync())) bad.add(f.path);
    }
    // ملاحظة صادقة (الجولة ٣): ردود الفعل (reactions) في chat_page.dart
    // وmessage_entity.dart تستخدم إيموجي فعلي كمحتوى دلالي متعارف عليه
    // عالمياً (مثل أي تطبيق مراسلة) — وليست أيقونة واجهة زخرفية. هذا
    // الاستثناء الوحيد المقصود؛ أي ظهور آخر فعلي مخالفة حقيقية.
    final allowed = {
      'lib/features/chat/presentation/pages/chat_page.dart',
      'lib/features/chat/domain/entities/message_entity.dart',
    };
    final unexpected = bad.where((p) => !allowed.any((a) => p.endsWith(a))).toList();
    expect(unexpected, isEmpty, reason: 'إيموجي ممنوعة خارج ردود الفعل:\n${unexpected.join('\n')}');
  });

  test('لا عناصر ميتة', () {
    final bad = <String>[];
    final dead = RegExp(r'(onTap|onPressed):\s*\(\)\s*\{\s*\}|TODO|قريباً');
    for (final f in Directory('lib/features').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      if (dead.hasMatch(f.readAsStringSync())) bad.add(f.path);
    }
    expect(bad, isEmpty, reason: 'أزرار بلا وظيفة:\n${bad.join('\n')}');
  });

  test('لا محاذاة غير اتجاهية', () {
    final bad = <String>[];
    final lr = RegExp(r'Alignment\.center(Left|Right)|EdgeInsets\.only\(\s*(left|right):');
    for (final f in Directory('lib/features').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      if (lr.hasMatch(f.readAsStringSync())) bad.add(f.path);
    }
    expect(bad, isEmpty, reason: 'استخدم *Directional:\n${bad.join('\n')}');
  });
}
