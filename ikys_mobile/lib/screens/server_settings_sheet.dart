import 'package:flutter/material.dart';
import '../services/api_client.dart';

/// Backend adresini (IP/port) çalışırken değiştirmek için ayar ekranı.
/// Ağ değişince (örn. ev/iş Wi-Fi'si) telefonun bilgisayara erişebileceği
/// IP de değişir; bunu her seferinde kod değiştirip yeniden derlemek yerine
/// burada güncellemek yeterli.
Future<void> showServerSettingsSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (_) => const _ServerSettingsSheet(),
  );
}

class _ServerSettingsSheet extends StatefulWidget {
  const _ServerSettingsSheet();

  @override
  State<_ServerSettingsSheet> createState() => _ServerSettingsSheetState();
}

class _ServerSettingsSheetState extends State<_ServerSettingsSheet> {
  late final TextEditingController _urlController;
  bool _testing = false;
  String? _testResult;
  bool? _testOk;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: ApiClient.instance.currentBaseUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _testResult = null;
      _testOk = null;
    });
    final ok = await ApiClient.testConnection(_urlController.text.trim());
    if (!mounted) return;
    setState(() {
      _testing = false;
      _testOk = ok;
      _testResult = ok ? 'Sunucuya erişilebiliyor' : 'Sunucuya erişilemedi';
    });
  }

  Future<void> _save() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;
    await ApiClient.instance.setBaseUrl(url);
    if (mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sunucu adresi güncellendi')),
      );
    }
  }

  Future<void> _resetToDefault() async {
    await ApiClient.instance.resetBaseUrl();
    setState(() {
      _urlController.text = ApiClient.instance.currentBaseUrl;
      _testResult = null;
      _testOk = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Sunucu Ayarları',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          const Text(
            'Telefon ve bilgisayar aynı Wi-Fi ağında olmalı. Bilgisayarının '
            'yerel IP adresini (örn. 192.168.1.103) ve backend portunu '
            '(genelde 3000) gir. Android emülatör kullanıyorsan 10.0.2.2 yaz.',
            style: TextStyle(color: Colors.grey, fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _urlController,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: const InputDecoration(
              labelText: 'API Adresi',
              hintText: 'http://192.168.1.103:3000/api/v1',
              border: OutlineInputBorder(),
            ),
          ),
          if (_testResult != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  _testOk == true ? Icons.check_circle : Icons.error,
                  size: 16,
                  color: _testOk == true ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                ),
                const SizedBox(width: 6),
                Text(_testResult!,
                    style: TextStyle(
                      fontSize: 13,
                      color: _testOk == true ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                    )),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _testing ? null : _test,
                  child: _testing
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Bağlantıyı Test Et'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: _save,
                  child: const Text('Kaydet'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _resetToDefault,
            child: const Text('Varsayılana Döndür'),
          ),
        ],
      ),
    );
  }
}
