import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';

const _statusStyle = {
  'APPROVED': (label: 'Onaylandı', bg: Color(0xFFDCFCE7), fg: Color(0xFF166534)),
  'PENDING': (label: 'Beklemede', bg: Color(0xFFFEF3C7), fg: Color(0xFF92400E)),
  'REJECTED': (label: 'Reddedildi', bg: Color(0xFFFEE2E2), fg: Color(0xFF991B1B)),
  'CANCELLED': (label: 'İptal', bg: Color(0xFFF3F4F6), fg: Color(0xFF6B7280)),
};

class LeaveListScreen extends StatefulWidget {
  const LeaveListScreen({super.key});

  @override
  State<LeaveListScreen> createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> {
  List<LeaveListItem> _items = [];
  bool _loading = true;
  String _status = 'APPROVED';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await LeaveListService.list(status: _status);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Yüklenemedi'))));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('İzin Listesi')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Text('Durum: '),
                const SizedBox(width: 8),
                DropdownButton<String>(
                  value: _status,
                  items: const [
                    DropdownMenuItem(value: 'APPROVED', child: Text('Onaylanmış')),
                    DropdownMenuItem(value: 'PENDING', child: Text('Bekleyen')),
                    DropdownMenuItem(value: 'REJECTED', child: Text('Reddedilen')),
                    DropdownMenuItem(value: 'ALL', child: Text('Tümü')),
                  ],
                  onChanged: (v) {
                    if (v != null) {
                      setState(() => _status = v);
                      _load();
                    }
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _items.isEmpty
                        ? ListView(children: const [
                            Padding(
                              padding: EdgeInsets.only(top: 80),
                              child: Center(
                                  child: Text('Kayıt yok',
                                      style: TextStyle(color: Colors.grey))),
                            )
                          ])
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            children: _items.map(_card).toList(),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _card(LeaveListItem r) {
    final s = _statusStyle[r.status] ?? _statusStyle['PENDING']!;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text('${r.personName} (${r.employeeNo})',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration:
                    BoxDecoration(color: s.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(s.label,
                    style: TextStyle(color: s.fg, fontSize: 12, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${r.leaveName} · ${r.totalDays.toStringAsFixed(0)} gün\n'
            '${DateFormat('dd MMM').format(r.startDate)} – '
            '${DateFormat('dd MMM yyyy').format(r.endDate)}',
            style: const TextStyle(color: Color(0xFF374151)),
          ),
          if (r.department != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(r.department!,
                  style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ),
          if (r.paymentType != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(r.paymentType == 'PAID' ? 'Ücretli' : 'Ücretsiz',
                  style: const TextStyle(
                      color: Color(0xFF166534), fontSize: 12, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}
