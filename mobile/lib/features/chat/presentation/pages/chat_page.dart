import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/audio/audio_playback_service.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../../../core/tts/tts_service.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../profile/presentation/bloc/settings_cubit.dart';
import '../../domain/entities/message_attachment_entity.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/conversation_entity.dart';
import '../bloc/chat_bloc.dart';
import '../widgets/message_bubble.dart';
import '../widgets/voice_recorder_button.dart';

class ChatPage extends StatelessWidget {
  final String conversationId;
  final UserEntity currentUser;
  /// المهمة ٣ (design_handoff_atheel_community/PROMPT_CATCHUP.md) — بيانات
  /// المحادثة الفعلية (الاسم، الأعضاء) تُمرَّر من شاشة القائمة عبر
  /// `extra` بدل عنوان ثابت "محادثة". قابلة لأن تكون null (فتح رابط
  /// مباشر للمحادثة بلا مرور بالقائمة)، وفي تلك الحالة نعرض احتياطًا
  /// معقولًا لا نصًا مُضلِّلاً.
  final ConversationEntity? conversation;

  const ChatPage({super.key, required this.conversationId, required this.currentUser, this.conversation});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ChatBloc>(param1: currentUser.companyId, param2: conversationId)..add(const ChatStarted()),
      child: _ChatView(
        currentUserId: currentUser.id,
        myLang: currentUser.preferredLanguage,
        systemRole: currentUser.systemRole,
        conversation: conversation,
      ),
    );
  }
}

