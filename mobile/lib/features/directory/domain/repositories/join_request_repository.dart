import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/joinable_group_entity.dart';
import '../entities/join_request_entity.dart';

abstract class JoinRequestRepository {
  /// GROUP conversations in this company the current user isn't a member
  /// of yet, with their own pending/approved/rejected status if any.
  Future<Either<Failure, List<JoinableGroupEntity>>> getJoinableGroups(String companyId);

  Future<Either<Failure, void>> requestToJoin(String companyId, String conversationId);

  /// Admin/lead-only — pending requests for a specific group.
  Future<Either<Failure, List<JoinRequestEntity>>> getPendingRequests(String companyId, String conversationId);

  /// Admin/lead-only — approve or reject a specific request.
  Future<Either<Failure, void>> decideRequest(String companyId, String requestId, {required bool approve});
}
