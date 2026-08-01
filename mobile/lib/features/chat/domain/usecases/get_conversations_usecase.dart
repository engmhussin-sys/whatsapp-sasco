import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/conversation_entity.dart';
import '../repositories/chat_repository.dart';

class GetConversationsParams extends Equatable {
  final String companyId;
  const GetConversationsParams(this.companyId);
  @override
  List<Object?> get props => [companyId];
}

class GetConversationsUseCase implements UseCase<List<ConversationEntity>, GetConversationsParams> {
  final ChatRepository repository;
  GetConversationsUseCase(this.repository);

  @override
  Future<Either<Failure, List<ConversationEntity>>> call(GetConversationsParams params) =>
      repository.getConversations(params.companyId);
}
