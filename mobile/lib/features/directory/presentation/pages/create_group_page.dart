import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../chat/domain/repositories/chat_repository.dart';
import '../../domain/entities/directory_user_entity.dart';
import '../cubit/directory_search_cubit.dart';

/// Group-creation screen — restricted to COMPANY_ADMIN/TEAM_LEAD/
/// SUPER_ADMIN per the person's explicit request ("لحساب المدير عمل
/// جروب"). The route itself also gates on role (see app_router.dart)
/// so a worker can't reach this screen by guessing the URL, but the
/// check is duplicated harmlessly here too in case this widget is ever
/// reused elsewhere.
class CreateGroupPage extends StatefulWidget {
  final UserEntity currentUser;
  const CreateGroupPage({super.key, required this.currentUser});

  @override
  State<CreateGroupPage> createState() => _CreateGroupPageState();
}

class _CreateGroupPageState extends State<CreateGroupPage> {
  final _titleController = TextEditingController();
  final _searchController = TextEditingController();
  final Set<String> _selectedIds = {};
  final Map<String, DirectoryUserEntity> _selectedUsers = {};
  bool _creating = false;

  @override
  void dispose() {
    _titleController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _toggle(DirectoryUserEntity user) {
    setState(() {
      if (_selectedIds.contains(user.id)) {
        _selectedIds.remove(user.id);
        _selectedUsers.remove(user.id);
      } else {
        _selectedIds.add(user.id);
        _selectedUsers[user.id] = user;
      }
    });
  }

  Future<void> _create() async {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل اسم المجموعة')));
      return;
    }
    if (_selectedIds.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اختر عضوين على الأقل')));
      return;
    }

    setState(() => _creating = true);
    final result = await sl<ChatRepository>().createConversation(
      widget.currentUser.companyId!,
      type: 'GROUP',
      memberIds: _selectedIds.toList(),
      title: _titleController.text.trim(),
    );
    if (!mounted) return;
    setState(() => _creating = false);

    result.fold(
      (failure) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message))),
      (conversation) => context.pushReplacement(RouteNames.chatPath(conversation.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<DirectorySearchCubit>(param1: widget.currentUser.companyId)..loadInitial(),
      child: Scaffold(
        appBar: AppBar(title: const Text('مجموعة جديدة')),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: TextField(
                controller: _titleController,
                decoration: InputDecoration(
                  labelText: 'اسم المجموعة',
                  filled: true,
                  fillColor: AppColors.surfaceLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ),
            if (_selectedUsers.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: _selectedUsers.values
                      .map((u) => Chip(
                            label: Text(u.fullName, style: const TextStyle(fontSize: 12)),
                            backgroundColor: AppColors.brandLight,
                            onDeleted: () => _toggle(u),
                          ))
                      .toList(),
                ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'ابحث عن أعضاء لإضافتهم...',
                  prefixIcon: const Icon(Icons.search_rounded),
                  filled: true,
                  fillColor: AppColors.surfaceLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
                onChanged: (v) => context.read<DirectorySearchCubit>().search(v),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: BlocBuilder<DirectorySearchCubit, DirectorySearchState>(
                builder: (context, state) {
                  if (state.status == DirectorySearchStatus.loading && state.results.isEmpty) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (state.results.isEmpty) {
                    return const Center(child: Text('لا نتائج', style: TextStyle(color: AppColors.textSecondary)));
                  }
                  return ListView.builder(
                    itemCount: state.results.length,
                    itemBuilder: (context, i) {
                      final user = state.results[i];
                      if (user.id == widget.currentUser.id) return const SizedBox.shrink();
                      final selected = _selectedIds.contains(user.id);
                      return CheckboxListTile(
                        value: selected,
                        onChanged: (_) => _toggle(user),
                        activeColor: AppColors.brand,
                        title: Text(user.fullName),
                        subtitle: Text(user.email ?? '', style: const TextStyle(color: AppColors.textSecondary)),
                        secondary: CircleAvatar(
                          backgroundColor: AppColors.brandLight,
                          child: Text(user.firstName.isNotEmpty ? user.firstName[0] : '?', style: const TextStyle(color: AppColors.brand)),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton(
                  onPressed: _creating ? null : _create,
                  child: _creating
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('إنشاء المجموعة (${_selectedIds.length})'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
