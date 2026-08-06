import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../domain/entities/message_attachment_entity.dart';

/// CHAT_SPEC.md §5 — بطاقة الملف المرفق: مربع نوع 44×44dp بتينت، اسم
/// الملف بحواف وسطى، زر تنزيل يتحول لحلقة تقدّم ثم علامة صح، ونقرة على
/// البطاقة كلها بعد التنزيل تفتح الملف عبر open_filex.
class DocumentAttachmentCard extends StatefulWidget {
  const DocumentAttachmentCard({super.key, required this.attachment, required this.isMine});

  final MessageAttachmentEntity attachment;
  final bool isMine;

  @override
  State<DocumentAttachmentCard> createState() => _DocumentAttachmentCardState();
}

enum _DownloadState { idle, downloading, done }

class _DocumentAttachmentCardState extends State<DocumentAttachmentCard> {
  _DownloadState _state = _DownloadState.idle;
  double _progress = 0;
  String? _localPath;

  String get _extension {
    final name = widget.attachment.fileName ?? '';
    final dot = name.lastIndexOf('.');
    return dot == -1 ? '' : name.substring(dot + 1).toLowerCase();
  }

  ({IconData icon, Color tint}) get _typeStyle {
    switch (_extension) {
      case 'pdf':
        return (icon: Icons.picture_as_pdf, tint: AppColors.danger);
      case 'doc':
      case 'docx':
        return (icon: Icons.description, tint: const Color(0xFF1D4ED8));
      case 'xls':
      case 'xlsx':
      case 'csv':
        return (icon: Icons.table_chart, tint: AppColors.success);
      default:
        return (icon: Icons.insert_drive_file, tint: AppColors.textSecondary);
    }
  }

  String get _fullUrl {
    final origin = ApiConstants.baseUrl.replaceAll(RegExp(r'/api/v1$'), '');
    return widget.attachment.url.startsWith('http') ? widget.attachment.url : '$origin${widget.attachment.url}';
  }

  Future<void> _handleTap() async {
    if (_state == _DownloadState.done && _localPath != null) {
      await OpenFilex.open(_localPath!);
      return;
    }
    if (_state == _DownloadState.downloading) return;

    setState(() => _state = _DownloadState.downloading);
    try {
      final dir = await getTemporaryDirectory();
      final fileName = widget.attachment.fileName ?? widget.attachment.id;
      final savePath = '${dir.path}/$fileName';
      await Dio().download(
        _fullUrl,
        savePath,
        onReceiveProgress: (received, total) {
          if (total > 0 && mounted) setState(() => _progress = received / total);
        },
      );
      if (mounted) {
        setState(() {
          _state = _DownloadState.done;
          _localPath = savePath;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _state = _DownloadState.idle);
    }
  }

  Uint8List? get _thumbnailBytes {
    if (widget.attachment.thumbnailBase64 == null) return null;
    try {
      final base64Part = widget.attachment.thumbnailBase64!.split(',').last;
      return base64Decode(base64Part);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = _typeStyle;
    final fg = widget.isMine ? Colors.white : AppColors.textPrimary;
    final metaFg = widget.isMine ? Colors.white70 : AppColors.textSecondary;
    // CHAT_SPEC.md §5: "صورة/فيديو: معاينة مصغّرة بدل الأيقونة" — كانت
    // كل الأنواع تعرض أيقونة نوع الملف حتى الفيديو الذي يملك معاينة
    // حقيقية فعلياً (VideoThumbnailExtractorService في الخادم).
    final thumbBytes = widget.attachment.kind == MessageAttachmentKind.video ? _thumbnailBytes : null;

    return GestureDetector(
      onTap: _handleTap,
      child: SizedBox(
        width: 240,
        child: Row(
          children: [
            // مربع النوع — CHAT_SPEC.md §5: 44×44dp؛ معاينة حقيقية
            // للفيديو إن توفّرت، وإلا أيقونة بتينت حسب النوع.
            ClipRRect(
              borderRadius: BorderRadius.circular(11),
              child: SizedBox(
                width: 44,
                height: 44,
                child: thumbBytes != null
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.memory(thumbBytes, fit: BoxFit.cover),
                          Container(color: Colors.black26),
                          const Center(child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: 22)),
                        ],
                      )
                    : Container(
                        color: style.tint.withValues(alpha: 0.14),
                        child: Icon(style.icon, color: style.tint, size: 22),
                      ),
              ),
            ),
            const SizedBox(width: Gap.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    widget.attachment.fileName ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.middle, // CHAT_SPEC.md §5: الامتداد يبقى ظاهراً
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: fg),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [widget.attachment.sizeLabel, _extension.toUpperCase()].where((s) => s.isNotEmpty).join(' · '),
                    style: TextStyle(fontSize: 12, color: metaFg),
                  ),
                ],
              ),
            ),
            const SizedBox(width: Gap.sm),
            // زر التنزيل — CHAT_SPEC.md §5: 32dp، يتحول لحلقة تقدّم ثم صح
            SizedBox(
              width: 32,
              height: 32,
              child: switch (_state) {
                _DownloadState.idle => Icon(Icons.file_download_outlined, color: metaFg, size: 22),
                _DownloadState.downloading => CircularProgressIndicator(strokeWidth: 2, value: _progress > 0 ? _progress : null, color: style.tint),
                _DownloadState.done => Icon(Icons.check_circle, color: AppColors.success, size: 22),
              },
            ),
          ],
        ),
      ),
    );
  }
}
