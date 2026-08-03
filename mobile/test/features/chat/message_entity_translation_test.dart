import 'package:flutter_test/flutter_test.dart';
import 'package:workforce_connect_ai/features/chat/domain/entities/message_entity.dart';
import 'package:workforce_connect_ai/features/chat/data/models/message_model.dart';

void main() {
  group('MessageEntity — translation display logic', () {
    final message = MessageEntity(
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      senderName: 'Ahmed',
      type: MessageType.text,
      status: MessageDeliveryStatus.sent,
      text: 'مرحبا',
      createdAt: DateTime.now(),
      originalLang: 'ar',
      translations: const {'bn': 'হ্যালো'},
    );

    test('displayText() returns the translation for a language that has one', () {
      expect(message.displayText('bn'), 'হ্যালো');
    });

    test('displayText() returns the original text for the ORIGINAL language itself', () {
      expect(message.displayText('ar'), 'مرحبا');
    });

    test('displayText() falls back to the original text when no translation exists for that language', () {
      expect(message.displayText('ur'), 'مرحبا');
    });

    test('isTranslatedFor() is true only when a real translation exists for a DIFFERENT language', () {
      expect(message.isTranslatedFor('bn'), isTrue);
      expect(message.isTranslatedFor('ar'), isFalse); // same as original — not "translated"
      expect(message.isTranslatedFor('ur'), isFalse); // different language but no translation stored
    });

    test('translationMissingFor() is true only when the language differs AND no translation exists', () {
      expect(message.translationMissingFor('ur'), isTrue);
      expect(message.translationMissingFor('bn'), isFalse); // translation exists
      expect(message.translationMissingFor('ar'), isFalse); // same as original, nothing "missing"
    });

    test('copyWith() preserves originalLang and translations (previously silently dropped)', () {
      final updated = message.copyWith(status: MessageDeliveryStatus.read);
      expect(updated.originalLang, 'ar');
      expect(updated.translations, {'bn': 'হ্যালো'});
      expect(updated.status, MessageDeliveryStatus.read);
    });
  });

  group('MessageModel.fromJson — translation parsing', () {
    test('parses originalLang and the translations list into a langCode->text map', () {
      final json = {
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 'u1',
        'sender': {'firstName': 'Ahmed', 'lastName': 'Ali'},
        'type': 'TEXT',
        'status': 'SENT',
        'originalText': 'مرحبا',
        'originalLang': 'ar',
        'createdAt': '2026-01-01T00:00:00.000Z',
        'translations': [
          {'langCode': 'bn', 'translatedText': 'হ্যালো', 'engine': 'OPENAI', 'version': 1},
          {'langCode': 'ur', 'translatedText': 'ہیلو', 'engine': 'CACHE', 'version': 1},
        ],
      };

      final model = MessageModel.fromJson(json);

      expect(model.originalLang, 'ar');
      expect(model.translations, {'bn': 'হ্যালো', 'ur': 'ہیلو'});
      expect(model.displayText('bn'), 'হ্যালো');
    });

    test('defaults originalLang to "ar" and translations to empty when absent (older payload shape)', () {
      final json = {
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 'u1',
        'sender': null,
        'type': 'TEXT',
        'status': 'SENT',
        'originalText': 'hi',
        'createdAt': '2026-01-01T00:00:00.000Z',
      };

      final model = MessageModel.fromJson(json);

      expect(model.originalLang, 'ar');
      expect(model.translations, isEmpty);
    });
  });
}
