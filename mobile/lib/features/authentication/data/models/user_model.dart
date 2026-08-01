import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.email,
    required super.firstName,
    required super.lastName,
    required super.systemRole,
    required super.companyId,
    required super.preferredLanguage,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        systemRole: systemRoleFromString(json['systemRole'] as String),
        companyId: json['companyId'] as String?,
        preferredLanguage: json['preferredLanguage'] as String? ?? 'en',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'systemRole': _systemRoleToString(systemRole),
        'companyId': companyId,
        'preferredLanguage': preferredLanguage,
      };

  static String _systemRoleToString(SystemRole role) {
    switch (role) {
      case SystemRole.superAdmin:
        return 'SUPER_ADMIN';
      case SystemRole.companyAdmin:
        return 'COMPANY_ADMIN';
      case SystemRole.teamLead:
        return 'TEAM_LEAD';
      case SystemRole.worker:
        return 'WORKER';
    }
  }
}
