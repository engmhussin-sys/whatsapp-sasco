import 'package:equatable/equatable.dart';

/// [myRequestStatus] mirrors the backend's JoinRequestStatus enum
/// ('PENDING' | 'APPROVED' | 'REJECTED') or null if never requested.
class JoinableGroupEntity extends Equatable {
  final String id;
  final String? title;
  final int memberCount;
  final String? myRequestStatus;

  const JoinableGroupEntity({required this.id, this.title, required this.memberCount, this.myRequestStatus});

  bool get hasPendingRequest => myRequestStatus == 'PENDING';
  bool get wasRejected => myRequestStatus == 'REJECTED';

  @override
  List<Object?> get props => [id, title, memberCount, myRequestStatus];
}
