import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
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
      body: SafeArea(
        child: BlocListener<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state.status == AuthStatus.authenticated) {
              context.go(RouteNames.home);
            }
          },
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.groups_rounded, size: 56, color: Color(0xFF2563EB)),
                    const SizedBox(height: 8),
                    const Text('تسجيل الدخول', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    BlocBuilder<AuthBloc, AuthState>(
                      builder: (context, state) {
                        if (state.errorMessage == null) return const SizedBox.shrink();
                        return Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                          child: Text(state.errorMessage!, style: TextStyle(color: Colors.red.shade700)),
                        );
                      },
                    ),
                    AppTextField(
                      label: 'البريد الإلكتروني',
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      validator: (v) => (v == null || !v.contains('@')) ? 'أدخل بريدًا صحيحًا' : null,
                    ),
                    const SizedBox(height: 12),
                    AppTextField(
                      label: 'كلمة المرور',
                      controller: _passwordController,
                      obscureText: true,
                      validator: (v) => (v == null || v.length < 8) ? '8 أحرف على الأقل' : null,
                    ),
                    const SizedBox(height: 12),
                    AppTextField(label: 'معرّف الشركة (اختياري)', controller: _companyIdController),
                    const SizedBox(height: 20),
                    BlocBuilder<AuthBloc, AuthState>(
                      builder: (context, state) => AppButton(
                        label: 'تسجيل الدخول',
                        isLoading: state.isSubmitting,
                        onPressed: _submit,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => context.push(RouteNames.forgotPassword),
                      child: const Text('نسيت كلمة المرور؟'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
