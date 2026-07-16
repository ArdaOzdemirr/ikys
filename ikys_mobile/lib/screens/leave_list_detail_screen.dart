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
  'CANCEL_REQUESTED': (label: 'İptal Onayı Bekliyor', bg: Color(0xFFFEF3C7), fg: Color(0xFF92400E)),
};

const _months = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/// İK/Muhasebe/Admin/Yönetici: tek bir personelin tüm izin geçmişi.
class LeaveListDetailScreen extends StatefulWidget {
  final LeavePersonnelRow personnel;
  const LeaveListDetailScreen({super.key, required this.personnel});

  @override
  State<LeaveListDetailScreen> createState() => _LeaveListDetailScreenState();
}

class _LeaveListDetailScreenState extends State<LeaveListDetailScreen> {
  List<LeaveListItem> _items = [];
  bool _loading = true;
  String _status = 'ALL';
  int? _year;
  int? _month;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await LeaveListService.list(status: _status, year: _year);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Yüklenemedi'))));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  List<LeaveListItem> get _filtered => _items
      .where((r) =>
          r.personnelId == widget.personnel.id && (_month == null || r.startDate.month == _month))
      .toList()
    ..sort((a, b) => a.startDate.compareTo(b.startDate));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.personnel.fullName)),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Wrap(
              spacing: 12,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                DropdownButton<String>(
                  value: _status,
                  items: const [
                    DropdownMenuItem(value: 'ALL', child: Text('Tümü')),
                    DropdownMenuItem(value: 'APPROVED', child: Text('Onaylanmış')),
                    DropdownMenuItem(value: 'PENDING', child: Text('Bekleyen')),
                    DropdownMenuItem(value: 'CANCEL_REQUESTED', child: Text('İptal Onayı Bekleyen')),
                    DropdownMenuItem(value: 'REJECTED', child: Text('Reddedilen')),
                    DropdownMenuItem(value: 'CANCELLED', child: Text('İptal Edilen')),
                  ],
                  onChanged: (v) {
                    if (v != null) {
                      setState(() => _status = v);
                      _load();
                    }
                  },
                ),
                DropdownButton<int?>(
                  value: _year,
                  hint: const Text('Tüm yıllar'),
                  items: [
                    const DropdownMenuItem<int?>(value: null, child: Text('Tüm yıllar')),
                    ...List.generate(3, (i) => DateTime.now().year - i).map(
                      (y) => DropdownMenuItem<int?>(value: y, child: Text('$y')),
                    ),
                  ],
                  onChanged: (v) {
                    setState(() => _year = v);
                    _load();
                  },
                ),
                DropdownButton<int?>(
                  value: _month,
                  hint: const Text('Tüm aylar'),
                  items: [
                    const DropdownMenuItem<int?>(value: null, child: Text('Tüm aylar')),
                    ...List.generate(12, (i) => i + 1).map(
                      (m) => DropdownMenuItem<int?>(value: m, child: Text(_months[m - 1])),
                    ),
                  ],
                  onChanged: (v) => setState(() => _month = v),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _filtered.isEmpty
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
                            children: _filtered.map(_card).toList(),
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
                child: Text(r.leaveName, style: const TextStyle(fontWeight: FontWeight.bold)),
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
            '${DateFormat('dd.MM.yyyy').format(r.startDate)} / '
            '${DateFormat('dd.MM.yyyy').format(r.endDate)} arası izinli · '
            '${formatDays(r.totalDays)} gün',
            style: const TextStyle(color: Color(0xFF374151)),
          ),
          if (r.paymentType != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(r.paymentType == 'PAID' ? 'Ücretli' : 'Ücretsiz',
                  style: TextStyle(
                      color: r.paymentType == 'UNPAID' ? const Color(0xFFDC2626) : const Color(0xFF166534),
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}
