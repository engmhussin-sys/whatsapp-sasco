import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/sasco_logo.dart';
import '../bloc/auth_bloc.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _companyIdController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _companyIdController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    context.read<AuthBloc>().add(AuthLoginRequested(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          companyId: _companyIdController.text.trim().isEmpty ? null : _companyIdController.text.trim(),
        ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceLight,
      body: SafeArea(
        child: Builder(
          builder: (context) {
            // Navigation on successful login is handled EXCLUSIVELY by
            // app_router.dart's `redirect` callback (authenticated +
            // on an auth route -> home) — no BlocListener-driven
            // context.go() here. See splash_page.dart's comment for
            // why: calling context.go() from a listener reacting to
            // the same AuthBloc stream that also drives the router's
            // refreshListenable caused a confirmed navigation race.
              return LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: constraints.maxHeight),
                    child: IntrinsicHeight(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 24),
                          const Center(child: SascoLogo(size: 84)),
                          const SizedBox(height: 36),
                          Text(
                            'تسجيل الدخول',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'أدخل بيانات حسابك للمتابعة',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                          ),
                          const SizedBox(height: 28),
                          Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                BlocBuilder<AuthBloc, AuthState>(
                                  builder: (context, state) {
                                    if (state.errorMessage == null) return const SizedBox.shrink();
                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 16),
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: AppColors.danger.withOpacity(0.08),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: AppColors.danger.withOpacity(0.25)),
                                      ),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(state.errorMessage!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                                TextFormField(
                                  controller: _emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  decoration: const InputDecoration(
                                    labelText: 'البريد الإلكتروني',
                                    prefixIcon: Icon(Icons.mail_outline_rounded),
                                  ),
                                  validator: (v) => (v == null || !v.contains('@')) ? 'أدخل بريدًا صحيحًا' : null,
                                ),
                                const SizedBox(height: 14),
                                TextFormField(
                                  controller: _passwordController,
                                  obscureText: _obscurePassword,
                                  decoration: InputDecoration(
                                    labelText: 'كلمة المرور',
                                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                                    suffixIcon: IconButton(
                                      icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                    ),
                                  ),
                                  validator: (v) => (v == null || v.length < 8) ? '8 أحرف على الأقل' : null,
                                ),
                                const SizedBox(height: 14),
                                TextFormField(
                                  controller: _companyIdController,
                                  decoration: const InputDecoration(
                                    labelText: 'معرّف الشركة (اختياري)',
                                    prefixIcon: Icon(Icons.apartment_outlined),
                                  ),
                                ),
                                const SizedBox(height: 24),
                                BlocBuilder<AuthBloc, AuthState>(
                                  builder: (context, state) => SizedBox(
                                    height: 52,
                                    child: ElevatedButton(
                                      onPressed: state.isSubmitting ? null : _submit,
                                      child: state.isSubmitting
                                          ? const SizedBox(
                                              height: 20,
                                              width: 20,
                                              child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                                            )
                                          : const Text('تسجيل الدخول'),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                Center(
                                  child: TextButton(
                                    onPressed: () => context.push(RouteNames.forgotPassword),
                                    child: const Text('نسيت كلمة المرور؟'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                );
            },
          );
          },
        ),
      ),
    );
  }
}
