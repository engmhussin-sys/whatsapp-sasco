import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/constants/supported_locales.dart';
import '../../../authentication/presentation/bloc/auth_bloc.dart';
import '../bloc/settings_cubit.dart';

/// CRITICAL FIX: this screen previously only changed the LOCAL app UI
/// language (SettingsCubit + easy_localization's context.setLocale) —
/// it never told the SERVER the user's preferredLanguage changed. Since
/// the Translation Engine reads preferredLanguage from the server-side
/// User record (not anything local), incoming messages kept being
/// translated to whatever language was set at signup, regardless of
/// what was picked here. AuthBloc.add(AuthLanguageChanged) — built in
/// T5 but never actually wired to any screen until now — is what
/// closes that loop.
class LanguageSettingsPage extends StatelessWidget {
  const LanguageSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اللغة')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listenWhen: (p, c) => p.user?.preferredLanguage != c.user?.preferredLanguage || p.errorMessage != c.errorMessage,
        listener: (context, authState) {
          if (authState.errorMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(authState.errorMessage!)));
          }
        },
        builder: (context, authState) {
          return BlocBuilder<SettingsCubit, SettingsState>(
            builder: (context, state) {
              return ListView(
                children: [
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFFE6F4EC), borderRadius: BorderRadius.circular(12)),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline_rounded, size: 18, color: Color(0xFF085C31)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'تغيير اللغة هنا يُحدِّث لغة استقبالك للرسائل المُترجَمة أيضًا، وليس فقط شكل التطبيق.',
                            style: TextStyle(fontSize: 12.5, color: Color(0xFF085C31)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('اللغات المتاحة', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  for (final appLocale in SupportedLocales.active)
                    RadioListTile<String>(
                      title: Text(appLocale.nativeName),
                      subtitle: authState.user?.preferredLanguage == appLocale.locale.languageCode
                          ? const Text('اللغة الحالية لاستقبال الرسائل', style: TextStyle(fontSize: 11.5))
                          : null,
                      value: appLocale.locale.languageCode,
                      groupValue: state.localeCode,
                      onChanged: (code) async {
                        if (code == null) return;
                        // Step A — App UI language (immediate, local, cosmetic).
                        await context.read<SettingsCubit>().changeLocale(code);
                        if (context.mounted) await context.setLocale(appLocale.locale);
                        // Step B — THE ACTUAL FIX: persist to the server so the
                        // Translation Engine starts translating incoming
                        // messages to this language.
                        if (context.mounted) context.read<AuthBloc>().add(AuthLanguageChanged(code));
                      },
                    ),
                  const Divider(),
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('لغات قادمة قريبًا (البنية جاهزة لدعمها)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                  ),
                  for (final appLocale in SupportedLocales.planned)
                    ListTile(
                      enabled: false,
                      title: Text(appLocale.nativeName, style: const TextStyle(color: Colors.grey)),
                      trailing: const Icon(Icons.lock_outline, size: 16, color: Colors.grey),
                    ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