class _ChatView extends StatefulWidget {
  final String currentUserId;
  final String myLang;
  final SystemRole systemRole;
  final ConversationEntity? conversation;
  const _ChatView({required this.currentUserId, required this.myLang, required this.systemRole, this.conversation});

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  final _textController = TextEditingController();
  String? _editingMessageId; // Group 3 (WhatsApp parity): non-null while editing an existing message
  final _scrollController = ScrollController();
  final _tts = sl<TtsService>();
  final _audioService = sl<AudioPlaybackService>();
  int _previousMessageCount = 0;
  // REVIEW_ROUND5.md §C1: "هذه القناة للقراءة فقط" كانت تُعرض كـSnackBar
  // أحمر عائم عام (نفس مسار كل الأخطاء) — يطفو فوق شريط الكتابة ويغطيه
  // جزئياً، وبالإنجليزية أحياناً قبل وصول الترجمة. حالة دائمة مخصَّصة
  // تستبدل شريط الكتابة بالكامل، لا Snackbar مؤقت.
  bool _isChannelReadOnly = false;
  bool _isRecordingVoice = false;
  // GlobalKey ضروري هنا تحديداً — الودجة تنتقل بين أب Expanded وآخر
  // بلا Expanded حسب _isRecordingVoice؛ بلا GlobalKey سيُدمِّر Flutter
  // الـState القديمة وينشئ واحدة جديدة عند كل تبديل (idle دائماً من
  // جديد)، فيفقد التسجيل الجاري فور بدئه. GlobalKey يحفظ نفس الـState
  // بصرف النظر عن تغيّر الآباء المحيطين بها في الشجرة.
  final GlobalKey _voiceRecorderKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    // CHAT_SPEC.md §3: "تشغيل متسلسل: عند انتهاء رسالة صوتية تُشغَّل
    // التالية تلقائياً إن كانت غير مسموعة ومن نفس المرسِل". البنية
    // التحتية (onCompletion) كانت جاهزة بلا ربط فعلي — هذا هو الربط.
    _audioService.onCompletion((finishedMessageId) async {
      final messages = context.read<ChatBloc>().state.messages;
      final index = messages.indexWhere((m) => m.id == finishedMessageId);
      if (index == -1 || index + 1 >= messages.length) return;
      final next = messages[index + 1];
      final finished = messages[index];
      if (next.type != MessageType.voice || next.audioUrl == null) return;
      if (next.senderId != finished.senderId) return;
      if (_audioService.hasBeenPlayed(next.id)) return;
      final origin = ApiConstants.baseUrl.replaceAll(RegExp(r'/api/v1$'), '');
      final url = next.audioUrl!.startsWith('http') ? next.audioUrl! : '$origin${next.audioUrl}';
      await _audioService.play(next.id, url, title: next.senderName);
    });
  }

  @override
  void dispose() {
    _audioService.clearCompletion();
    context.read<ChatBloc>().add(const ChatEnded());
    _textController.dispose();
    _scrollController.dispose();
    _tts.stop();
    super.dispose();
  }

  void _sendText() {
    if (_textController.text.trim().isEmpty) return;
    // BUG FIX (confirmed via real user report + screenshots: messages
    // appearing twice): onPressed already checked state.isSending before
    // calling this, but onSubmitted (the keyboard/IME "send" action)
    // called _sendText() directly with NO such check — a real double-tap
    // scenario (tap the send button, then immediately hit the keyboard's
    // send key before the UI rebuilds) fired the REST send twice,
    // creating two genuinely separate messages with different ids on the
    // server. The id-based de-dupe in _onMessageReceived can't catch
    // this because both messages are real, distinct database rows — not
    // one message echoed twice. Guarding here, once, covers every call
    // site (button, keyboard, and any future one) instead of patching
    // each caller separately.
    if (context.read<ChatBloc>().state.isSending) return;
    if (_editingMessageId != null) {
      context.read<ChatBloc>().add(ChatEditMessageRequested(messageId: _editingMessageId!, newText: _textController.text.trim()));
      setState(() => _editingMessageId = null);
      _textController.clear();
      return;
    }
    final replyToId = context.read<ChatBloc>().state.replyTarget?.id;
    context.read<ChatBloc>().add(ChatTextMessageSent(_textController.text, replyToId: replyToId));
    _textController.clear();
    context.read<ChatBloc>().add(const ChatTypingIndicatorChanged(false));
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // BUG FIX (confirmed real gap): ChatBloc already set state.errorMessage
    // on every failed send (including a failed reply), but NOTHING in
    // this page ever displayed it — a rejected/failed send looked
    // identical to a successful one: input clears, nothing else happens,
    // no error, no confirmation. Whatever the underlying reason (a chat
    // policy rule, a network blip, anything), the person had no way to
    // know it failed at all.
    return BlocListener<ChatBloc, ChatState>(
      listenWhen: (previous, current) => current.errorMessage != null && current.errorMessage != previous.errorMessage,
      listener: (context, state) {
        // القناة للقراءة فقط: حالة عادية متوقَّعة (دور المستخدم)، ليست
        // خطأ عابراً — تُعرض كشريط دائم يستبدل الإدخال، لا Snackbar أحمر.
        if (state.errorMessage == 'errors.channel_read_only'.tr()) {
          setState(() => _isChannelReadOnly = true);
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(state.errorMessage!), backgroundColor: AppColors.danger),
        );
      },
      child: Scaffold(
      appBar: AppBar(
        title: BlocBuilder<ChatBloc, ChatState>(
          buildWhen: (p, c) => p.isPeerTyping != c.isPeerTyping || p.isSocketConnected != c.isSocketConnected,
          builder: (context, state) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                widget.conversation?.displayName(widget.currentUserId) ?? 'chat.default_title'.tr(),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              if (state.isPeerTyping)
                const Text('يكتب الآن...', style: TextStyle(fontSize: 12, color: AppColors.success))
              else if (widget.conversation != null)
                // المهمة ٣: عدد الأعضاء الفعلي بدل حالة اتصال الشبكة
                // المُضلِّلة — لا بيانات حضور فعلية (isOnline/lastSeenAt)
                // لأعضاء المحادثة بعد؛ بُنية بيانات جديدة تحتاج جولة
                // عمل منفصلة، وليست مجرد إصلاح عرض.
                Text(
                  'chat.members_count'.plural(
                    widget.conversation!.members.length,
                    args: [localizedDigits('${widget.conversation!.members.length}', widget.myLang)],
                  ),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
            ],
          ),
        ),
        actions: [
          // Admin/lead-only — same role gate as CreateGroupPage/newGroup
          // route. Not gated on conversation TYPE (ChatState doesn't
          // currently carry that) — tapping this on a non-group
          // conversation surfaces a clear "Group conversation not
          // found" error from the backend rather than crashing, an
          // acceptable trade-off against threading conversation-type
          // through ChatBloc just for this menu item's visibility.
          if (widget.systemRole == SystemRole.companyAdmin ||
              widget.systemRole == SystemRole.teamLead ||
              widget.systemRole == SystemRole.superAdmin)
            IconButton(
              icon: const Icon(Icons.person_add_alt_1_rounded),
              tooltip: 'طلبات الانضمام',
              onPressed: () => context.push(RouteNames.groupJoinRequestsPath(context.read<ChatBloc>().conversationId)),
            ),
          BlocBuilder<ChatBloc, ChatState>(
            buildWhen: (p, c) => p.isRetranslating != c.isRetranslating,
            builder: (context, state) => IconButton(
              icon: state.isRetranslating
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.translate_rounded),
              tooltip: 'chat.retranslate'.tr(),
              onPressed: state.isRetranslating
                  ? null
                  : () => context.read<ChatBloc>().add(ChatRetranslateRequested(widget.myLang)),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: BlocConsumer<ChatBloc, ChatState>(
              listener: (context, state) {
                if (state.status == ChatStatus.success) _scrollToBottom();

                // "قراءة الرسائل بصوت عالٍ" (profile toggle) — auto-speak
                // a newly-arrived message from the OTHER person, in the
                // user's own language via displayText(). Never speaks
                // your own just-sent message (you already know what you
                // typed), and never re-speaks on unrelated rebuilds
                // (guarded by the message-count comparison below).
                final settings = context.read<SettingsCubit>().state;
                if (settings.readAloudEnabled &&
                    state.messages.length > _previousMessageCount &&
                    state.messages.isNotEmpty) {
                  final last = state.messages.last;
                  if (last.senderId != widget.currentUserId) {
                    _tts.speak(last.displayText(widget.myLang), languageCode: widget.myLang);
                  }
                }
                _previousMessageCount = state.messages.length;
              },
              builder: (context, state) {
                if (state.status == ChatStatus.loading || state.status == ChatStatus.initial) {
                  return const LoadingView();
                }
                if (state.status == ChatStatus.failure && state.messages.isEmpty) {
                  return ErrorView(
                    message: state.errorMessage ?? 'تعذّر جلب الرسائل',
                    onRetry: () => context.read<ChatBloc>().add(const ChatStarted()),
                  );
                }
                if (state.messages.isEmpty) {
                  return const Center(child: Text('لا رسائل بعد — ابدأ المحادثة'));
                }
                return BlocBuilder<SettingsCubit, SettingsState>(
                  builder: (context, settingsState) {
                    // CHAT_SPEC.md §4: كل روابط صور المحادثة، بترتيبها
                    // الزمني — تُحسَب مرة واحدة هنا (لا داخل itemBuilder
                    // المُتكرِّر) وتُمرَّر لكل فقاعة صورة لدعم التمرير
                    // بين صور المحادثة داخل العارض كامل الشاشة.
                    // BUG FIX (last-resort safety net, confirmed real
                    // after repeated deep upstream fixes still left a
                    // visible duplicate for some messages): dedupe by id
                    // at the exact render point, immediately before
                    // building the list. Whatever upstream race is still
                    // occasionally putting two entries with the same id
                    // into state.messages, this guarantees the person
                    // never SEES two bubbles for the same message —
                    // keeps the LAST occurrence of each id (the most
                    // recently updated copy, e.g. with a translation or
                    // delivery-status update already applied to it).
                    final seenIds = <String>{};
                    final dedupedMessages = <MessageEntity>[];
                    for (final m in state.messages.reversed) {
                      if (seenIds.add(m.id)) dedupedMessages.insert(0, m);
                    }

                    final allImageUrls = [
                      for (final m in dedupedMessages)
                        for (final a in m.attachments)
                          if (a.kind == MessageAttachmentKind.image) a.url,
                    ];
                    return ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(12),
                      itemCount: dedupedMessages.length,
                      itemBuilder: (context, index) {
                        final MessageEntity message = dedupedMessages[index];
                        final showDateSeparator = index == 0 || !_isSameDay(dedupedMessages[index - 1].createdAt, message.createdAt);
                        // CHAT_SPEC.md §1: تجميع الرسائل — نفس المرسِل خلال
                        // ٦٠ ثانية يُعتبر "مجموعة واحدة". يُعاد الحساب عند
                        // فاصل تاريخ حتى لو كان الفارق الزمني أقل من الدقيقة
                        // (لا يصح دمج رسالتين من يومين مختلفين بصرياً).
                        final isGroupedWithPrevious = !showDateSeparator &&
                            index > 0 &&
                            dedupedMessages[index - 1].senderId == message.senderId &&
                            message.createdAt.difference(dedupedMessages[index - 1].createdAt).inSeconds.abs() < 60;
                        return Column(
                          key: ValueKey('msg-row-${message.id}'),
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (showDateSeparator) _DateSeparator(date: message.createdAt, langCode: widget.myLang),
                            // CHAT_SPEC.md §8: "الرد على رسالة: سحب أفقي
                            // على الفقاعة → اقتباس داخل الفقاعة الجديدة".
                            // Dismissible توفّر الحركة البصرية التدريجية
                            // جاهزة؛ confirmDismiss تُعيد false دائماً —
                            // السحب يُفعِّل الرد فقط، لا يحذف الرسالة أبداً.
                            Dismissible(
                              key: ValueKey('reply-${message.id}'),
                              direction: message.isDeletedForEveryone ? DismissDirection.none : DismissDirection.startToEnd,
                              dismissThresholds: const {DismissDirection.startToEnd: 0.28},
                              background: Container(
                                alignment: AlignmentDirectional.centerStart,
                                padding: const EdgeInsetsDirectional.only(start: 20),
                                child: const Icon(Icons.reply_rounded, color: AppColors.brand),
                              ),
                              confirmDismiss: (_) async {
                                context.read<ChatBloc>().add(ChatReplyTargetChanged(message));
                                return false;
                              },
                              child: GestureDetector(
                                onLongPress: message.isDeletedForEveryone ? null : () => _showMessageActions(context, message),
                                child: MessageBubble(
                                  message: message,
                                  isMine: message.senderId == widget.currentUserId,
                                  myLang: widget.myLang,
                                  showOriginalSetting: settingsState.showOriginalEnabled,
                                // CHAT_SPEC.md §1: لا اسم مرسِل في المحادثة
                                // الفردية. widget.conversation قد تكون null
                                // (فتح رابط مباشر بلا مرور بالقائمة) —
                                // الاحتياط الآمن هنا "جماعية" (تُظهر الاسم)
                                // بدل إخفائه خطأً في محادثة جماعية فعلية.
                                  isGroupChat: widget.conversation?.type != ConversationType.direct,
                                  isGroupedWithPrevious: isGroupedWithPrevious,
                                  allConversationImageUrls: allImageUrls,
                                  onListen: () => _tts.speak(message.displayText(widget.myLang), languageCode: widget.myLang),
                                  onRetryTranscription: () => context.read<ChatBloc>().add(ChatRetryVoiceTranscriptionRequested(message.id)),
                                  onRetryTranslation: () => context.read<ChatBloc>().add(ChatRetranslateRequested(widget.myLang)),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
          if (_editingMessageId != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(color: AppColors.brandLight, border: Border(top: BorderSide(color: AppColors.divider))),
              child: Row(
                children: [
                  const Icon(Icons.edit_outlined, size: 16, color: AppColors.brandDark),
                  const SizedBox(width: 6),
                  const Expanded(
                    child: Text('تعديل الرسالة', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.brandDark)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textSecondary),
                    onPressed: () => setState(() {
                      _editingMessageId = null;
                      _textController.clear();
                    }),
                  ),
                ],
              ),
            ),
          BlocBuilder<ChatBloc, ChatState>(
            buildWhen: (p, c) => p.replyTarget != c.replyTarget,
            builder: (context, state) {
              if (state.replyTarget == null) return const SizedBox.shrink();
              final target = state.replyTarget!;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: const BoxDecoration(
                  color: AppColors.brandLight,
                  border: Border(top: BorderSide(color: AppColors.divider)),
                ),
                child: Row(
                  children: [
                    Container(width: 3, height: 32, color: AppColors.brand),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('الردّ على ${target.senderName}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.brandDark)),
                          Text(
                            target.text ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textSecondary),
                      onPressed: () => context.read<ChatBloc>().add(const ChatReplyTargetChanged(null)),
                    ),
                  ],
                ),
              );
            },
          ),
          SafeArea(
            top: false,
            child: _isChannelReadOnly
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    color: AppColors.divider,
                    child: Row(
                      children: [
                        const Icon(Icons.lock_outline_rounded, size: 18, color: AppColors.textSecondary),
                        const SizedBox(width: Gap.sm),
                        Expanded(
                          child: Text(
                            'errors.channel_read_only'.tr(),
                            style: const TextStyle(fontSize: FS.caption, color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                  )
                : Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  if (!_isRecordingVoice)
                    IconButton(
                      icon: const Icon(Icons.attach_file_rounded, color: AppColors.textSecondary),
                      onPressed: _pickAttachment,
                    ),
                  // مثيل واحد ثابت دائماً في الشجرة — لا فرعان منفصلان.
                  // التبديل بين "أيقونة صغيرة" و"شريط كامل العرض" يحدث
                  // *داخل* VoiceRecorderButton.build() نفسها بحسب حالتها
                  // الداخلية، لا عبر إعادة إنشائها من الخارج (ذلك كان
                  // يُدمِّر حالة التسجيل الجارية فور بدئها).
                  _isRecordingVoice
                      ? Expanded(
                          child: VoiceRecorderButton(
                            key: _voiceRecorderKey,
                            onRecordingChanged: (recording) => setState(() => _isRecordingVoice = recording),
                            onRecorded: (path, durationMs) {
                              if (context.read<ChatBloc>().state.isSending) return;
                              context.read<ChatBloc>().add(ChatVoiceMessageSent(audioFilePath: path, durationMs: durationMs));
                            },
                          ),
                        )
                      : VoiceRecorderButton(
                          key: _voiceRecorderKey,
                          onRecordingChanged: (recording) => setState(() => _isRecordingVoice = recording),
                          onRecorded: (path, durationMs) {
                            if (context.read<ChatBloc>().state.isSending) return;
                            context.read<ChatBloc>().add(ChatVoiceMessageSent(audioFilePath: path, durationMs: durationMs));
                          },
                        ),
                  if (!_isRecordingVoice) ...[
                    Expanded(
                      child: TextField(
                        controller: _textController,
                        decoration: const InputDecoration(hintText: 'اكتب رسالة...', border: OutlineInputBorder()),
                        onChanged: (v) => context.read<ChatBloc>().add(ChatTypingIndicatorChanged(v.isNotEmpty)),
                        onSubmitted: (_) => _sendText(),
                      ),
                    ),
                    const SizedBox(width: 4),
                    BlocBuilder<ChatBloc, ChatState>(
                      buildWhen: (p, c) => p.isSending != c.isSending,
                      builder: (context, state) => IconButton(
                        icon: state.isSending
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : Transform.flip(
                                flipX: Directionality.of(context) == TextDirection.rtl,
                                child: const Icon(Icons.send, color: AppColors.brand),
                              ),
                        onPressed: state.isSending ? null : _sendText,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }

  // ---- Group 1 (WhatsApp parity): image/document attachment picker ----------
  void _pickAttachment() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined, color: AppColors.brand),
              title: const Text('التقاط صورة'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_outlined, color: AppColors.brand),
              title: const Text('اختيار من المعرض'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file_outlined, color: AppColors.brand),
              title: const Text('مستند'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickDocument();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 75);
    if (picked == null || !mounted) return;
    context.read<ChatBloc>().add(ChatSendAttachmentRequested(filePath: picked.path, kind: MessageAttachmentKind.image));
  }

  bool _isSameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  static const _quickEmojis = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  void _showMessageActions(BuildContext context, MessageEntity message) {
    final isMine = message.senderId == widget.currentUserId;
    final canEdit = isMine && message.type == MessageType.text && !message.isDeletedForEveryone;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),

            // ---- Group 3 (WhatsApp parity): quick emoji reaction row ----
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: _quickEmojis
                    .map((emoji) => InkWell(
                          borderRadius: BorderRadius.circular(24),
                          onTap: () {
                            Navigator.pop(sheetContext);
                            context.read<ChatBloc>().add(ChatReactToMessageRequested(
                                  messageId: message.id,
                                  emoji: emoji,
                                  myUserId: widget.currentUserId,
                                ));
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(6),
                            child: Text(emoji, style: const TextStyle(fontSize: 26)),
                          ),
                        ))
                    .toList(),
              ),
            ),
            const Divider(height: 20, color: AppColors.divider),

            ListTile(
              leading: const Icon(Icons.reply_rounded, color: AppColors.brand),
              title: const Text('ردّ'),
              onTap: () {
                Navigator.pop(sheetContext);
                context.read<ChatBloc>().add(ChatReplyTargetChanged(message));
              },
            ),
            if (canEdit)
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: AppColors.brand),
                title: const Text('تعديل'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  setState(() {
                    _editingMessageId = message.id;
                    _textController.text = message.text ?? '';
                    _textController.selection = TextSelection.collapsed(offset: _textController.text.length);
                  });
                },
              ),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: AppColors.textSecondary),
              title: const Text('حذف لديّ فقط'),
              onTap: () {
                Navigator.pop(sheetContext);
                context.read<ChatBloc>().add(ChatLocalDeleteRequested(message.id));
              },
            ),
            if (isMine)
              ListTile(
                leading: const Icon(Icons.delete_forever_rounded, color: AppColors.danger),
                title: const Text('حذف لدى الجميع', style: TextStyle(color: AppColors.danger)),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _confirmDeleteForEveryone(context, message.id);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _confirmDeleteForEveryone(BuildContext context, String messageId) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('حذف لدى الجميع؟'),
        content: const Text('لن يتمكّن أي شخص في هذه المحادثة من رؤية هذه الرسالة بعد الآن.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              context.read<ChatBloc>().add(ChatDeleteMessageRequested(messageId));
            },
            child: const Text('حذف', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }

  Future<void> _pickDocument() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.any, withData: false);
    final path = result?.files.single.path;
    if (path == null || !mounted) return;
    context.read<ChatBloc>().add(ChatSendAttachmentRequested(
          filePath: path,
          kind: MessageAttachmentKind.document,
          caption: result!.files.single.name,
        ));
  }
}

/// Group 1 (WhatsApp parity): "اليوم" / "أمس" / full date pill between
/// message groups from different days.
class _DateSeparator extends StatelessWidget {
  final DateTime date;
  final String langCode;
  const _DateSeparator({required this.date, required this.langCode});

  static const _arabicMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      // CHAT_SPEC.md §1: هامش رأسي 16dp (كان 10).
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Container(
          // CHAT_SPEC.md §1: حشو 6×12 بالضبط.
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: AppColors.brandLight, borderRadius: BorderRadius.circular(20)),
          child: Text(_label(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.brandDark)),
        ),
      ),
    );
  }

  String _label() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(date.year, date.month, date.day);
    final diff = today.difference(target).inDays;
    if (diff == 0) return 'اليوم';
    if (diff == 1) return 'أمس';
    // CHAT_SPEC.md §1: "٣ أغسطس ٢٠٢٦" — تاريخ كامل بأرقام عربية-هندية
    // واسم شهر عربي، لا تنسيق مختصر بأرقام لاتينية.
    final day = localizedDigits('${date.day}', langCode);
    final year = localizedDigits('${date.year}', langCode);
    return '$day ${_arabicMonths[date.month - 1]} $year';
  }
}
