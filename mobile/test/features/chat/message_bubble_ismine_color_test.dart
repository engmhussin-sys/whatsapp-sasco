// اختبار المهمة ١ (design_handoff_atheel_community/PROMPT_CATCHUP.md):
// يبني فقاعتين — واحدة isMine=true وأخرى isMine=false — ويتحقّق من
// اختلاف لون الخلفية فعليًا. هذا يحوّل قاعدة "رسائلي خضراء، الواردة
// بيضاء" من افتراض إلى شرط بناء يفشل فورًا لو انكسر مستقبلًا.
//
// ملاحظة صدق: لم أتمكّن من تشغيل `flutter test` فعليًا هنا (لا يوجد
// Flutter SDK في بيئتي طوال هذا المشروع) — هذا الاختبار مكتوب بأقصى
// عناية ممكنة ساكنًا، لكن التحقّق الفعلي من نجاحه يحتاج تشغيلك له.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:workforce_connect_ai/features/chat/domain/entities/message_entity.dart';
import 'package:workforce_connect_ai/features/chat/presentation/widgets/message_bubble.dart';
import 'package:workforce_connect_ai/core/theme/app_colors.dart';

MessageEntity _buildMessage() => MessageEntity(
      id: 'm1',
      conversationId: 'c1',
      senderId: 'sender-1',
      senderName: 'أحمد',
      type: MessageType.text,
      status: MessageDeliveryStatus.sent,
      text: 'مرحباً',
      createdAt: DateTime(2026, 1, 1, 9, 0),
      originalLang: 'ar',
      translations: const {},
    );

Future<void> _pumpBubble(WidgetTester tester, {required bool isMine}) async {
  await EasyLocalization.ensureInitialized();
  await tester.pumpWidget(
    MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Material(
          child: MessageBubble(message: _buildMessage(), myLang: 'ar', isMine: isMine),
        ),
      ),
    ),
  );
}

void main() {
  group('MessageBubble — isMine يقرر اللون (المهمة ١)', () {
    testWidgets('رسالتي (isMine=true) بلون AppColors.brand', (tester) async {
      await _pumpBubble(tester, isMine: true);

      final containers = tester.widgetList<Container>(find.byType(Container));
      final bubbleContainer = containers.firstWhere(
        (c) => c.decoration is BoxDecoration && (c.decoration as BoxDecoration).color == AppColors.brand,
        orElse: () => throw TestFailure('لم يُعثَر على حاوية الفقاعة بلون AppColors.brand عند isMine=true'),
      );
      expect((bubbleContainer.decoration as BoxDecoration).color, AppColors.brand);
    });

    testWidgets('رسالة واردة (isMine=false) بيضاء وليست خضراء', (tester) async {
      await _pumpBubble(tester, isMine: false);

      final containers = tester.widgetList<Container>(find.byType(Container));
      final hasGreenBubble = containers.any(
        (c) => c.decoration is BoxDecoration && (c.decoration as BoxDecoration).color == AppColors.brand,
      );
      expect(hasGreenBubble, isFalse, reason: 'رسالة واردة لا يجب أن تظهر بلون AppColors.brand الأخضر');
    });
  });
}
