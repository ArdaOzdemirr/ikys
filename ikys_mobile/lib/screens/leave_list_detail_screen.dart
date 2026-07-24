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

// Saatlik ve Yarım Gün ayrı akışlarda (kendi ekstra alanları var) verildiği
// için bu genel "İzin Ekle" formunda listelenmiyor.
const _grantTypeLabels = {
  'ANNUAL': 'Yıllık İzin',
  'EXCUSE': 'Mazeret',
  'SICK': 'Sağlık Raporu',
  'MATERNITY': 'Doğum İzni',
  'PATERNITY': 'Babalık İzni',
  'MARRIAGE': 'Evlilik İzni',
  'BEREAVEMENT': 'Vefat İzni',
  'UNPAID': 'Ücretsiz İzin',
};

/// İK/Muhasebe/Admin/Yönetici: tek bir personelin tüm izin geçmişi.
class LeaveListDetailScreen extends StatefulWidget {
  final LeavePersonnelRow personnel;
  const LeaveListDetailScreen({super.key, required this.personnel});

  @override
  State<LeaveListDetailScreen> createState() => _LeaveListDetailScreenState();
}

class _LeaveListDetailScreenState extends State<LeaveListDetailScreen> {
  List<LeaveListItem> _items = [];
  List<LeaveBalanceRow> _balances = [];
  bool _loading = true;
  String _status = 'ALL';
  int? _year = DateTime.now().year;
  int? _month;
  bool _showHourlyForm = false;
  bool _grantingHourly = false;
  bool _openingReport = false;
  DateTime? _hourlyDate;
  TimeOfDay? _hourlyStart;
  TimeOfDay? _hourlyEnd;
  final _hourlyReason = TextEditingController();

