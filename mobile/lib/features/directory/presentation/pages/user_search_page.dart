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

/// Search-and-start-a-chat screen — the missing entry point for "محادثة
/// جديدة" that previously didn't exist anywhere in the app; conversations
/// could only be viewed once already created (e.g. by the seed data),
/// never started fresh from the directory.
class UserSearchPage extends StatefulWidget {
  final UserEntity currentUser;
  const UserSearchPage({super.key, required this.currentUser});

  @override
  State<UserSearchPage> createState() => _UserSearchPageState();
}

class _UserSearchPageState extends State<UserSearchPage> {
  final _controller = TextEditingController();
  bool _starting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _startChatWith(DirectoryUserEntity user) async {
    if (_starting) return;
    setState(() => _starting = true);

    final result = await sl<ChatRepository>().createConversation(
      widget.currentUser.companyId!,
      type: 'DIRECT',
      memberIds: [user.id],
    );

    if (!mounted) return;
    setState(() => _starting = false);

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
        appBar: AppBar(title: const Text('بحث عن مستخدم')),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _controller,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: 'ابحث بالاسم أو البريد أو الهاتف...',
                  prefixIcon: const Icon(Icons.search_rounded),
                  filled: true,
                  fillColor: AppColors.surfaceLight,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
                onChanged: (v) => context.read<DirectorySearchCubit>().search(v),
              ),
            ),
            Expanded(
              child: BlocBuilder<DirectorySearchCubit, DirectorySearchState>(
                builder: (context, state) {
                  if (state.status == DirectorySearchStatus.loading && state.results.isEmpty) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (state.status == DirectorySearchStatus.failure) {
                    return Center(child: Text(state.errorMessage ?? 'حدث خطأ', style: const TextStyle(color: AppColors.danger)));
                  }
                  if (state.results.isEmpty) {
                    return const Center(child: Text('لا نتائج', style: TextStyle(color: AppColors.textSecondary)));
                  }
                  return ListView.separated(
                    itemCount: state.results.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.divider),
                    itemBuilder: (context, i) {
                      final user = state.results[i];
                      // A worker cannot start a chat with themself.
                      if (user.id == widget.currentUser.id) return const SizedBox.shrink();
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: AppColors.brandLight,
                          child: Text(user.firstName.isNotEmpty ? user.firstName[0] : '?', style: const TextStyle(color: AppColors.brand)),
                        ),
                        title: Text(user.fullName),
                        subtitle: Text(user.email ?? '', style: const TextStyle(color: AppColors.textSecondary)),
                        trailing: _starting ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : null,
                        onTap: () => _startChatWith(user),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
