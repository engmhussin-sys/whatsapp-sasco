import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/message_entity.dart';
import '../repositories/chat_repository.dart';

class SendTextMessageParams extends Equatable {
  final String companyId;
  final String conversationId;
  final String text;
  final String? replyToId;
  final String? clientMessageId;
  const SendTextMessageParams({required this.companyId, required this.conversationId, required this.text, this.replyToId, this.clientMessageId});
  @override
  List<Object?> get props => [companyId, conversationId, text, replyToId, clientMessageId];
}

class SendTextMessageUseCase implements UseCase<MessageEntity, SendTextMessageParams> {
  final ChatRepository repository;
  SendTextMessageUseCase(this.repository);

  @override
  Future<Either<Failure, MessageEntity>> call(SendTextMessageParams params) => repository.sendTextMessage(
        params.companyId,
        params.conversationId,
        params.text,
        replyToId: params.replyToId,
        clientMessageId: params.clientMessageId,
      );
}
