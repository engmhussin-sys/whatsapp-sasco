import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/constants/supported_locales.dart';
import '../bloc/settings_cubit.dart';

class LanguageSettingsPage extends StatelessWidget {
  const LanguageSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اللغة')),
      body: BlocBuilder<SettingsCubit, SettingsState>(
        builder: (context, state) {
          return ListView(
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('اللغات المتاحة', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
              for (final appLocale in SupportedLocales.active)
                RadioListTile<String>(
                  title: Text(appLocale.nativeName),
                  value: appLocale.locale.languageCode,
                  groupValue: state.localeCode,
                  onChanged: (code) async {
                    if (code == null) return;
                    await context.read<SettingsCubit>().changeLocale(code);
                    if (context.mounted) await context.setLocale(appLocale.locale);
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
      ),
    );
  }
}
