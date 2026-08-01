import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/di/injection_container.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/authentication/presentation/bloc/auth_bloc.dart';
import 'features/profile/presentation/bloc/settings_cubit.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>.value(value: sl<AuthBloc>()),
        BlocProvider<SettingsCubit>.value(value: sl<SettingsCubit>()),
      ],
      child: Builder(
        builder: (context) {
          return BlocBuilder<SettingsCubit, SettingsState>(
            builder: (context, settingsState) {
              return MaterialApp.router(
                title: 'app_name'.tr(),
                debugShowCheckedModeBanner: false,
                theme: AppTheme.light,
                darkTheme: AppTheme.dark,
                themeMode: settingsState.isDarkMode ? ThemeMode.dark : ThemeMode.light,
                routerConfig: buildAppRouter(),
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
              );
            },
          );
        },
      ),
    );
  }
}
