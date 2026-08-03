import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import 'country_phone_data.dart';

/// Country-code picker + national-number field, combined. Shows the
/// correct number format per country (digit count + example) and
/// validates against it — e.g. Saudi Arabia expects 9 digits after
/// +966, Egypt expects 10 after +20, so "الصيغة الصحيحة حسب كل دولة"
/// is enforced, not just displayed as a hint.
class CountryPhoneField extends StatefulWidget {
  final void Function(String fullPhone) onChanged;
  final String? Function(String? fullPhone)? validator;

  const CountryPhoneField({super.key, required this.onChanged, this.validator});

  @override
  State<CountryPhoneField> createState() => CountryPhoneFieldState();
}

class CountryPhoneFieldState extends State<CountryPhoneField> {
  CountryPhoneInfo _country = kSupportedCountries.first; // Saudi Arabia default
  final _numberController = TextEditingController();

  @override
  void dispose() {
    _numberController.dispose();
    super.dispose();
  }

  String get _fullPhone => '${_country.dialCode}${_numberController.text.trim()}';

  void _pickCountry() async {
    final picked = await showModalBottomSheet<CountryPhoneInfo>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.divider, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Align(alignment: AlignmentDirectional.centerStart, child: Text('اختر الدولة', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
            ),
            const SizedBox(height: 8),
            ...kSupportedCountries.map(
              (c) => ListTile(
                leading: Text(c.flag, style: const TextStyle(fontSize: 24)),
                title: Text(c.nameAr, style: const TextStyle(fontWeight: FontWeight.w600)),
                trailing: Text(c.dialCode, style: const TextStyle(color: AppColors.textSecondary)),
                onTap: () => Navigator.of(context).pop(c),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked != null) {
      setState(() => _country = picked);
      widget.onChanged(_fullPhone);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            // ---- Country selector ----
            InkWell(
              onTap: _pickCountry,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                height: 52,
                padding: const EdgeInsetsDirectional.only(start: 12, end: 8),
                decoration: BoxDecoration(border: Border.all(color: AppColors.divider), borderRadius: BorderRadius.circular(12)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_country.flag, style: const TextStyle(fontSize: 20)),
                    const SizedBox(width: 6),
                    Text(_country.dialCode, style: const TextStyle(fontWeight: FontWeight.w600)),
                    const Icon(Icons.expand_more_rounded, color: AppColors.textSecondary, size: 20),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            // ---- National number ----
            Expanded(
              child: TextFormField(
                controller: _numberController,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                onChanged: (_) => widget.onChanged(_fullPhone),
                decoration: InputDecoration(
                  hintText: _country.exampleFormat,
                  hintTextDirection: TextDirection.ltr,
                  prefixIcon: const Icon(Icons.phone_outlined),
                ),
                validator: (v) {
                  final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
                  if (digits.isEmpty) return 'أدخل رقم الهاتف';
                  if (digits.length != _country.nationalNumberLength) {
                    return 'رقم ${_country.nameAr} يجب أن يكون ${_country.nationalNumberLength} أرقام';
                  }
                  return widget.validator?.call(_fullPhone);
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 4),
          child: Text(
            'الصيغة: ${_country.fullExample}',
            style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }
}
