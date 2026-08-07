/// أداة تتبّع زمني شاملة — بديل حقيقي عن سجلّات Railway لكن للموبايل
/// (المستخدم لا يملك بيئة تطوير متصلة لالتقاط `flutter logs` حيّة).
/// تُسجِّل كل مرحلة من مراحل خط الأنابيب المُطلَب تتبّعها بالضبط:
/// الإرسال، وصول الحدث الخام، معالجته، تحديث الحالة — بطابع زمني
/// دقيق (ميلي ثانية) لكل خطوة، قابلة للنسخ كنص كامل جاهز للمراجعة.
class EventTraceLog {
  EventTraceLog._();
  static final List<String> _entries = [];

  static void log(String stage, {String? messageId, String? conversationId, String? extra}) {
    final now = DateTime.now();
    final ts =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}.${now.millisecond.toString().padLeft(3, '0')}';
    final parts = [
      '[$ts]',
      stage,
      if (messageId != null) 'msg=${messageId.length > 8 ? messageId.substring(0, 8) : messageId}',
      if (conversationId != null) 'conv=${conversationId.length > 8 ? conversationId.substring(0, 8) : conversationId}',
      if (extra != null) extra,
    ];
    _entries.add(parts.join(' | '));
    if (_entries.length > 500) _entries.removeAt(0); // حدّ أقصى بسيط لتفادي نمو غير محدود
  }

  static String dump() => _entries.isEmpty ? '(لا سجلّات بعد)' : _entries.join('\n');

  static void clear() => _entries.clear();
}
