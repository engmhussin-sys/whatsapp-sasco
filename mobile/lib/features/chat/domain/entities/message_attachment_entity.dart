import 'package:equatable/equatable.dart';

enum MessageAttachmentKind { image, video, audio, document, signature }

class MessageAttachmentEntity extends Equatable {
  final String id;
  final MessageAttachmentKind kind;
  final String url;
  final String? fileName;
  final String? mimeType;
  final int? sizeBytes;
  /// CHAT_SPEC.md §4/§9: أبعاد حقيقية وصورة مصغّرة مضمّنة — تُملأ فقط
  /// لمرفقات الصور (ImageMetaExtractorService في الخادم). null لبقية
  /// الأنواع أو إن فشل الاستخراج.
  final int? width;
  final int? height;
  final String? thumbnailBase64;

  const MessageAttachmentEntity({
    required this.id,
    required this.kind,
    required this.url,
    this.fileName,
    this.mimeType,
    this.sizeBytes,
    this.width,
    this.height,
    this.thumbnailBase64,
  });

  String get sizeLabel {
    if (sizeBytes == null) return '';
    final kb = sizeBytes! / 1024;
    if (kb < 1024) return '${kb.toStringAsFixed(0)} KB';
    return '${(kb / 1024).toStringAsFixed(1)} MB';
  }

  @override
  List<Object?> get props => [id, kind, url, fileName, mimeType, sizeBytes, width, height, thumbnailBase64];
}
