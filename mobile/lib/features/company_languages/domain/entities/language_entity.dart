import 'package:equatable/equatable.dart';

class LanguageEntity extends Equatable {
  final String code;
  final String name;
  final String nativeName;
  final bool isRtl;

  const LanguageEntity({required this.code, required this.name, required this.nativeName, required this.isRtl});

  @override
  List<Object?> get props => [code, name, nativeName, isRtl];
}
