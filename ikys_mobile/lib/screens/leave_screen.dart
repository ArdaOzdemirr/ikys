import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';

const _typeLabels = {
  'ANNUAL': 'Yıllık İzin',
  'HALF_DAY': 'Yarım Gün',
  'HOURLY': 'Saatlik',
  'EXCUSE': 'Mazeret',
  'SICK': 'Sağlık Raporu',
  'MATERNITY': 'Doğum İzni',
  'PATERNITY': 'Babalık İzni',
  'MARRIAGE': 'Evlilik İzni',
  'BEREAVEMENT': 'Vefat İzni',
  'UNPAID': 'Ücretsiz İzin',
};

const _statusStyle = {
  'PENDING': (label: 'Beklemede', bg: Color(0xFFFEF3C7), fg: Color(0xFF92400E)),
  'APPROVED': (label: 'Onaylandı', bg: Color(0xFFDCFCE7), fg: Color(0xFF166534)),
  'REJECTED': (label: 'Reddedildi', bg: Color(0xFFFEE2E2), fg: Color(0xFF991B1B)),
  'CANCELLED': (label: 'İptal', bg: Color(0xFFF3F4F6), fg: Color(0xFF6B7280)),
  'CANCEL_REQUESTED': (label: 'İptal Onayı Bekliyor', bg: Color(0xFFFEF3C7), fg: Color(0xFF92400E)),
};

String _leaveName(LeaveRequest r) {
  if (r.category?.name != null) return r.category!.name;
  if (r.type != null && _typeLabels[r.type] != null) return _typeLabels[r.type]!;
  return r.type ?? 'İzin';
}

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  List<LeaveBalance> _balances = [];
  List<LeaveRequest> _requests = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        LeaveService.myBalance(),
        LeaveService.myRequests(),
      ]);
      _balances = results[0] as List<LeaveBalance>;
      _requests = results[1] as List<LeaveRequest>;
    } catch (e) {
      if (mounted) _snack(ApiClient.errorMessage(e, 'Yüklenemedi'));
    }
    if (mounted) setState(() => _loading = false);
  }

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  /// Henüz onaylanmamış (PENDING) talebi doğrudan geri çeker.
  Future<void> _cancel(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('İptal'),
        content: const Text('Bu izin talebini iptal etmek istiyor musun?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Vazgeç')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('İptal Et')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await LeaveService.cancel(id);
      _snack('İzin talebi iptal edildi.');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'İptal edilemedi'));
    }
  }

  /// Onaylı (henüz başlamamış) izin için amir onayı gerektiren iptal talebi oluşturur.
  Future<void> _requestCancellation(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('İptal Talebi Oluştur'),
        content: const Text(
            'Bu izin onaylanmıştı. İptal etmek için amir onayı gerekir. Talep gönderilsin mi?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Vazgeç')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Talep Gönder')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await LeaveService.requestCancellation(id);
      _snack('İptal talebiniz amire iletildi.');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'İşlem başarısız'));
    }
  }

  Future<void> _openNew() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NewLeaveSheet(),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('İzin Bakiyesi', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          if (_balances.isEmpty)
            const Text('Tanımlı izin bakiyesi yok.',
                style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic))
          else
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _balances.map((b) => _balanceCard(b)).toList(),
            ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _openNew,
              style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
              child: const Text('+ Yeni İzin Talebi'),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Taleplerim', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          if (_requests.isEmpty)
            const Text('Henüz izin talebin yok.',
                style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic))
          else
            ..._requests.map(_requestCard),
        ],
      ),
    );
  }

  Widget _balanceCard(LeaveBalance b) {
    return Container(
      width: (MediaQuery.of(context).size.width - 32 - 10) / 2,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(b.remainingDays.toStringAsFixed(0),
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Color(0xFF1D4ED8))),
          const Text('gün kaldı', style: TextStyle(color: Color(0xFF3B82F6), fontSize: 12)),
          const SizedBox(height: 8),
          Text(_typeLabels[b.type] ?? b.type,
              style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF1E3A8A))),
          Text('${b.usedDays.toStringAsFixed(0)}/${b.totalDays.toStringAsFixed(0)} kullanıldı',
              style: const TextStyle(color: Color(0xFF60A5FA), fontSize: 12)),
        ],
      ),
    );
  }

  Widget _requestCard(LeaveRequest r) {
    final s = _statusStyle[r.status] ?? _statusStyle['PENDING']!;
    final canWithdraw = r.status == 'PENDING';
    final canRequestCancellation = r.status == 'APPROVED' && r.startDate.isAfter(DateTime.now());
    final started = r.status == 'APPROVED' && !r.startDate.isAfter(DateTime.now());
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
              Expanded(child: Text(_leaveName(r),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: s.bg, borderRadius: BorderRadius.circular(999)),
                child: Text(s.label, style: TextStyle(color: s.fg, fontSize: 12, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${DateFormat('dd MMM').format(r.startDate)} – '
            '${DateFormat('dd MMM yyyy').format(r.endDate)} · ${r.totalDays.toStringAsFixed(0)} gün',
            style: const TextStyle(color: Color(0xFF374151)),
          ),
          if (r.requiresPaymentDecision && r.status == 'PENDING')
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Ücretli/ücretsiz kararı bekleniyor',
                  style: TextStyle(color: Color(0xFFB45309), fontSize: 13, fontWeight: FontWeight.w600)),
            ),
          if (r.paymentType != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(r.paymentType == 'PAID' ? 'Ücretli izin' : 'Ücretsiz izin',
                  style: const TextStyle(color: Color(0xFF166534), fontSize: 13, fontWeight: FontWeight.w600)),
            ),
          if (r.reason != null && r.reason!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(r.reason!, style: const TextStyle(color: Colors.grey, fontSize: 13)),
            ),
          if (r.status == 'REJECTED' && r.rejectionReason != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Ret: ${r.rejectionReason}',
                  style: const TextStyle(color: Colors.red, fontSize: 13)),
            ),
          if (started)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Başlamış izin iptal edilemez',
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            ),
          if (canWithdraw)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => _cancel(r.id),
                style: TextButton.styleFrom(padding: EdgeInsets.zero),
                child: const Text('İptal Et', style: TextStyle(color: Colors.red)),
              ),
            ),
          if (canRequestCancellation)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => _requestCancellation(r.id),
                style: TextButton.styleFrom(padding: EdgeInsets.zero),
                child: const Text('İptal Talebi Oluştur', style: TextStyle(color: Color(0xFFB45309))),
              ),
            ),
        ],
      ),
    );
  }
}

