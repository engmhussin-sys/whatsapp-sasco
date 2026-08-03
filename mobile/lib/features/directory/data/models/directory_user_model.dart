import '../../domain/entities/directory_user_entity.dart';

class DirectoryUserModel extends DirectoryUserEntity {
  const DirectoryUserModel({
    required super.id,
    required super.firstName,
    required super.lastName,
    super.email,
    super.avatarUrl,
    required super.systemRole,
  });

  factory DirectoryUserModel.fromJson(Map<String, dynamic> json) => DirectoryUserModel(
        id: json['id'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        email: json['email'] as String?,
        avatarUrl: json['avatarUrl'] as String?,
        systemRole: json['systemRole'] as String? ?? 'WORKER',
      );
}
