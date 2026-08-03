import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/sasco_logo.dart';
import '../bloc/auth_bloc.dart';
import '../widgets/country_phone_field.dart';

enum _LoginMode { phone, email }

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
  final _phoneFieldKey = GlobalKey<CountryPhoneFieldState>();
  bool _obscurePassword = true;
  _LoginMode _mode = _LoginMode.phone; // phone-first, per fuel-station workers rarely having email
  String _fullPhone = '';

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
          email: _mode == _LoginMode.email ? _emailController.text.trim() : null,
          phone: _mode == _LoginMode.phone ? _fullPhone : null,
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
            // app_router.dart's `redirect` callback — see splash_page.dart's
            // comment for why (a confirmed navigation race otherwise).
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
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                          ),
                          const SizedBox(height: 24),

                          // ---- Phone / Email toggle ----
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(color: AppColors.brandLight, borderRadius: BorderRadius.circular(12)),
                            child: Row(
                              children: [
                                Expanded(
                                  child: _ModeButton(
                                    label: 'رقم الهاتف',
                                    selected: _mode == _LoginMode.phone,
                                    onTap: () => setState(() => _mode = _LoginMode.phone),
                                  ),
                                ),
                                Expanded(
                                  child: _ModeButton(
                                    label: 'البريد الإلكتروني',
                                    selected: _mode == _LoginMode.email,
                                    onTap: () => setState(() => _mode = _LoginMode.email),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),

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
                                        color: AppColors.danger.withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: AppColors.danger.withValues(alpha: 0.25)),
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

                                if (_mode == _LoginMode.phone)
                                  CountryPhoneField(key: _phoneFieldKey, onChanged: (full) => _fullPhone = full)
                                else
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

class _ModeButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _ModeButton({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(9),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: selected ? AppColors.brandDark : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
