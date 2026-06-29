import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  List<Attendance> _records = [];
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final now = DateTime.now();
    final start = DateFormat('yyyy-MM-dd').format(DateTime(now.year, now.month, 1));
    final end = DateFormat('yyyy-MM-dd').format(DateTime(now.year, now.month + 1, 0));
    try {
      _records = await AttendanceService.me(start, end);
    } catch (e) {
      if (mounted) _snack(ApiClient.errorMessage(e, 'Kayıtlar yüklenemedi'));
    }
    if (mounted) setState(() => _loading = false);
  }

  Attendance? get _today {
    final t = DateFormat('yyyy-MM-dd').format(DateTime.now());
    for (final r in _records) {
      if (DateFormat('yyyy-MM-dd').format(r.date) == t) return r;
    }
    return null;
  }

  Future<Map<String, double>> _coords() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return {};
      }
      final pos = await Geolocator.getCurrentPosition();
      return {'latitude': pos.latitude, 'longitude': pos.longitude};
    } catch (_) {
      return {};
    }
  }

  Future<void> _startScan() async {
    final raw = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _ScannerPage()),
    );
    if (raw == null) return;

    // Web paneli QR'a JSON gömüyor: {"type":"IKYS_ATTENDANCE","code":"...",...}
    String code = raw;
    try {
      final obj = jsonDecode(raw);
      if (obj is Map && obj['code'] != null) code = obj['code'];
    } catch (_) {}

    setState(() => _busy = true);
    try {
      final c = await _coords();
      await AttendanceService.checkIn(
        qrCode: code,
        latitude: c['latitude'],
        longitude: c['longitude'],
      );
      _snack('Giriş kaydedildi.');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Giriş yapılamadı'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkOut() async {
    setState(() => _busy = true);
    try {
      final c = await _coords();
      await AttendanceService.checkOut(latitude: c['latitude'], longitude: c['longitude']);
      _snack('Çıkış kaydedildi.');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Çıkış yapılamadı'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    final today = _today;
    final hasIn = today?.checkIn != null;
    final hasOut = today?.checkOut != null;

    final workedH = _records.fold<int>(0, (s, r) => s + (r.workedMinutes ?? 0)) / 60;
    final overtimeH = _records.fold<int>(0, (s, r) => s + r.overtimeMin) / 60;
    final lateDays = _records.where((r) => r.isLate).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Bugünkü durum
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Bugün · ${DateFormat('dd MMM yyyy').format(DateTime.now())}',
                    style: const TextStyle(color: Color(0xFFDBEAFE), fontSize: 13)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _timeBox('Giriş', today?.checkIn)),
                    Expanded(child: _timeBox('Çıkış', today?.checkOut)),
                  ],
                ),
                if (today?.isLate == true)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text('Geç giriş',
                        style: TextStyle(color: Color(0xFFFECACA), fontWeight: FontWeight.w600)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Aksiyon
          if (_busy)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (!hasIn)
            _actionButton('QR Okut · Giriş Yap', const Color(0xFF16A34A), _startScan)
          else if (!hasOut)
            _actionButton('Çıkış Yap', const Color(0xFFDC2626), _checkOut)
          else
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Text('Bugünkü mesai tamamlandı ✓',
                    style: TextStyle(color: Color(0xFF166534), fontWeight: FontWeight.w600)),
              ),
            ),

          const SizedBox(height: 24),
          const Text('Bu Ay', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Row(children: [
            _stat('Çalışma', '${workedH.toStringAsFixed(1)} sa'),
            const SizedBox(width: 10),
            _stat('Fazla Mesai', '${overtimeH.toStringAsFixed(1)} sa'),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            _stat('Geç Gün', '$lateDays'),
            const SizedBox(width: 10),
            _stat('Gün', '${_records.length}'),
          ]),

          const SizedBox(height: 24),
          const Text('Son Kayıtlar', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          if (_records.isEmpty)
            const Text('Bu ay kayıt yok.', style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic))
          else
            ...(_records.toList()..sort((a, b) => b.date.compareTo(a.date)))
                .take(10)
                .map(_recordRow),
        ],
      ),
    );
  }

  Widget _timeBox(String label, DateTime? time) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFFBFDBFE), fontSize: 12)),
        Text(time != null ? DateFormat('HH:mm').format(time) : '--:--',
            style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _actionButton(String text, Color color, VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        child: Text(text, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _stat(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _recordRow(Attendance r) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF3F4F6))),
      ),
      child: Row(
        children: [
          Expanded(child: Text(DateFormat('dd MMM E').format(r.date),
              style: const TextStyle(fontWeight: FontWeight.w500))),
          Text(
            '${r.checkIn != null ? DateFormat('HH:mm').format(r.checkIn!) : '--'} → '
            '${r.checkOut != null ? DateFormat('HH:mm').format(r.checkOut!) : '--'}',
            style: const TextStyle(color: Colors.grey),
          ),
          if (r.isLate)
            const Padding(
              padding: EdgeInsets.only(left: 8),
              child: Text('geç', style: TextStyle(color: Colors.red, fontSize: 12)),
            ),
        ],
      ),
    );
  }
}

/// Tam ekran QR tarayıcı; okunan değeri Navigator.pop ile döner.
class _ScannerPage extends StatefulWidget {
  const _ScannerPage();

  @override
  State<_ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<_ScannerPage> {
  bool _done = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(title: const Text('QR Okut')),
      body: Stack(
        alignment: Alignment.center,
        children: [
          MobileScanner(
            onDetect: (capture) {
              if (_done) return;
              final list = capture.barcodes;
              if (list.isNotEmpty && list.first.rawValue != null) {
                _done = true;
                Navigator.of(context).pop(list.first.rawValue);
              }
            },
          ),
          Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 3),
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          const Positioned(
            bottom: 80,
            child: Text('Web panelindeki QR kodu çerçeveye getir',
                style: TextStyle(color: Colors.white, fontSize: 15)),
          ),
        ],
      ),
    );
  }
}
