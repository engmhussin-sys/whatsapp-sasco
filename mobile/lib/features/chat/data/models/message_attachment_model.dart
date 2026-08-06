import '../../domain/entities/message_attachment_entity.dart';

MessageAttachmentKind _kindFromApi(String v) => switch (v) {
      'IMAGE' => MessageAttachmentKind.image,
      'VIDEO' => MessageAttachmentKind.video,
      'AUDIO' => MessageAttachmentKind.audio,
      'SIGNATURE' => MessageAttachmentKind.signature,
      _ => MessageAttachmentKind.document,
    };

extension MessageAttachmentKindApi on MessageAttachmentKind {
  String get apiValue => switch (this) {
        MessageAttachmentKind.image => 'IMAGE',
        MessageAttachmentKind.video => 'VIDEO',
        MessageAttachmentKind.audio => 'AUDIO',
        MessageAttachmentKind.signature => 'SIGNATURE',
        MessageAttachmentKind.document => 'DOCUMENT',
      };
}

class MessageAttachmentModel extends MessageAttachmentEntity {
  const MessageAttachmentModel({
    required super.id,
    required super.kind,
    required super.url,
    super.fileName,
    super.mimeType,
    super.sizeBytes,
    super.width,
    super.height,
    super.thumbnailBase64,
  });

  factory MessageAttachmentModel.fromJson(Map<String, dynamic> json) => MessageAttachmentModel(
        id: json['id'] as String,
        kind: _kindFromApi(json['kind'] as String),
        url: json['url'] as String,
        fileName: json['fileName'] as String?,
        mimeType: json['mimeType'] as String?,
        sizeBytes: json['sizeBytes'] as int?,
        width: json['width'] as int?,
        height: json['height'] as int?,
        thumbnailBase64: json['thumbnailBase64'] as String?,
      );
}
