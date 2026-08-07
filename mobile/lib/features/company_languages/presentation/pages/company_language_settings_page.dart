import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../bloc/company_languages_cubit.dart';

/// شاشة إدارة لغات الشركة — مقصورة على COMPANY_ADMIN/SUPER_ADMIN
/// (البوابة على مستوى الاستدعاء، راجع profile_page.dart). لا علاقة
/// لها بـ language_settings_page.dart (تلك شخصية للمستخدم الفردي —
/// هذه على مستوى الشركة بأكملها، وتُحدِّد أي اللغات يُترجَم إليها
/// أصلاً، بصرف النظر عن تفضيل أي فرد).
class CompanyLanguageSettingsPage extends StatefulWidget {
  final String companyId;
  const CompanyLanguageSettingsPage({super.key, required this.companyId});

  @override
  State<CompanyLanguageSettingsPage> createState() => _CompanyLanguageSettingsPageState();
}

class _CompanyLanguageSettingsPageState extends State<CompanyLanguageSettingsPage> {
  @override
  void initState() {
    super.initState();
    context.read<CompanyLanguagesCubit>().load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('لغات الشركة')),
      body: BlocConsumer<CompanyLanguagesCubit, CompanyLanguagesState>(
        listenWhen: (p, c) => p.errorMessage != c.errorMessage && c.errorMessage != null,
        listener: (context, state) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
        },
        builder: (context, state) {
          if (state.status == CompanyLanguagesStatus.initial || state.status == CompanyLanguagesStatus.loading) {
            return const LoadingView();
          }
          if (state.status == CompanyLanguagesStatus.failure && state.allLanguages.isEmpty) {
            return ErrorView(
              message: state.errorMessage ?? 'تعذّر تحميل قائمة اللغات',
              onRetry: () => context.read<CompanyLanguagesCubit>().load(),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(Gap.md),
            children: [
              Container(
                padding: const EdgeInsets.all(Gap.md),
                decoration: BoxDecoration(color: AppColors.brandLight, borderRadius: R.cardR),
                child: const Row(
                  children: [
                    Icon(Icons.info_outline_rounded, size: 18, color: AppColors.brandDark),
                    SizedBox(width: Gap.sm),
                    Expanded(
                      child: Text(
                        'اللغات المُفعَّلة هنا فقط تصل إليها الرسائل مُترجَمة، بصرف النظر عن لغة كل فرد في إعداداته الشخصية.',
                        style: TextStyle(fontSize: FS.small, color: AppColors.brandDark),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: Gap.md),
              for (final lang in state.allLanguages)
                Card(
                  margin: const EdgeInsets.only(bottom: Gap.sm),
                  shape: RoundedRectangleBorder(borderRadius: R.cardR),
                  child: SwitchListTile(
                    title: Text(lang.nativeName, style: const TextStyle(fontSize: FS.body, fontWeight: FontWeight.w600)),
                    subtitle: Text(lang.name, style: const TextStyle(fontSize: FS.caption)),
                    value: state.enabledCodes.contains(lang.code),
                    activeColor: AppColors.brand,
                    onChanged: state.pendingCodes.contains(lang.code)
                        ? null
                        : (value) => context.read<CompanyLanguagesCubit>().toggle(lang.code, value),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
