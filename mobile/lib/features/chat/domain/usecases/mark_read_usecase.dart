import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/chat_repository.dart';

class MarkReadParams extends Equatable {
  final String companyId;
  final String conversationId;
  final String? upToMessageId;
  const MarkReadParams({required this.companyId, required this.conversationId, this.upToMessageId});
  @override
  List<Object?> get props => [companyId, conversationId, upToMessageId];
}

class MarkReadUseCase implements UseCase<void, MarkReadParams> {
  final ChatRepository repository;
  MarkReadUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(MarkReadParams params) =>
      repository.markRead(params.companyId, params.conversationId, upToMessageId: params.upToMessageId);
}
