import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:uuid/uuid.dart';
import '../../domain/entities/message_attachment_entity.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import '../../domain/usecases/get_messages_usecase.dart';
import '../../domain/usecases/mark_read_usecase.dart';
import '../../domain/usecases/send_text_message_usecase.dart';
import '../../domain/usecases/send_voice_message_usecase.dart';

part 'chat_event.dart';
part 'chat_state.dart';

class ChatBloc extends Bloc<ChatEvent, ChatState> {
  final String companyId;
  final String conversationId;
  final ChatRepository _repository;
  final GetMessagesUseCase _getMessages;
  final SendTextMessageUseCase _sendTextMessage;
  final SendVoiceMessageUseCase _sendVoiceMessage;
  final MarkReadUseCase _markRead;

  // BUG FIX (confirmed via real user report: duplicate persists after
  // my first "sequential" fix): sequential() applied per-event-TYPE
  // only serializes events of that SAME type against each other —
  // package:bloc gives each `on<T>()` its own independent processing
  // queue, so ChatTextMessageSent (direct REST-response append) and
  // ChatMessageReceived (near-simultaneous socket echo of that exact
  // message) — being DIFFERENT event types — could still interleave:
  // the socket handler's `alreadyPresent` check could run against
  // `state.messages` before the REST handler's emit() has landed,
  // pass the check, and append a genuine second in-memory copy. A
  // real mutex serializes EVERY handler that reads-then-mutates
  // messages, regardless of which event type triggered it — this is
  // the only construct that actually closes the cross-type race.
  Future<void> _messagesLock = Future.value();
  Future<T> _withMessagesLock<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _messagesLock = _messagesLock.then((_) async {
      try {
        completer.complete(await action());
      } catch (e) {
        completer.completeError(e);
      }
    });
    return completer.future;
  }

  StreamSubscription<MessageEntity>? _messageSub;
  StreamSubscription<MessageEntity>? _translatedSub;
  StreamSubscription<(String, MessageDeliveryStatus)>? _statusChangedSub;
  StreamSubscription<Map<String, dynamic>>? _typingSub;
  StreamSubscription<bool>? _connectionSub;

  ChatBloc({
    required this.companyId,
    required this.conversationId,
    required ChatRepository repository,
    required GetMessagesUseCase getMessages,
    required SendTextMessageUseCase sendTextMessage,
    required SendVoiceMessageUseCase sendVoiceMessage,
    required MarkReadUseCase markRead,
  })  : _repository = repository,
        _getMessages = getMessages,
        _sendTextMessage = sendTextMessage,
        _sendVoiceMessage = sendVoiceMessage,
        _markRead = markRead,
        super(const ChatState()) {
    // BUG FIX (confirmed via real user report: duplicate messages
    // visible only WHILE inside the conversation, vanishing to a
    // single copy the moment you leave and re-enter — proving the
    // duplicate was purely in-memory, never a second database row).
    // package:bloc's default EventTransformer processes events
    // CONCURRENTLY, not sequentially — if two ChatMessageReceived
    // events for the SAME message arrive close together (a duplicate
    // socket listener, or even just the normal REST-echo-then-socket
    // path under bad timing), the second handler could start running
    // — and read the still-stale `state.messages` — before the first
    // handler's emit() has actually landed, so the id-based de-dupe
    // check in both passes and both append the message. _seq() forces
    // strict one-at-a-time processing: emit() from event N always
    // completes before event N+1's handler even starts, closing this
    // race regardless of how many listeners exist upstream. Applied to
    // every handler that reads-then-mutates state.messages.
    on<ChatStarted>(_onStarted);
    on<ChatEnded>(_onEnded);
    on<ChatTextMessageSent>(_onTextMessageSent, transformer: _seq());
    on<ChatVoiceMessageSent>(_onVoiceMessageSent, transformer: _seq());
    on<ChatMarkReadRequested>(_onMarkReadRequested);
    on<ChatTypingIndicatorChanged>(_onTypingIndicatorChanged);
    on<ChatMessageReceived>(_onMessageReceived, transformer: _seq());
    on<ChatMessageTranslated>(_onMessageTranslated, transformer: _seq());
    on<ChatMessageStatusChanged>(_onMessageStatusChanged, transformer: _seq());
    on<ChatPeerTypingReceived>(_onPeerTypingReceived);
    on<ChatRetranslateRequested>(_onRetranslateRequested);
    on<ChatRetryVoiceTranscriptionRequested>(_onRetryVoiceTranscriptionRequested);
    on<ChatSendAttachmentRequested>(_onSendAttachmentRequested, transformer: _seq());
    on<ChatDeleteMessageRequested>(_onDeleteMessageRequested);
    on<ChatLocalDeleteRequested>(_onLocalDeleteRequested);
    on<ChatReplyTargetChanged>(_onReplyTargetChanged);
    on<ChatReactToMessageRequested>(_onReactToMessageRequested);
    on<ChatEditMessageRequested>(_onEditMessageRequested);
    on<ChatReconnectedRefreshRequested>(_onReconnectedRefresh);
  }

  Future<void> _onStarted(ChatStarted event, Emitter<ChatState> emit) async {
    emit(state.copyWith(status: ChatStatus.loading));

    // BUG FIX (confirmed real gap): _onStarted can run more than once on
    // the SAME bloc instance — the "retry" button on a failed initial
    // fetch (chat_page.dart) dispatches ChatStarted again without ever
    // disposing this bloc first. Every subscription below was being
    // re-assigned WITHOUT cancelling its prior value, so a retry left
    // the OLD subscription still alive and listening forever alongside
    // the new one — every socket event after that fired the matching
    // handler twice (message:new, message:translated, etc.) from two
    // fully independent, permanently-leaked subscriptions. Cancelling
    // first makes every (re-)start idempotent regardless of how many
    // times it's dispatched.
    await _connectionSub?.cancel();
    await _messageSub?.cancel();
    await _translatedSub?.cancel();
    await _statusChangedSub?.cancel();
    await _typingSub?.cancel();

    // Join the Socket.io room for this conversation FIRST so no message
    // sent by the peer in the gap between history-fetch and subscription
    // is missed.
    _repository.joinConversation(conversationId);

    // BUG FIX (confirmed via real user reports: messages only arrive
    // after leaving and reopening the chat): Socket.io room membership
    // lives on the CONNECTION, not the user — if the underlying socket
    // ever reconnects while this chat is open (a JWT refresh, the
    // WebSocketClient watchdog fixing a stale connection, a brief
    // network blip), the fresh connection starts with NO rooms joined
    // at all, and this conversation's `message:new` events silently
    // stop arriving with no error anywhere. joinConversation was only
    // ever called ONCE, when the chat page first opened. Re-joining on
    // every reconnect (not just the first connect) closes that gap —
    // and re-fetching history alongside it catches anything sent during
    // the gap itself, which a bare re-join wouldn't recover.
    _connectionSub = _repository.onConnectionChanged.listen((connected) {
      if (connected) {
        _repository.joinConversation(conversationId);
        add(const ChatReconnectedRefreshRequested());
      }
    });

    _messageSub = _repository.onMessageReceived
        .where((m) => m.conversationId == conversationId)
        .listen((m) => add(ChatMessageReceived(m)));

    // BUG FIX (confirmed real regression: messages arriving live via
    // socket almost always beat their own background translation to
    // the client, so they'd render untranslated and simply stay that
    // way forever — nothing ever told this bloc a translation later
    // became available). message:translated re-delivers the SAME
    // message with its translations now populated; _onMessageTranslated
    // below replaces the matching entry in place rather than appending.
    _translatedSub = _repository.onMessageTranslated
        .where((m) => m.conversationId == conversationId)
        .listen((m) => add(ChatMessageTranslated(m)));

    // REVIEW_ROUND7.md §4: بلا هذا الاشتراك، تغيّر الحالة الفعلي في
    // قاعدة البيانات (SENT→DELIVERED→READ) لا يصل هذه الشاشة إطلاقاً.
    _statusChangedSub = _repository.onMessageStatusChanged.listen((event) {
      add(ChatMessageStatusChanged(event.$1, event.$2));
    });

    _typingSub = _repository.onTypingChanged.listen((data) {
      add(ChatPeerTypingReceived(data['isTyping'] as bool? ?? false));
    });

    final result = await _getMessages(GetMessagesParams(companyId: companyId, conversationId: conversationId));
    result.fold(
      (failure) => emit(state.copyWith(status: ChatStatus.failure, errorMessage: failure.message)),
      (messages) => emit(state.copyWith(
        status: ChatStatus.success,
        // API returns newest-first; render oldest-first for a standard chat UI.
        messages: messages.reversed.toList(),
      )),
    );

    add(const ChatMarkReadRequested());
  }

  Future<void> _onReconnectedRefresh(ChatReconnectedRefreshRequested event, Emitter<ChatState> emit) async {
    final result = await _getMessages(GetMessagesParams(companyId: companyId, conversationId: conversationId));
    await result.fold(
      (_) async {}, // best-effort — the socket subscription above still works going forward regardless
      (messages) => _withMessagesLock(() async {
        final merged = [...messages.reversed];
        emit(state.copyWith(messages: merged));
      }),
    );
  }

  Future<void> _onEnded(ChatEnded event, Emitter<ChatState> emit) async {
    _repository.leaveConversation(conversationId);
    await _connectionSub?.cancel();
    await _messageSub?.cancel();
    await _translatedSub?.cancel();
    await _statusChangedSub?.cancel();
    await _typingSub?.cancel();
  }

  Future<void> _onTextMessageSent(ChatTextMessageSent event, Emitter<ChatState> emit) async {
    if (event.text.trim().isEmpty) return;
    emit(state.copyWith(isSending: true));
    // REVIEW_ROUND7.md §1: UUID مُولَّد مرة واحدة هنا (قبل أي طلب شبكة)
    // ويُرسَل مع الرسالة — الخادم يرفض أي محاولة ثانية بنفس المعرّف
    // (قيد فرادة حقيقي)، فحتى لو تجاوز استدعاء ثانٍ حارس isSending بأي
    // طريقة لم تُتوقَّع، لن يُنشأ سجل مكرَّر في قاعدة البيانات.
    final clientMessageId = const Uuid().v4();
    final result = await _sendTextMessage(
      SendTextMessageParams(
        companyId: companyId,
        conversationId: conversationId,
        text: event.text.trim(),
        replyToId: event.replyToId,
        clientMessageId: clientMessageId,
      ),
    );
    await result.fold(
      (failure) async => emit(state.copyWith(isSending: false, errorMessage: failure.message)),
      (message) => _withMessagesLock(() async {
        // BUG FIX: this direct append (from the REST response) races
        // against _onMessageReceived's socket-echo de-dupe check for
        // the SAME message — both being different Bloc event types
        // means package:bloc's own per-type sequencing can't protect
        // this. The shared mutex (_withMessagesLock) now does.
        emit(state.copyWith(isSending: false, messages: [...state.messages, message], clearReplyTarget: true));
      }),
    );
  }

  void _onReplyTargetChanged(ChatReplyTargetChanged event, Emitter<ChatState> emit) {
    if (event.target == null) {
      emit(state.copyWith(clearReplyTarget: true));
    } else {
      emit(state.copyWith(replyTarget: event.target));
    }
  }

  /// "Delete for me" — filters the message out of THIS device's list only.
  /// No server call: reopening the conversation (or another device) will
  /// still show it, matching the honest scope documented in
  /// ChatRepository.deleteMessage's doc comment.
  void _onLocalDeleteRequested(ChatLocalDeleteRequested event, Emitter<ChatState> emit) {
    emit(state.copyWith(messages: state.messages.where((m) => m.id != event.messageId).toList()));
  }

  Future<void> _onDeleteMessageRequested(ChatDeleteMessageRequested event, Emitter<ChatState> emit) async {
    final result = await _repository.deleteMessage(companyId, conversationId, event.messageId);
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failure.message)),
      (_) {
        // Reflect the tombstone locally immediately rather than waiting
        // for the next full reload — same id, content blanked, flagged.
        final updated = state.messages.map((m) {
          if (m.id != event.messageId) return m;
          return MessageEntity(
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderName: m.senderName,
            type: m.type,
            status: m.status,
            createdAt: m.createdAt,
            originalLang: m.originalLang,
            isDeletedForEveryone: true,
          );
        }).toList();
        emit(state.copyWith(messages: updated));
      },
    );
  }

  Future<void> _onReactToMessageRequested(ChatReactToMessageRequested event, Emitter<ChatState> emit) async {
    // Optimistic: flip the local reaction immediately (toggle semantics
    // matching the server exactly — same emoji again removes it) so the
    // UI never waits on a round-trip for something this lightweight.
    final optimistic = state.messages.map((m) {
      if (m.id != event.messageId) return m;
      final current = Map<String, String>.from(m.reactions);
      if (current[event.myUserId] == event.emoji) {
        current.remove(event.myUserId);
      } else {
        current[event.myUserId] = event.emoji;
      }
      return MessageEntity(
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.senderName,
        type: m.type,
        status: m.status,
        text: m.text,
        audioUrl: m.audioUrl,
        audioDurationMs: m.audioDurationMs,
        createdAt: m.createdAt,
        originalLang: m.originalLang,
        translations: m.translations,
        attachments: m.attachments,
        replyTo: m.replyTo,
        isDeletedForEveryone: m.isDeletedForEveryone,
        editedAt: m.editedAt,
        reactions: current,
      );
    }).toList();
    emit(state.copyWith(messages: optimistic));

    final result = await _repository.reactToMessage(companyId, conversationId, event.messageId, event.emoji);
    result.fold(
      // Best-effort revert-by-reload on failure — reactions are low-stakes
      // enough that a full rollback isn't worth the extra state-machine
      // complexity; the next natural reload (or socket echo) corrects it.
      (failure) => emit(state.copyWith(errorMessage: failure.message)),
      (_) {},
    );
  }

  Future<void> _onEditMessageRequested(ChatEditMessageRequested event, Emitter<ChatState> emit) async {
    final result = await _repository.editMessage(companyId, conversationId, event.messageId, event.newText);
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failure.message)),
      (edited) {
        // Editing invalidates translations server-side too (see
        // MessagesService.editMessage) — cleared here to match, so a
        // stale translation of the OLD wording is never shown.
        final updated = state.messages.map((m) {
          if (m.id != event.messageId) return m;
          return MessageEntity(
            id: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            senderName: m.senderName,
            type: m.type,
            status: m.status,
            text: edited.text,
            audioUrl: m.audioUrl,
            audioDurationMs: m.audioDurationMs,
            createdAt: m.createdAt,
            originalLang: m.originalLang,
            translations: const {},
            attachments: m.attachments,
            replyTo: m.replyTo,
            isDeletedForEveryone: m.isDeletedForEveryone,
            reactions: m.reactions,
            editedAt: edited.editedAt,
          );
        }).toList();
        emit(state.copyWith(messages: updated));
      },
    );
  }

  Future<void> _onVoiceMessageSent(ChatVoiceMessageSent event, Emitter<ChatState> emit) async {
    emit(state.copyWith(isSending: true));
    // REVIEW_ROUND7.md §1 gap fix (confirmed via real screenshots: one
    // voice message showing twice, one translated one "failed") — same
    // protection as text messages, which the voice path never received.
    final clientMessageId = const Uuid().v4();
    final result = await _sendVoiceMessage(
      SendVoiceMessageParams(
        companyId: companyId,
        conversationId: conversationId,
        audioFilePath: event.audioFilePath,
        durationMs: event.durationMs,
        clientMessageId: clientMessageId,
      ),
    );
    await result.fold(
      (failure) async => emit(state.copyWith(isSending: false, errorMessage: failure.message)),
      (message) => _withMessagesLock(() async {
        emit(state.copyWith(isSending: false, messages: [...state.messages, message]));
      }),
    );
  }

  Future<void> _onMarkReadRequested(ChatMarkReadRequested event, Emitter<ChatState> emit) async {
    await _markRead(MarkReadParams(companyId: companyId, conversationId: conversationId));
  }

  void _onTypingIndicatorChanged(ChatTypingIndicatorChanged event, Emitter<ChatState> emit) {
    _repository.sendTypingIndicator(conversationId, event.isTyping);
  }

  Future<void> _onMessageReceived(ChatMessageReceived event, Emitter<ChatState> emit) {
    return _withMessagesLock(() async {
      final alreadyPresent = state.messages.any((m) => m.id == event.message.id);
      if (alreadyPresent) return;
      emit(state.copyWith(messages: [...state.messages, event.message]));
      add(const ChatMarkReadRequested());
    });
  }

  Future<void> _onMessageTranslated(ChatMessageTranslated event, Emitter<ChatState> emit) {
    return _withMessagesLock(() async {
      final index = state.messages.indexWhere((m) => m.id == event.message.id);
      if (index == -1) return; // message already scrolled out of the loaded window, or history was since refreshed — nothing to update
      final updated = [...state.messages];
      updated[index] = event.message;
      emit(state.copyWith(messages: updated));
    });
  }

  /// REVIEW_ROUND7.md §4: يحدّث علامة التسليم لرسالة واحدة بمعرّفها،
  /// دون إعادة جلب المحادثة بأكملها.
  Future<void> _onMessageStatusChanged(ChatMessageStatusChanged event, Emitter<ChatState> emit) {
    return _withMessagesLock(() async {
      final index = state.messages.indexWhere((m) => m.id == event.messageId);
      if (index == -1) return;
      final updated = [...state.messages];
      updated[index] = updated[index].copyWith(status: event.status);
      emit(state.copyWith(messages: updated));
    });
  }

  void _onPeerTypingReceived(ChatPeerTypingReceived event, Emitter<ChatState> emit) {
    emit(state.copyWith(isPeerTyping: event.isTyping));
  }

  Future<void> _onRetranslateRequested(ChatRetranslateRequested event, Emitter<ChatState> emit) async {
    emit(state.copyWith(isRetranslating: true));
    final result = await _repository.retranslateConversation(companyId, conversationId, event.targetLanguage);
    await result.fold(
      (failure) async => emit(state.copyWith(isRetranslating: false, errorMessage: failure.message)),
      (_) async {
        // Reload so the newly-backfilled MessageTranslation rows show up.
        final reload = await _getMessages(GetMessagesParams(companyId: companyId, conversationId: conversationId));
        reload.fold(
          (failure) => emit(state.copyWith(isRetranslating: false, errorMessage: failure.message)),
          (messages) => emit(state.copyWith(isRetranslating: false, messages: messages.reversed.toList())),
        );
      },
    );
  }

  /// A1 (real-user review, 2026-08-05). Fire-and-forget — success shows
  /// up via the SAME message:translated socket event the original
  /// transcription attempt used; only an IMMEDIATE failure (e.g. no
  /// network at all) surfaces here.
  Future<void> _onRetryVoiceTranscriptionRequested(ChatRetryVoiceTranscriptionRequested event, Emitter<ChatState> emit) async {
    final result = await _repository.retryVoiceTranscription(companyId, conversationId, event.messageId);
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failure.message)),
      (_) {},
    );
  }

  Future<void> _onSendAttachmentRequested(ChatSendAttachmentRequested event, Emitter<ChatState> emit) async {
    emit(state.copyWith(isSending: true));
    final result = await _repository.sendAttachment(
      companyId,
      conversationId,
      filePath: event.filePath,
      kind: event.kind,
      caption: event.caption,
    );
    await result.fold(
      (failure) async => emit(state.copyWith(isSending: false, errorMessage: failure.message)),
      // Same race the mutex protects against in _onTextMessageSent: the
      // socket also echoes this back near-instantly.
      (message) => _withMessagesLock(() async {
        emit(state.copyWith(isSending: false, messages: [...state.messages, message]));
      }),
    );
  }

  @override
  Future<void> close() async {
    _messageSub?.cancel();
    _translatedSub?.cancel();
    _statusChangedSub?.cancel();
    _typingSub?.cancel();
    _connectionSub?.cancel();
    return super.close();
  }
}

/// إعادة تنفيذ محلية بلا تبعية خارجية لـ `sequential()` من حزمة
/// bloc_concurrency (وهي نفسها سطر واحد فقط) — يضمن معالجة كل حدث
/// بالكامل (بما فيها emit()) قبل بدء معالجة الحدث التالي من نفس
/// النوع، بدل السلوك الافتراضي المتزامن (concurrent) في package:bloc.
EventTransformer<E> _seq<E>() => (events, mapper) => events.asyncExpand(mapper);
