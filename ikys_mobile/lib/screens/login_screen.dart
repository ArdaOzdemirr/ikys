import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _token = TextEditingController();
  bool _requires2FA = false;
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = context.read<AuthProvider>();
      final res = await auth.login(
        _email.text.trim(),
        _password.text,
        token2FA: _requires2FA ? _token.text.trim() : null,
      );
      if (res.requires2FA) {
        setState(() => _requires2FA = true);
      }
      // Başarılı girişte router otomatik /home'a yönlendirir.
    } catch (e) {
      setState(() => _error = ApiClient.errorMessage(e, 'Giriş başarısız'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    alignment: Alignment.center,
                    child: const Text('İK',
                        style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 12),
                  const Text('İKYS',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  const Text('İnsan Kaynakları Yönetim Sistemi',
                      style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 20),
                  if (!_requires2FA) ...[
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: const InputDecoration(
                        labelText: 'E-posta',
                        hintText: 'ornek@firma.com',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Şifre',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ] else ...[
                    TextField(
                      controller: _token,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      autofocus: true,
                      decoration: const InputDecoration(
                        labelText: '2FA Kodu',
                        hintText: '123456',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _loading ? null : _submit,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _loading
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(_requires2FA ? 'Doğrula' : 'Giriş Yap'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
