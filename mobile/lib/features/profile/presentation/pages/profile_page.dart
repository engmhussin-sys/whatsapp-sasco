import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../authentication/presentation/bloc/auth_bloc.dart';
import '../bloc/settings_cubit.dart';

/// Full design-system rebuild — replaces the previous bare-ListTile
/// screen. Every switch here is REAL and persisted (SettingsCubit ->
/// SettingsRepository -> secure_storage), per the "zero dead elements"
/// rule: "تنبيهات السلامة اليومية" from the original design brief was
/// deliberately NOT added — it would require a working Firebase Cloud
/// Messaging topic-subscription setup that doesn't exist yet in this
/// project (documented in main.dart), and a switch that toggles nothing
/// is worse than no switch at all.
class ProfilePage extends StatelessWidget {
  final UserEntity user;
  const ProfilePage({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLight,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.brand, AppColors.brandDark],
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: Colors.white,
                    child: Text(
                      user.firstName.isNotEmpty ? user.firstName[0] : '?',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.brand),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(user.fullName, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(user.email, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _SectionLabel('الدور والصلاحيات'),
                _Card(
                  child: _Row(icon: Icons.badge_outlined, title: 'الدور', trailing: Text(_roleLabel(user.systemRole.name))),
                ),
                const SizedBox(height: 20),

                _SectionLabel('اللغة'),
                _Card(
                  child: _Row(
                    icon: Icons.translate_rounded,
                    title: 'اللغة الحالية',
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(user.preferredLanguage.toUpperCase(), style: const TextStyle(color: AppColors.textSecondary)),
                        const Icon(Icons.chevron_left_rounded, color: AppColors.textSecondary),
                      ],
                    ),
                    onTap: () => context.push(RouteNames.languageSettings),
                  ),
                ),
                // إدارة لغات الشركة — مقصورة على مدير الشركة (ومدير
                // المنصة إن كان مرتبطاً بشركة فعلية). نفس بوابة الصلاحية
                // المُستخدَمة في chat_page.dart لطلبات الانضمام.
                if (user.systemRole == SystemRole.companyAdmin ||
                    (user.systemRole == SystemRole.superAdmin && user.companyId != null)) ...[
                  const SizedBox(height: 8),
                  _Card(
                    child: _Row(
                      icon: Icons.language_rounded,
                      title: 'لغات الشركة المُفعَّلة',
                      trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.textSecondary),
                      onTap: () => context.push(RouteNames.companyLanguages),
                    ),
                  ),
                ],
                const SizedBox(height: 20),

                _SectionLabel('الحضور'),
                _Card(
                  child: _Row(
                    icon: Icons.location_searching_rounded,
                    title: 'attendance.title'.tr(),
                    trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.textSecondary),
                    onTap: () => context.push(RouteNames.attendance),
                  ),
                ),
                const SizedBox(height: 20),

                _SectionLabel('إمكانية الوصول'),
                _Card(
                  child: BlocBuilder<SettingsCubit, SettingsState>(
                    builder: (context, state) {
                      final cubit = context.read<SettingsCubit>();
                      return Column(
                        children: [
                          _SwitchRow(
                            icon: Icons.volume_up_rounded,
                            title: 'قراءة الرسائل بصوت عالٍ',
                            subtitle: 'قراءة الرسائل الجديدة تلقائياً بلغتك',
                            value: state.readAloudEnabled,
                            onChanged: cubit.toggleReadAloud,
                          ),
                          const Divider(height: 1, color: AppColors.divider),
                          _SwitchRow(
                            icon: Icons.text_increase_rounded,
                            title: 'نص كبير',
                            subtitle: 'تكبير النصوص في كل شاشات التطبيق',
                            value: state.largeTextEnabled,
                            onChanged: cubit.toggleLargeText,
                          ),
                          const Divider(height: 1, color: AppColors.divider),
                          _SwitchRow(
                            icon: Icons.visibility_outlined,
                            title: 'إظهار النص الأصلي',
                            subtitle: 'عرض النص كما كُتب أسفل الترجمة',
                            value: state.showOriginalEnabled,
                            onChanged: cubit.toggleShowOriginal,
                          ),
                        ],
                      );
                    },
                  ),
                ),
                const SizedBox(height: 32),

                // "مقدَّم من" — Atheel Tech branding, per the person's
                // request to surface the logo somewhere inside the app.
                Center(
                  child: Column(
                    children: [
                      Image.asset('assets/images/atheel_tech_logo.png', height: 48),
                      const SizedBox(height: 8),
                      Text(
                        'مقدَّم من Atheel Tech',
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                _Card(
                  child: _Row(
                    icon: Icons.logout_rounded,
                    iconColor: AppColors.danger,
                    title: 'تسجيل الخروج',
                    titleColor: AppColors.danger,
                    onTap: () => _confirmLogout(context),
                  ),
                ),
                const SizedBox(height: 24),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  String _roleLabel(String role) {
    const map = {
      'superAdmin': 'مدير المنصة',
      'companyAdmin': 'مدير الشركة',
      'teamLead': 'قائد فريق',
      'worker': 'عامل',
    };
    return map[role] ?? role;
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('تسجيل الخروج'),
        content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج؟'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              context.read<AuthBloc>().add(const AuthLogoutRequested());
            },
            child: const Text('تسجيل الخروج', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8, right: 4),
        child: Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
      );
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppColors.divider),
          borderRadius: BorderRadius.circular(16),
        ),
        child: child,
      );
}

class _Row extends StatelessWidget {
  final IconData icon;
  final Color? iconColor;
  final String title;
  final Color? titleColor;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _Row({required this.icon, this.iconColor, required this.title, this.titleColor, this.trailing, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: iconColor ?? AppColors.brand, size: 22),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: titleColor ?? AppColors.textPrimary))),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchRow({required this.icon, required this.title, required this.subtitle, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, color: AppColors.brand, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged, activeColor: AppColors.brand),
        ],
      ),
    );
  }
}
