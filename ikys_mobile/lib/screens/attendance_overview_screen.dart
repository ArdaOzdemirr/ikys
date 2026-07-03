import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';

/// İK/Admin: seçilen günde tüm personelin giriş/çıkış durumu.
class AttendanceOverviewScreen extends StatefulWidget {
  const AttendanceOverviewScreen({super.key});

  @override
  State<AttendanceOverviewScreen> createState() => _AttendanceOverviewScreenState();
}

class _AttendanceOverviewScreenState extends State<AttendanceOverviewScreen> {
  DateTime _date = DateTime.now();
  List<AttendanceOverviewRow> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_date);
      _rows = await AttendanceService.allForDate(dateStr);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e, 'Yüklenemedi'))),
        );
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      locale: const Locale('tr', 'TR'),
    );
    if (picked == null) return;
    setState(() => _date = picked);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Personel Mesai Durumu'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_month),
            onPressed: _pickDate,
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: const Color(0xFFEFF6FF),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Text(
              DateFormat('dd MMMM yyyy').format(_date),
              style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF1D4ED8)),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _rows.isEmpty
                        ? ListView(
                            children: const [
                              Padding(
                                padding: EdgeInsets.all(32),
                                child: Center(child: Text('Aktif personel yok')),
                              ),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _rows.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (context, i) => _row(_rows[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _row(AttendanceOverviewRow r) {
    final Widget status;
    if (r.checkIn == null) {
      status = const _Badge(text: 'Giriş yapmadı', color: Color(0xFF6B7280), bg: Color(0xFFF3F4F6));
    } else if (r.isLate) {
      status = const _Badge(text: 'Geç kaldı', color: Color(0xFFC2410C), bg: Color(0xFFFFEDD5));
    } else {
      status = const _Badge(text: 'Zamanında', color: Color(0xFF15803D), bg: Color(0xFFDCFCE7));
    }

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(
                    [r.department, r.employeeNo].where((e) => e != null && e.isNotEmpty).join(' · '),
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Giriş: ${r.checkIn != null ? DateFormat('HH:mm').format(r.checkIn!) : '--:--'}   '
                    'Çıkış: ${r.checkOut != null ? DateFormat('HH:mm').format(r.checkOut!) : '--:--'}',
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
            status,
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String text;
  final Color color;
  final Color bg;
  const _Badge({required this.text, required this.color, required this.bg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
