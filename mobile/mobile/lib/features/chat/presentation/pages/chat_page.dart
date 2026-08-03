import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/tts/tts_service.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../profile/presentation/bloc/settings_cubit.dart';
import '../../domain/entities/message_entity.dart';
import '../bloc/chat_bloc.dart';
import '../widgets/message_bubble.dart';
import '../widgets/voice_recorder_button.dart';

class ChatPage extends StatelessWidget {
  final String conversationId;
  final UserEntity currentUser;

  const ChatPage({super.key, required this.conversationId, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ChatBloc>(param1: currentUser.companyId, param2: conversationId)..add(const ChatStarted()),
      child: _ChatView(currentUserId: currentUser.id, myLang: currentUser.preferredLanguage),
    );
  }
}

class _ChatView extends StatefulWidget {
  final String currentUserId;
  final String myLang;
  const _ChatView({required this.currentUserId, required this.myLang});

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final _tts = sl<TtsService>();
  int _previousMessageCount = 0;

  @override
  void dispose() {
    context.read<ChatBloc>().add(const ChatEnded());
    _textController.dispose();
    _scrollController.dispose();
    _tts.stop();
    super.dispose();
  }

  void _sendText() {
    if (_textController.text.trim().isEmpty) return;
    context.read<ChatBloc>().add(ChatTextMessageSent(_textController.text));
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
    return Scaffold(
      appBar: AppBar(
        title: BlocBuilder<ChatBloc, ChatState>(
          buildWhen: (p, c) => p.isPeerTyping != c.isPeerTyping || p.isSocketConnected != c.isSocketConnected,
          builder: (context, state) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('محادثة', style: TextStyle(fontSize: 16)),
              if (state.isPeerTyping)
                const Text('يكتب الآن...', style: TextStyle(fontSize: 12, color: Colors.green))
              else
                Text(
                  state.isSocketConnected ? 'متصل' : 'غير متصل',
                  style: TextStyle(fontSize: 12, color: state.isSocketConnected ? Colors.green : Colors.grey),
                ),
            ],
          ),
        ),
        actions: [
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
                    return ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(12),
                      itemCount: state.messages.length,
                      itemBuilder: (context, index) {
                        final MessageEntity message = state.messages[index];
                        return MessageBubble(
                          message: message,
                          isMine: message.senderId == widget.currentUserId,
                          myLang: widget.myLang,
                          showOriginalSetting: settingsState.showOriginalEnabled,
                          onListen: () => _tts.speak(message.displayText(widget.myLang), languageCode: widget.myLang),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  VoiceRecorderButton(
                    onRecorded: (path, durationMs) =>
                        context.read<ChatBloc>().add(ChatVoiceMessageSent(audioFilePath: path, durationMs: durationMs)),
                  ),
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
                          : const Icon(Icons.send, color: Color(0xFF2563EB)),
                      onPressed: state.isSending ? null : _sendText,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
