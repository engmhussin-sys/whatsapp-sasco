import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/diagnostics/event_trace_log.dart';
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
  // BUG FIX (confirmed real, root cause of "must leave and re-enter for
  // status/translation to update"): a genuine race between the REST
  // response that first adds a just-sent message to state.messages, and
  // the Socket broadcast of its delivery-status change — Socket.IO,
  // being an already-open persistent connection, can genuinely arrive
  // and get processed BEFORE the HTTP response for the very request
  // that triggered it. When that happens, _onMessageStatusChanged found
  // no matching id (index == -1) and silently discarded the update
  // forever — the message then landed moments later with its original
  // SENT status, never corrected until a fresh REST reload (leave +
  // re-enter) pulled the true up-to-date status from the database.
  // Any status update that can't find its target message is now
  // queued here instead of dropped, and applied the moment the message
  // actually appears (in _onTextMessageSent, _onVoiceMessageSent,
  // _onMessageReceived, and _onSendAttachmentRequested).
  final Map<String, MessageDeliveryStatus> _pendingStatusUpdates = {};
  // نفس السباق بالضبط، لكن للترجمة — الرسالة المُترجَمة الكاملة (وليست
  // قيمة واحدة) تُخزَّن بانتظار وصول النسخة الأصلية لهذه القائمة.
  final Map<String, MessageEntity> _pendingTranslations = {};
  Future<T> _withMessagesLock<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _messagesLock = _messagesLock.then((_) async {
      try {
        // BUG FIX (confirmed real user report: live translation/status
        // updates stopped working specifically after the duplicate-
        // message fixes were deployed, requiring leave+re-enter — a
        // brand new ChatBloc, hence a brand new, unpoisoned lock — to
        // work again for a while). This is the exact signature of a
        // "poisoned mutex": if any single action chained onto
        // _messagesLock ever hung indefinitely for ANY reason (even one
        // not yet pinpointed), every subsequent call — text/voice send,
        // translation, delivery status, new messages — would queue
        // behind it and never run for the rest of THIS ChatBloc's
        // lifetime, with zero visible error. A bounded timeout here
        // closes off that entire class of bug: a single hung action now
        // fails after 10s instead of freezing everything after it
        // forever, and the lock itself keeps moving regardless.
        completer.complete(await action().timeout(const Duration(seconds: 10)));
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
        .listen((m) {
      EventTraceLog.log('ReceiverSocketReceived(message:translated)', messageId: m.id, conversationId: m.conversationId, extra: 'text=${m.text?.substring(0, m.text!.length.clamp(0, 20))}');
      add(ChatMessageTranslated(m));
    });

    // REVIEW_ROUND7.md §4: بلا هذا الاشتراك، تغيّر الحالة الفعلي في
    // قاعدة البيانات (SENT→DELIVERED→READ) لا يصل هذه الشاشة إطلاقاً.
    _statusChangedSub = _repository.onMessageStatusChanged.listen((event) {
      EventTraceLog.log('ReceiverSocketReceived(message:status_changed)', messageId: event.$1, extra: 'status=${event.$2}');
      add(ChatMessageStatusChanged(event.$1, event.$2));
    });

    _typingSub = _repository.onTypingChanged.listen((data) {
      add(ChatPeerTypingReceived(data['isTyping'] as bool? ?? false));
    });

    final result = await _getMessages(GetMessagesParams(companyId: companyId, conversationId: conversationId));
    result.fold(
      (failure) => emit(state.copyWith(status: ChatStatus.failure, errorMessage: failure.message)),
      (messages) {
        _pendingStatusUpdates.clear();
        _pendingTranslations.clear();
        emit(state.copyWith(
          status: ChatStatus.success,
          // API returns newest-first; render oldest-first for a standard chat UI.
          messages: messages.reversed.toList(),
        ));
      },
    );

    add(const ChatMarkReadRequested());
  }

  Future<void> _onReconnectedRefresh(ChatReconnectedRefreshRequested event, Emitter<ChatState> emit) async {
    final result = await _getMessages(GetMessagesParams(companyId: companyId, conversationId: conversationId));
    await result.fold(
      (_) async {}, // best-effort — the socket subscription above still works going forward regardless
      (messages) => _withMessagesLock(() async {
        _pendingStatusUpdates.clear();
        _pendingTranslations.clear();
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
        emit(state.copyWith(isSending: false, messages: [...state.messages, _applyPendingStatus(message)], clearReplyTarget: true));
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
    EventTraceLog.log('UploadStarted(voice)', conversationId: conversationId);
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
      (failure) async {
        EventTraceLog.log('UploadFinished(voice) — FAILED', extra: failure.message);
        emit(state.copyWith(isSending: false, errorMessage: failure.message));
      },
      (message) => _withMessagesLock(() async {
        EventTraceLog.log('UploadFinished(voice) — MessageInserted', messageId: message.id, conversationId: message.conversationId);
        emit(state.copyWith(isSending: false, messages: [...state.messages, _applyPendingStatus(message)]));
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
      emit(state.copyWith(messages: [...state.messages, _applyPendingStatus(event.message)]));
      add(const ChatMarkReadRequested());
    });
  }

  Future<void> _onMessageTranslated(ChatMessageTranslated event, Emitter<ChatState> emit) {
    return _withMessagesLock(() async {
      final index = state.messages.indexWhere((m) => m.id == event.message.id);
      if (index == -1) {
        // نفس سباق REST/Socket الموثَّق في _onMessageStatusChanged —
        // البث وصل قبل أن تُضاف الرسالة أصلاً لهذه القائمة.
        EventTraceLog.log('BlocEventReceived(translated) — NOT FOUND, queued', messageId: event.message.id, extra: 'currentMessagesCount=${state.messages.length}');
        _pendingTranslations[event.message.id] = event.message;
        return;
      }
      final updated = [...state.messages];
      updated[index] = event.message;
      final newState = state.copyWith(messages: updated);
      EventTraceLog.log(
        'BlocEmit(translated)',
        messageId: event.message.id,
        extra: 'oldStateHash=${state.hashCode} newStateHash=${newState.hashCode} equal=${state == newState}',
      );
      emit(newState);
    });
  }

  /// REVIEW_ROUND7.md §4: يحدّث علامة التسليم لرسالة واحدة بمعرّفها،
  /// دون إعادة جلب المحادثة بأكملها.
  Future<void> _onMessageStatusChanged(ChatMessageStatusChanged event, Emitter<ChatState> emit) {
    return _withMessagesLock(() async {
      final index = state.messages.indexWhere((m) => m.id == event.messageId);
      if (index == -1) {
        // الرسالة لم تصل بعد لهذه القائمة (سباق REST/Socket) — يُطبَّق
        // فور ظهورها بدل تجاهله للأبد.
        EventTraceLog.log('BlocEventReceived(status_changed) — NOT FOUND, queued', messageId: event.messageId, extra: 'status=${event.status} currentMessagesCount=${state.messages.length}');
        _pendingStatusUpdates[event.messageId] = event.status;
        return;
      }
      final updated = [...state.messages];
      updated[index] = updated[index].copyWith(status: event.status);
      final newState = state.copyWith(messages: updated);
      EventTraceLog.log(
        'BlocEmit(status_changed)',
        messageId: event.messageId,
        extra: 'status=${event.status} oldStateHash=${state.hashCode} newStateHash=${newState.hashCode} equal=${state == newState}',
      );
      emit(newState);
    });
  }

  /// يُطبِّق أي ترجمة و/أو تحديث حالة كانا بانتظار وصول هذه الرسالة
  /// تحديدًا — يُستدعى من كل نقطة تُضيف رسالة جديدة لـ state.messages
  /// لأول مرة. الترجمة (إن وُجدت) تُطبَّق أولاً (الرسالة الكاملة الأحدث)
  /// ثم تحديث الحالة فوقها، بما أن الاثنين قد يصلا معاً بسباق منفصل.
  MessageEntity _applyPendingStatus(MessageEntity message) {
    final translated = _pendingTranslations.remove(message.id) ?? message;
    final pendingStatus = _pendingStatusUpdates.remove(message.id);
    return pendingStatus == null ? translated : translated.copyWith(status: pendingStatus);
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
        emit(state.copyWith(isSending: false, messages: [...state.messages, _applyPendingStatus(message)]));
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
