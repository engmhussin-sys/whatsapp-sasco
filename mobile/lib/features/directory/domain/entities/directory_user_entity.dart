import 'package:equatable/equatable.dart';

class DirectoryUserEntity extends Equatable {
  final String id;
  final String firstName;
  final String lastName;
  final String? email;
  final String? avatarUrl;
  final String systemRole;

  const DirectoryUserEntity({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.email,
    this.avatarUrl,
    required this.systemRole,
  });

  String get fullName => '$firstName $lastName';

  @override
  List<Object?> get props => [id, firstName, lastName, email, avatarUrl, systemRole];
}
