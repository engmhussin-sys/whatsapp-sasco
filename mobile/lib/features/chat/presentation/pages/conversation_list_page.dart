import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/router/route_names.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../bloc/conversations_bloc.dart';

class ConversationListPage extends StatelessWidget {
  final UserEntity currentUser;
  const ConversationListPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ConversationsBloc>(param1: currentUser.companyId)..add(const ConversationsRequested()),
      child: Scaffold(
        appBar: AppBar(title: const Text('المحادثات')),
        body: BlocBuilder<ConversationsBloc, ConversationsState>(
          builder: (context, state) {
            if (state.status == ConversationsStatus.loading || state.status == ConversationsStatus.initial) {
              return const LoadingView();
            }
            if (state.status == ConversationsStatus.failure) {
              return ErrorView(
                message: state.errorMessage ?? 'تعذّر جلب المحادثات',
                onRetry: () => context.read<ConversationsBloc>().add(const ConversationsRequested()),
              );
            }
            if (state.conversations.isEmpty) {
              return const Center(child: Text('لا توجد محادثات بعد'));
            }
            return ListView.separated(
              itemCount: state.conversations.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final conv = state.conversations[index];
                return ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(conv.displayName(currentUser.id)),
                  subtitle: Text(conv.lastMessagePreview ?? 'لا رسائل بعد', maxLines: 1, overflow: TextOverflow.ellipsis),
                  onTap: () => context.push(RouteNames.chatPath(conv.id)),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
