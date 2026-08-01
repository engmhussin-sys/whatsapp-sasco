import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../authentication/presentation/bloc/auth_bloc.dart';

class ProfilePage extends StatelessWidget {
  final UserEntity user;
  const ProfilePage({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الملف الشخصي')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          CircleAvatar(radius: 36, child: Text(user.firstName.isNotEmpty ? user.firstName[0] : '?', style: const TextStyle(fontSize: 28))),
          const SizedBox(height: 12),
          Center(child: Text(user.fullName, style: Theme.of(context).textTheme.titleLarge)),
          Center(child: Text(user.email, style: const TextStyle(color: Colors.grey))),
          const SizedBox(height: 24),
          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('اللغة'),
            trailing: const Icon(Icons.chevron_left),
            onTap: () => context.push(RouteNames.languageSettings),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.badge_outlined),
            title: const Text('الدور'),
            subtitle: Text(user.systemRole.name),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('تسجيل الخروج', style: TextStyle(color: Colors.red)),
            onTap: () => _confirmLogout(context),
          ),
        ],
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('تسجيل الخروج'),
        content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              context.read<AuthBloc>().add(const AuthLogoutRequested());
            },
            child: const Text('تسجيل الخروج', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
