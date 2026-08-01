import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/message_entity.dart';
import '../repositories/chat_repository.dart';

class SendVoiceMessageParams extends Equatable {
  final String companyId;
  final String conversationId;
  final String audioFilePath;
  final int durationMs;
  const SendVoiceMessageParams({
    required this.companyId,
    required this.conversationId,
    required this.audioFilePath,
    required this.durationMs,
  });
  @override
  List<Object?> get props => [companyId, conversationId, audioFilePath, durationMs];
}

class SendVoiceMessageUseCase implements UseCase<MessageEntity, SendVoiceMessageParams> {
  final ChatRepository repository;
  SendVoiceMessageUseCase(this.repository);

  @override
  Future<Either<Failure, MessageEntity>> call(SendVoiceMessageParams params) =>
      repository.sendVoiceMessage(params.companyId, params.conversationId, params.audioFilePath, params.durationMs);
}
