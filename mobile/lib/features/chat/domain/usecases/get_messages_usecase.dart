import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/message_entity.dart';
import '../repositories/chat_repository.dart';

class GetMessagesParams extends Equatable {
  final String companyId;
  final String conversationId;
  final String? cursor;
  const GetMessagesParams({required this.companyId, required this.conversationId, this.cursor});
  @override
  List<Object?> get props => [companyId, conversationId, cursor];
}

class GetMessagesUseCase implements UseCase<List<MessageEntity>, GetMessagesParams> {
  final ChatRepository repository;
  GetMessagesUseCase(this.repository);

  @override
  Future<Either<Failure, List<MessageEntity>>> call(GetMessagesParams params) =>
      repository.getMessages(params.companyId, params.conversationId, cursor: params.cursor);
}
