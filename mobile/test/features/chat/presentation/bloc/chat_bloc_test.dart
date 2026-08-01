import 'dart:async';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:workforce_connect_ai/core/error/failures.dart';
import 'package:workforce_connect_ai/features/chat/domain/entities/message_entity.dart';
import 'package:workforce_connect_ai/features/chat/domain/repositories/chat_repository.dart';
import 'package:workforce_connect_ai/features/chat/domain/usecases/get_messages_usecase.dart';
import 'package:workforce_connect_ai/features/chat/domain/usecases/mark_read_usecase.dart';
import 'package:workforce_connect_ai/features/chat/domain/usecases/send_text_message_usecase.dart';
import 'package:workforce_connect_ai/features/chat/domain/usecases/send_voice_message_usecase.dart';
import 'package:workforce_connect_ai/features/chat/presentation/bloc/chat_bloc.dart';

class MockChatRepository extends Mock implements ChatRepository {}

class MockGetMessagesUseCase extends Mock implements GetMessagesUseCase {}

class MockSendTextMessageUseCase extends Mock implements SendTextMessageUseCase {}

class MockSendVoiceMessageUseCase extends Mock implements SendVoiceMessageUseCase {}

class MockMarkReadUseCase extends Mock implements MarkReadUseCase {}

void main() {
  const companyId = 'company-1';
  const conversationId = 'conv-1';

  late MockChatRepository repository;
  late MockGetMessagesUseCase getMessages;
  late MockSendTextMessageUseCase sendTextMessage;
  late MockSendVoiceMessageUseCase sendVoiceMessage;
  late MockMarkReadUseCase markRead;
  late StreamController<MessageEntity> messageController;
  late StreamController<Map<String, dynamic>> typingController;

  final tMessage = MessageEntity(
    id: 'msg-1',
    conversationId: conversationId,
    senderId: 'user-2',
    senderName: 'Peer',
    type: MessageType.text,
    status: MessageDeliveryStatus.sent,
    text: 'Hello',
    createdAt: DateTime(2026, 1, 1),
  );

  setUpAll(() {
    registerFallbackValue(const GetMessagesParams(companyId: companyId, conversationId: conversationId));
    registerFallbackValue(const MarkReadParams(companyId: companyId, conversationId: conversationId));
  });

  setUp(() {
    repository = MockChatRepository();
    getMessages = MockGetMessagesUseCase();
    sendTextMessage = MockSendTextMessageUseCase();
    sendVoiceMessage = MockSendVoiceMessageUseCase();
    markRead = MockMarkReadUseCase();
    messageController = StreamController<MessageEntity>.broadcast();
    typingController = StreamController<Map<String, dynamic>>.broadcast();

    when(() => repository.onMessageReceived).thenAnswer((_) => messageController.stream);
    when(() => repository.onTypingChanged).thenAnswer((_) => typingController.stream);
    when(() => repository.joinConversation(any())).thenReturn(null);
    when(() => repository.leaveConversation(any())).thenReturn(null);
    when(() => repository.sendTypingIndicator(any(), any())).thenReturn(null);
    when(() => markRead(any())).thenAnswer((_) async => const Right(null));
  });

  tearDown(() async {
    await messageController.close();
    await typingController.close();
  });

  ChatBloc buildBloc() => ChatBloc(
        companyId: companyId,
        conversationId: conversationId,
        repository: repository,
        getMessages: getMessages,
        sendTextMessage: sendTextMessage,
        sendVoiceMessage: sendVoiceMessage,
        markRead: markRead,
      );

  group('ChatStarted', () {
    blocTest<ChatBloc, ChatState>(
      'joins the Socket.io room and loads history (oldest-first)',
      setUp: () => when(() => getMessages(any())).thenAnswer((_) async => Right([tMessage])),
      build: buildBloc,
      act: (bloc) => bloc.add(const ChatStarted()),
      expect: () => [
        const ChatState(status: ChatStatus.loading),
        ChatState(status: ChatStatus.success, messages: [tMessage]),
      ],
      verify: (_) {
        verify(() => repository.joinConversation(conversationId)).called(1);
        verify(() => markRead(any())).called(1);
      },
    );
  });

  group('real-time message reception', () {
    blocTest<ChatBloc, ChatState>(
      'appends a message received over the socket exactly once (no duplicate on echo)',
      setUp: () => when(() => getMessages(any())).thenAnswer((_) async => const Right([])),
      build: buildBloc,
      act: (bloc) async {
        bloc.add(const ChatStarted());
        await Future<void>.delayed(Duration.zero);
        messageController.add(tMessage);
        await Future<void>.delayed(Duration.zero);
        // Simulate the server echoing the SAME message id again (e.g. a
        // second socket event) — must NOT be appended twice.
        messageController.add(tMessage);
      },
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        expect(bloc.state.messages.length, 1);
      },
    );

    blocTest<ChatBloc, ChatState>(
      'updates isPeerTyping when a typing event arrives over the socket',
      setUp: () => when(() => getMessages(any())).thenAnswer((_) async => const Right([])),
      build: buildBloc,
      act: (bloc) async {
        bloc.add(const ChatStarted());
        await Future<void>.delayed(Duration.zero);
        typingController.add({'isTyping': true});
      },
      wait: const Duration(milliseconds: 50),
      verify: (bloc) => expect(bloc.state.isPeerTyping, isTrue),
    );
  });

  group('ChatTextMessageSent', () {
    blocTest<ChatBloc, ChatState>(
      'sends via REST and appends the confirmed message to state',
      setUp: () {
        when(() => getMessages(any())).thenAnswer((_) async => const Right([]));
        when(() => sendTextMessage(any())).thenAnswer((_) async => Right(tMessage));
      },
      build: buildBloc,
      act: (bloc) async {
        bloc.add(const ChatStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ChatTextMessageSent('Hello'));
      },
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        expect(bloc.state.messages, contains(tMessage));
        expect(bloc.state.isSending, isFalse);
      },
    );

    blocTest<ChatBloc, ChatState>(
      'surfaces a NetworkFailure message (e.g. queued while offline) without crashing',
      setUp: () {
        when(() => getMessages(any())).thenAnswer((_) async => const Right([]));
        when(() => sendTextMessage(any()))
            .thenAnswer((_) async => const Left(NetworkFailure('تم حفظ الرسالة وستُرسَل تلقائيًا')));
      },
      build: buildBloc,
      act: (bloc) async {
        bloc.add(const ChatStarted());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const ChatTextMessageSent('Offline message'));
      },
      wait: const Duration(milliseconds: 50),
      verify: (bloc) {
        expect(bloc.state.errorMessage, 'تم حفظ الرسالة وستُرسَل تلقائيًا');
      },
    );
  });

  group('ChatEnded', () {
    blocTest<ChatBloc, ChatState>(
      'leaves the Socket.io room on dispose',
      setUp: () => when(() => getMessages(any())).thenAnswer((_) async => const Right([])),
      build: buildBloc,
      act: (bloc) => bloc.add(const ChatEnded()),
      verify: (_) => verify(() => repository.leaveConversation(conversationId)).called(1),
    );
  });
}
