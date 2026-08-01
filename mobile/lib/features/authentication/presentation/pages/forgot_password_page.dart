import 'package:flutter/material.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../domain/usecases/request_password_reset_usecase.dart';
import '../../domain/usecases/reset_password_usecase.dart';

/// Handles both steps of the flow in one screen: (1) request a reset
/// token by email, (2) submit the token + new password. Kept as local
/// widget state rather than adding to AuthBloc since this is a one-off,
/// self-contained action not tied to the app's overall auth status.
class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _emailController = TextEditingController();
  final _tokenController = TextEditingController();
  final _newPasswordController = TextEditingController();

  bool _requested = false;
  bool _done = false;
  bool _loading = false;
  String? _error;

  Future<void> _requestReset() async {
    if (_emailController.text.trim().isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await sl<RequestPasswordResetUseCase>()(RequestPasswordResetParams(_emailController.text.trim()));
    setState(() {
      _loading = false;
      result.fold((f) => _error = f.message, (_) => _requested = true);
    });
  }

  Future<void> _submitNewPassword() async {
    if (_tokenController.text.trim().isEmpty || _newPasswordController.text.length < 8) {
      setState(() => _error = 'أدخل الرمز وكلمة مرور من 8 أحرف على الأقل');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final result = await sl<ResetPasswordUseCase>()(
      ResetPasswordParams(resetToken: _tokenController.text.trim(), newPassword: _newPasswordController.text),
    );
    setState(() {
      _loading = false;
      result.fold((f) => _error = f.message, (_) => _done = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('استعادة كلمة المرور')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                  child: Text(_error!, style: TextStyle(color: Colors.red.shade700)),
                ),
              if (_done)
                const Text('تم تحديث كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.')
              else if (!_requested) ...[
                const Text('أدخل بريدك الإلكتروني وسنرسل لك رمز إعادة التعيين'),
                const SizedBox(height: 16),
                AppTextField(label: 'البريد الإلكتروني', controller: _emailController, keyboardType: TextInputType.emailAddress),
                const SizedBox(height: 16),
                AppButton(label: 'إرسال الرمز', isLoading: _loading, onPressed: _requestReset),
              ] else ...[
                const Text('أدخل الرمز المُرسَل وكلمة المرور الجديدة'),
                const SizedBox(height: 16),
                AppTextField(label: 'الرمز', controller: _tokenController),
                const SizedBox(height: 12),
                AppTextField(label: 'كلمة المرور الجديدة', controller: _newPasswordController, obscureText: true),
                const SizedBox(height: 16),
                AppButton(label: 'تحديث كلمة المرور', isLoading: _loading, onPressed: _submitNewPassword),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
