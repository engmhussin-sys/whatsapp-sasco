import 'package:equatable/equatable.dart';

enum SystemRole { superAdmin, companyAdmin, teamLead, worker }

SystemRole systemRoleFromString(String value) {
  switch (value) {
    case 'SUPER_ADMIN':
      return SystemRole.superAdmin;
    case 'COMPANY_ADMIN':
      return SystemRole.companyAdmin;
    case 'TEAM_LEAD':
      return SystemRole.teamLead;
    default:
      return SystemRole.worker;
  }
}

class UserEntity extends Equatable {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final SystemRole systemRole;
  final String? companyId;
  final String preferredLanguage;

  const UserEntity({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.systemRole,
    required this.companyId,
    required this.preferredLanguage,
  });

  String get fullName => '$firstName $lastName';

  @override
  List<Object?> get props => [id, email, firstName, lastName, systemRole, companyId, preferredLanguage];
}
