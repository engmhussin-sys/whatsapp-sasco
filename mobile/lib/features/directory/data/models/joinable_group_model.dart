import '../../domain/entities/joinable_group_entity.dart';

class JoinableGroupModel extends JoinableGroupEntity {
  const JoinableGroupModel({required super.id, super.title, required super.memberCount, super.myRequestStatus});

  factory JoinableGroupModel.fromJson(Map<String, dynamic> json) => JoinableGroupModel(
        id: json['id'] as String,
        title: json['title'] as String?,
        memberCount: json['memberCount'] as int? ?? 0,
        myRequestStatus: json['myRequestStatus'] as String?,
      );
}