  bool _showGrantForm = false;
  bool _granting = false;
  String _grantType = 'ANNUAL';
  DateTime? _grantStart;
  DateTime? _grantEnd;
  final _grantReason = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await LeaveListService.list(status: _status, year: _year);
      _balances = await LeaveService.allBalances();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Yüklenemedi'))));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  LeaveBalanceRow? get _myBalance {
    final matches = _balances.where((b) => b.personnelId == widget.personnel.id);
    return matches.isEmpty ? null : matches.first;
  }

  Future<void> _viewYearlyReport() async {
    setState(() => _openingReport = true);
    try {
      final yearParam = _year?.toString() ?? 'all';
      final nameSlug = widget.personnel.fullName.replaceAll(' ', '-');
      await ApiClient.instance.openFileUrl(
        '/leave/balance/${widget.personnel.id}/pdf?year=$yearParam',
        fileName: 'izin-dokumu-$nameSlug-$yearParam.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Açılamadı'))));
      }
    }
    if (mounted) setState(() => _openingReport = false);
  }

  List<LeaveListItem> get _filtered => _items
      .where((r) =>
          r.personnelId == widget.personnel.id && (_month == null || r.startDate.month == _month))
      .toList()
    ..sort((a, b) => b.startDate.compareTo(a.startDate));

  Future<void> _pickHourlyDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _hourlyDate ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      locale: const Locale('tr', 'TR'),
    );
    if (picked != null) setState(() => _hourlyDate = picked);
  }

  Future<void> _pickHourlyTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: (isStart ? _hourlyStart : _hourlyEnd) ?? TimeOfDay.now(),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _hourlyStart = picked;
      } else {
        _hourlyEnd = picked;
      }
    });
  }

  String _fmtTime(TimeOfDay? t) => t == null
      ? '--:--'
      : '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  Future<void> _submitHourly() async {
    if (_hourlyDate == null || _hourlyStart == null || _hourlyEnd == null) return;
    setState(() => _grantingHourly = true);
    try {
      await LeaveService.grantHourly(
        personnelId: widget.personnel.id,
        date: DateFormat('yyyy-MM-dd').format(_hourlyDate!),
        startTime: _fmtTime(_hourlyStart),
        endTime: _fmtTime(_hourlyEnd),
        reason: _hourlyReason.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Saatlik izin tanımlandı')));
        setState(() {
          _showHourlyForm = false;
          _hourlyDate = null;
          _hourlyStart = null;
          _hourlyEnd = null;
          _hourlyReason.clear();
        });
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Tanımlanamadı'))));
      }
    } finally {
      if (mounted) setState(() => _grantingHourly = false);
    }
  }

  Future<void> _pickGrantDate(bool isStart) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _grantStart : _grantEnd) ?? now,
      // Geçmişe dönük izin girilebilsin diye alt sınır uzak bir tarih.
      firstDate: DateTime(now.year - 5),
      lastDate: now.add(const Duration(days: 365)),
      locale: const Locale('tr', 'TR'),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _grantStart = picked;
        } else {
          _grantEnd = picked;
        }
      });
    }
  }

  Future<void> _submitGrant() async {
    if (_grantStart == null || _grantEnd == null) return;
    setState(() => _granting = true);
    try {
      await LeaveService.adminGrant(
        personnelId: widget.personnel.id,
        type: _grantType,
        startDate: DateFormat('yyyy-MM-dd').format(_grantStart!),
        endDate: DateFormat('yyyy-MM-dd').format(_grantEnd!),
        reason: _grantReason.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('İzin tanımlandı')));
        setState(() {
          _showGrantForm = false;
          _grantStart = null;
          _grantEnd = null;
          _grantReason.clear();
        });
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Tanımlanamadı'))));
      }
    } finally {
      if (mounted) setState(() => _granting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.personnel.fullName),
        actions: [
          IconButton(
            icon: _openingReport
                ? const SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.picture_as_pdf_outlined),
            tooltip: 'Yıllık Rapor Görüntüle',
            onPressed: _openingReport ? null : _viewYearlyReport,
          ),
          IconButton(
            icon: Icon(_showHourlyForm ? Icons.close : Icons.access_time),
            tooltip: 'Saatlik İzin Ver',
            onPressed: () => setState(() => _showHourlyForm = !_showHourlyForm),
          ),
          IconButton(
            icon: Icon(_showGrantForm ? Icons.close : Icons.event_available_outlined),
            tooltip: 'İzin Ekle',
            onPressed: () => setState(() => _showGrantForm = !_showGrantForm),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_myBalance != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Row(
                children: [
                  Expanded(child: _balanceCard('Toplam Hak', _myBalance!.totalEntitled)),
                  const SizedBox(width: 8),
                  Expanded(child: _balanceCard('Kullanılan', _myBalance!.used)),
                  const SizedBox(width: 8),
                  Expanded(child: _balanceCard('Kalan', _myBalance!.remaining, highlight: true)),
                ],
              ),
            ),
          if (_showHourlyForm)
            Container(
              margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Saatlik İzin Ver', style: TextStyle(fontWeight: FontWeight.bold)),
                  const Padding(
                    padding: EdgeInsets.only(top: 2, bottom: 8),
                    child: Text(
                      'Bu izin doğrudan onaylı olarak kaydedilir ve yıllık izin bakiyesini etkilemez.',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton(
                        onPressed: _pickHourlyDate,
                        child: Text(_hourlyDate == null
                            ? 'Tarih Seç'
                            : DateFormat('dd.MM.yyyy').format(_hourlyDate!)),
                      ),
                      OutlinedButton(
                        onPressed: () => _pickHourlyTime(true),
                        child: Text('Başlangıç: ${_fmtTime(_hourlyStart)}'),
                      ),
                      OutlinedButton(
                        onPressed: () => _pickHourlyTime(false),
                        child: Text('Bitiş: ${_fmtTime(_hourlyEnd)}'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _hourlyReason,
                    decoration: const InputDecoration(
                      hintText: 'Açıklama (opsiyonel)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: (_grantingHourly ||
                              _hourlyDate == null ||
                              _hourlyStart == null ||
                              _hourlyEnd == null)
                          ? null
                          : _submitHourly,
                      child: _grantingHourly
                          ? const SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Kaydet'),
                    ),
                  ),
                ],
              ),
            ),
          if (_showGrantForm)
            Container(
              margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('İzin Ekle', style: TextStyle(fontWeight: FontWeight.bold)),
                  const Padding(
                    padding: EdgeInsets.only(top: 2, bottom: 8),
                    child: Text(
                      'Bu izin onay süreci gerektirmeden doğrudan onaylı olarak kaydedilir; geçmiş tarihler de seçilebilir.',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: _grantType,
                    decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true),
                    items: _grantTypeLabels.entries
                        .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) setState(() => _grantType = v);
                    },
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton(
                        onPressed: () => _pickGrantDate(true),
                        child: Text(_grantStart == null
                            ? 'Başlangıç Tarihi'
                            : DateFormat('dd.MM.yyyy').format(_grantStart!)),
                      ),
                      OutlinedButton(
                        onPressed: () => _pickGrantDate(false),
                        child: Text(_grantEnd == null
                            ? 'Bitiş Tarihi'
                            : DateFormat('dd.MM.yyyy').format(_grantEnd!)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _grantReason,
                    decoration: const InputDecoration(
                      hintText: 'Açıklama (opsiyonel)',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: (_granting || _grantStart == null || _grantEnd == null)
                          ? null
                          : _submitGrant,
                      child: _granting
                          ? const SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Kaydet'),
                    ),
                  ),
                ],
              ),
            ),
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
                    // Sirketin Excel'den aktarilan izin verisi 2024'ten basliyor.
                    ...List.generate(DateTime.now().year - 2024 + 1, (i) => DateTime.now().year - i).map(
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

  Widget _balanceCard(String label, double value, {bool highlight = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xFFEFF6FF) : const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text('${formatDays(value)} gün',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: highlight ? const Color(0xFF1D4ED8) : Colors.black87,
              )),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
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
          if (r.status == 'APPROVED')
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => ApiClient.instance.openFileUrl(
                  '/leave/requests/${r.id}/document',
                  fileName: 'izin-onay-belgesi-${DateFormat('yyyy-MM-dd').format(r.startDate)}.pdf',
                ),
                style: TextButton.styleFrom(padding: EdgeInsets.zero),
                child: const Text('Belge Görüntüle', style: TextStyle(color: Color(0xFF2563EB))),
              ),
            ),
        ],
      ),
    );
  }
}
