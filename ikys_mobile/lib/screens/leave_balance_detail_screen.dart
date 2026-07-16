import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';

/// İK/Admin: tek bir personelin yıllık izin hakedişi + aldığı tüm izin tarihleri.
class LeaveBalanceDetailScreen extends StatefulWidget {
  final LeaveBalanceRow row;
  const LeaveBalanceDetailScreen({super.key, required this.row});

  @override
  State<LeaveBalanceDetailScreen> createState() => _LeaveBalanceDetailScreenState();
}

class _LeaveBalanceDetailScreenState extends State<LeaveBalanceDetailScreen> {
  String? _monthFilter; // null = tüm aylar, aksi halde "yyyy-MM"

  @override
  Widget build(BuildContext context) {
    final r = widget.row;
    final months = r.takenLeaves.map((l) => DateFormat('yyyy-MM').format(l.startDate)).toSet().toList()
      ..sort((a, b) => b.compareTo(a));
    final filtered = _monthFilter == null
        ? r.takenLeaves
        : r.takenLeaves.where((l) => DateFormat('yyyy-MM').format(l.startDate) == _monthFilter).toList();

    return Scaffold(
      appBar: AppBar(title: Text(r.fullName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            [r.department, 'İşe Giriş: ${DateFormat('dd.MM.yyyy').format(r.hireDate)}']
                .where((e) => e != null && e.isNotEmpty)
                .join(' · '),
            style: const TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _statCard('Toplam Hak', r.totalEntitled)),
              const SizedBox(width: 10),
              Expanded(child: _statCard('Kullanılan', r.used)),
              const SizedBox(width: 10),
              Expanded(child: _statCard('Kalan', r.remaining, highlight: true)),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Aldığı İzinler', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              if (months.isNotEmpty)
                DropdownButton<String?>(
                  value: _monthFilter,
                  underline: const SizedBox.shrink(),
                  hint: const Text('Tüm Aylar', style: TextStyle(fontSize: 13)),
                  style: const TextStyle(fontSize: 13, color: Colors.black87),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Tüm Aylar')),
                    ...months.map((m) => DropdownMenuItem<String?>(
                          value: m,
                          child: Text(DateFormat('MMMM yyyy', 'tr_TR').format(DateFormat('yyyy-MM').parse(m))),
                        )),
                  ],
                  onChanged: (v) => setState(() => _monthFilter = v),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (filtered.isEmpty)
            Text(
              _monthFilter == null ? 'Hiç yıllık izin kullanmamış.' : 'Bu ayda izin yok.',
              style: const TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
            )
          else
            ...filtered.map((l) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    '${DateFormat('dd.MM.yyyy').format(l.startDate)} / '
                    '${DateFormat('dd.MM.yyyy').format(l.endDate)} arası izinli · '
                    '${l.totalDays.toStringAsFixed(0)} gün',
                    style: const TextStyle(fontSize: 14),
                  ),
                )),
        ],
      ),
    );
  }

  Widget _statCard(String label, double value, {bool highlight = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            value.toStringAsFixed(0),
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: highlight ? const Color(0xFF1D4ED8) : Colors.black87,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }
}