/// Yeni izin talebi formu (alttan açılan sayfa)
class _NewLeaveSheet extends StatefulWidget {
  const _NewLeaveSheet();

  @override
  State<_NewLeaveSheet> createState() => _NewLeaveSheetState();
}

class _NewLeaveSheetState extends State<_NewLeaveSheet> {
  List<LeaveCategory> _categories = [];
  bool _loadingCats = true;
  String? _categoryId;
  // Kategori yoksa (hiçbiri açık değilse) enum tabanlı varsayılan türler
  String? _fallbackType;
  DateTime _start = DateTime.now();
  DateTime _end = DateTime.now();
  final _reason = TextEditingController();
  bool _submitting = false;

  // Sabit izin türleri (kategori tanımlı/görünür değilse devreye girer)
  static const _fallbackTypes = <String, String>{
    'ANNUAL': 'Yıllık İzin',
    'EXCUSE': 'Mazeret',
    'SICK': 'Sağlık Raporu',
    'UNPAID': 'Ücretsiz İzin',
    'MARRIAGE': 'Evlilik',
    'BEREAVEMENT': 'Vefat',
    'MATERNITY': 'Doğum',
    'PATERNITY': 'Babalık',
  };

  @override
  void initState() {
    super.initState();
    _loadCats();
  }

  Future<void> _loadCats() async {
    try {
      _categories = await LeaveService.myCategories();
      if (_categories.isNotEmpty) _categoryId = _categories.first.id;
    } catch (_) {}
    // Hiç kategori yoksa varsayılan türlerden ilkini seç
    if (_categories.isEmpty) _fallbackType = _fallbackTypes.keys.first;
    if (mounted) setState(() => _loadingCats = false);
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _start : _end,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _start = picked;
        if (_end.isBefore(_start)) _end = _start;
      } else {
        _end = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (_categoryId == null && _fallbackType == null) return;
    setState(() => _submitting = true);
    try {
      await LeaveService.create(
        categoryId: _categoryId,
        type: _categoryId == null ? _fallbackType : null,
        startDate: DateFormat('yyyy-MM-dd').format(_start),
        endDate: DateFormat('yyyy-MM-dd').format(_end),
        reason: _reason.text.trim(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ApiClient.errorMessage(e, 'Talep oluşturulamadı'))),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        builder: (_, controller) => Container(
          color: Colors.white,
          child: ListView(
            controller: controller,
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('Kapat')),
                  const Text('Yeni İzin Talebi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(width: 60),
                ],
              ),
              const SizedBox(height: 12),
              const Text('İzin Türü', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (_loadingCats)
                const Center(child: CircularProgressIndicator())
              else if (_categories.isEmpty)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _fallbackTypes.entries.map((e) {
                    final sel = _fallbackType == e.key;
                    return ChoiceChip(
                      label: Text(e.value),
                      selected: sel,
                      onSelected: (_) => setState(() => _fallbackType = e.key),
                    );
                  }).toList(),
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _categories.map((c) {
                    final sel = _categoryId == c.id;
                    return ChoiceChip(
                      label: Text(c.name),
                      selected: sel,
                      onSelected: (_) => setState(() => _categoryId = c.id),
                    );
                  }).toList(),
                ),
              const SizedBox(height: 18),
              const Text('Başlangıç', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              _dateField(_start, () => _pickDate(true)),
              const SizedBox(height: 18),
              const Text('Bitiş', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              _dateField(_end, () => _pickDate(false)),
              const SizedBox(height: 18),
              const Text('Açıklama (opsiyonel)', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _reason,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Sebep / not',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: (_submitting || (_categoryId == null && _fallbackType == null)) ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    padding: const EdgeInsets.symmetric(vertical: 15),
                  ),
                  child: _submitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Talep Gönder', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _dateField(DateTime date, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFD1D5DB)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(DateFormat('dd MMMM yyyy').format(date), style: const TextStyle(fontSize: 15)),
      ),
    );
  }
}
