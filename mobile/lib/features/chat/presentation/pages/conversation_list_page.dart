import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../bloc/conversations_bloc.dart';
import '../../domain/entities/conversation_entity.dart' show ConversationEntity, ConversationType;

/// Design-system rebuild to match profile_page.dart's language exactly:
/// gradient header, white cards with divider border (no shadow, radius
/// 16), AppColors tokens only. Replaces the previous bare-ListTile
/// screen the user flagged as unchanged.
class ConversationListPage extends StatelessWidget {
  final UserEntity currentUser;
  const ConversationListPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ConversationsBloc>(param1: currentUser.companyId)..add(const ConversationsRequested()),
      child: Scaffold(
        backgroundColor: AppColors.surfaceLight,
        floatingActionButton: FloatingActionButton(
          backgroundColor: AppColors.brand,
          onPressed: () => _showNewConversationSheet(context),
          child: const Icon(Icons.add_comment_outlined, color: Colors.white),
        ),
        body: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [AppColors.brand, AppColors.brandDark]),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
                ),
                child: const Text('المحادثات', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
              ),
            ),
            BlocBuilder<ConversationsBloc, ConversationsState>(
              builder: (context, state) {
                if (state.status == ConversationsStatus.loading || state.status == ConversationsStatus.initial) {
                  return const SliverFillRemaining(child: LoadingView());
                }
                if (state.status == ConversationsStatus.failure) {
                  return SliverFillRemaining(
                    child: ErrorView(
                      message: state.errorMessage ?? 'تعذّر جلب المحادثات',
                      onRetry: () => context.read<ConversationsBloc>().add(const ConversationsRequested()),
                    ),
                  );
                }
                if (state.conversations.isEmpty) {
                  return const SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.chat_bubble_outline_rounded, size: 48, color: AppColors.textSecondary),
                          SizedBox(height: 12),
                          Text('لا توجد محادثات بعد', style: TextStyle(color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final conv = state.conversations[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _ConversationCard(
                            conv: conv,
                            currentUserId: currentUser.id,
                            onTap: () => context.push(RouteNames.chatPath(conv.id)),
                          ),
                        );
                      },
                      childCount: state.conversations.length,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showNewConversationSheet(BuildContext context) {
    final isAdmin = currentUser.systemRole == SystemRole.companyAdmin ||
        currentUser.systemRole == SystemRole.teamLead ||
        currentUser.systemRole == SystemRole.superAdmin;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.brand),
              title: const Text('محادثة جديدة'),
              onTap: () {
                Navigator.pop(sheetContext);
                context.push(RouteNames.newChat);
              },
            ),
            ListTile(
              leading: const Icon(Icons.travel_explore_rounded, color: AppColors.brand),
              title: const Text('تصفّح المجموعات'),
              onTap: () {
                Navigator.pop(sheetContext);
                context.push(RouteNames.browseGroups);
              },
            ),
            // Group creation is admin/lead-only — see CreateGroupPage's
            // doc comment and the route-level redirect guard in
            // app_router.dart (this hides the option; the route itself
            // is the actual enforcement).
            if (isAdmin)
              ListTile(
                leading: const Icon(Icons.group_add_rounded, color: AppColors.brand),
                title: const Text('مجموعة جديدة'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  context.push(RouteNames.newGroup);
                },
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _ConversationCard extends StatelessWidget {
  final ConversationEntity conv;
  final String currentUserId;
  final VoidCallback onTap;
  const _ConversationCard({required this.conv, required this.currentUserId, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final name = conv.displayName(currentUserId);
    final initial = name.isNotEmpty ? name[0] : '?';
    final isGroupLike = conv.type != ConversationType.direct;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          // A subtle tint for unread conversations, on top of the bold
          // text below — two independent signals rather than relying on
          // just one, matching how WhatsApp itself marks unread chats.
          color: conv.unreadCount > 0 ? AppColors.brandLight.withValues(alpha: 0.25) : Colors.white,
          border: Border.all(color: AppColors.divider),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: AppColors.brandLight,
              child: isGroupLike
                  ? const Icon(Icons.groups_rounded, color: AppColors.brandDark)
                  : Text(initial, style: const TextStyle(color: AppColors.brandDark, fontWeight: FontWeight.w700, fontSize: 18)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  const SizedBox(height: 3),
                  Text(
                    conv.lastMessagePreview ?? 'لا رسائل بعد',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: conv.unreadCount > 0 ? AppColors.textPrimary : AppColors.textSecondary,
                      fontWeight: conv.unreadCount > 0 ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_relativeTime(conv.updatedAt), style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                if (conv.unreadCount > 0) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(10)),
                    child: Text(
                      conv.unreadCount > 99 ? '99+' : '${conv.unreadCount}',
                      style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'الآن';
    if (diff.inHours < 1) return '${diff.inMinutes} د';
    if (diff.inDays < 1) return '${diff.inHours} س';
    if (diff.inDays < 7) return '${diff.inDays} يوم';
    return '${dt.day}/${dt.month}';
  }
}
