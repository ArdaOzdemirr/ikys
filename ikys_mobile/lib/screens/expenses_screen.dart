import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import '../services/services.dart';
import '../services/api_client.dart';

const _statusLabel = {
  'PENDING': ('Bekliyor', Color(0xFFD97706), Color(0xFFFFFBEB)),
  'APPROVED': ('Onaylandı', Color(0xFF16A34A), Color(0xFFF0FDF4)),
  'REJECTED': ('Reddedildi', Color(0xFFDC2626), Color(0xFFFEF2F2)),
  'PAID': ('Ödendi', Color(0xFF2563EB), Color(0xFFEFF6FF)),
};

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen>
    with SingleTickerProviderStateMixin {
  late final bool _isApprover;
  late final bool _isAccounting;
  late final TabController _tab;
  List<ExpenseItem> _mine = [];
  List<ExpenseItem> _pending = [];
  List<ExpenseItem> _approvedUnpaid = [];
  bool _loading = true;

  int get _tabCount => 1 + (_isApprover ? 1 : 0) + (_isAccounting ? 1 : 0);

  @override
  void initState() {
    super.initState();
    _isApprover = context.read<AuthProvider>()
        .hasRole(['MANAGER', 'HR', 'ACCOUNTING', 'ADMIN']);
    _isAccounting = context.read<AuthProvider>().hasRole(['ACCOUNTING', 'ADMIN']);
    _tab = TabController(length: _tabCount, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _mine = await ExpenseService.mine();
    } catch (_) {}
    if (_isApprover) {
      try {
        _pending = await ExpenseService.pending();
      } catch (_) {}
    }
    if (_isAccounting) {
      try {
        _approvedUnpaid = await ExpenseService.approvedUnpaid();
      } catch (_) {}
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _pay(ExpenseItem e) async {
    try {
      await ExpenseService.pay(e.id);
      _snack('Ödeme işaretlendi');
      _load();
    } catch (err) {
      _snack(ApiClient.errorMessage(err, 'İşlem başarısız'));
    }
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  Future<void> _add() async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NewExpenseSheet(),
    );
    if (ok == true) {
      _snack('Masraf talebi oluşturuldu');
      _load();
    }
  }

  Future<void> _decide(ExpenseItem e, bool approved) async {
    String? reason;
    if (!approved) {
      reason = await _askReason();
      if (reason == null) return;
    }
    try {
      await ExpenseService.approve(e.id, approved, reason: reason);
      _snack(approved ? 'Onaylandı' : 'Reddedildi');
      _load();
    } catch (err) {
      _snack(ApiClient.errorMessage(err, 'İşlem başarısız'));
    }
  }

  Future<String?> _askReason() async {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Red sebebi'),
        content: TextField(controller: c, decoration: const InputDecoration(hintText: 'Sebep')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Vazgeç')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, c.text.trim().isEmpty ? 'Reddedildi' : c.text.trim()),
              child: const Text('Reddet')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      const Tab(text: 'Masraflarım'),
      if (_isApprover) const Tab(text: 'Onay Bekleyen'),
      if (_isAccounting) const Tab(text: 'Ödenecekler'),
    ];
    final views = [
      _mineList(),
      if (_isApprover) _pendingList(),
      if (_isAccounting) _approvedUnpaidList(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Masraflar / Para Talepleri'),
        bottom: tabs.length > 1 ? TabBar(controller: _tab, tabs: tabs) : null,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        icon: const Icon(Icons.add),
        label: const Text('Masraf / Avans Ekle'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : tabs.length > 1
              ? TabBarView(controller: _tab, children: views)
              : views.first,
    );
  }

  Widget _mineList() {
    if (_mine.isEmpty) {
      return const Center(child: Text('Henüz masraf/avans talebin yok.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: _mine.map((e) => _card(e)).toList(),
      ),
    );
  }

  Widget _pendingList() {
    if (_pending.isEmpty) {
      return const Center(child: Text('Onay bekleyen talep yok.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: _pending.map((e) => _card(e, approvable: true)).toList(),
      ),
    );
  }

  Widget _approvedUnpaidList() {
    if (_approvedUnpaid.isEmpty) {
      return const Center(child: Text('Ödemesi bekleyen talep yok.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: _approvedUnpaid.map((e) => _card(e, showPay: true)).toList(),
      ),
    );
  }

  Widget _card(ExpenseItem e, {bool approvable = false, bool showPay = false}) {
    final st = _statusLabel[e.status] ?? ('?', Colors.grey, const Color(0xFFF3F4F6));
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
            children: [
              Expanded(
                child: Text(e.category,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ),
              Text('${e.amount.toStringAsFixed(2)} ${e.currency}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 4),
          Text(e.description, style: const TextStyle(color: Colors.black87)),
          const SizedBox(height: 6),
          Row(
            children: [
              if ((approvable || showPay) && e.personnelName != null) ...[
                const Icon(Icons.person, size: 13, color: Colors.grey),
                const SizedBox(width: 2),
                Text(e.personnelName!, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(width: 10),
              ],
              const Icon(Icons.event, size: 13, color: Colors.grey),
              const SizedBox(width: 2),
              Text(DateFormat('dd.MM.yyyy').format(e.date),
                  style: const TextStyle(color: Colors.grey, fontSize: 12)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: st.$3, borderRadius: BorderRadius.circular(6)),
                child: Text(st.$1, style: TextStyle(color: st.$2, fontSize: 11, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          if (e.receiptUrl != null) ...[
            const SizedBox(height: 6),
            InkWell(
              onTap: () => ApiClient.instance.openFileUrl(e.receiptUrl!),
              child: const Row(
                children: [
                  Icon(Icons.attach_file, size: 14, color: Color(0xFF2563EB)),
                  SizedBox(width: 4),
                  Text('Fiş/Faturayı Gör',
                      style: TextStyle(color: Color(0xFF2563EB), fontSize: 12)),
                ],
              ),
            ),
          ],
          if (approvable && e.status == 'PENDING') ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _decide(e, false),
                    style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
                    child: const Text('Reddet'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: () => _decide(e, true),
                    child: const Text('Onayla'),
                  ),
                ),
              ],
            ),
          ],
          if (showPay) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => _pay(e),
                icon: const Icon(Icons.payments, size: 18),
                label: const Text('Öde'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _NewExpenseSheet extends StatefulWidget {
  const _NewExpenseSheet();

  @override
  State<_NewExpenseSheet> createState() => _NewExpenseSheetState();
}

class _NewExpenseSheetState extends State<_NewExpenseSheet> {
  final _amount = TextEditingController();
  final _desc = TextEditingController();
  String _category = 'Yemek';
  DateTime _date = DateTime.now();
  bool _saving = false;
  PlatformFile? _receiptFile;

  static const _categories = ['Yemek', 'Yol', 'Konaklama', 'İş', 'Avans', 'Diğer'];

  Future<void> _pickReceipt() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
    );
    if (result != null && result.files.isNotEmpty) {
      setState(() => _receiptFile = result.files.first);
    }
  }

  Future<void> _save() async {
    final amount = double.tryParse(_amount.text.replaceAll(',', '.')) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Geçerli bir tutar gir')));
      return;
    }
    if (_desc.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Açıklama gir')));
      return;
    }
    setState(() => _saving = true);
    try {
      String? receiptUrl;
      if (_receiptFile?.path != null) {
        receiptUrl = await ExpenseService.uploadReceipt(
          _receiptFile!.path!,
          _receiptFile!.name,
        );
      }
      await ExpenseService.create(
        category: _category,
        amount: amount,
        date: DateFormat('yyyy-MM-dd').format(_date),
        description: _desc.text.trim(),
        receiptUrl: receiptUrl,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ApiClient.errorMessage(e))));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Masraf / Avans Ekle',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text(
            'Fişli masraf için fiş/fatura ekle; doğrudan para talebi için "Avans" seç (fiş gerekmez).',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(labelText: 'Kategori', border: OutlineInputBorder()),
            items: _categories
                .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                .toList(),
            onChanged: (v) => setState(() => _category = v ?? 'Diğer'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Tutar (TL)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          InkWell(
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: _date,
                firstDate: DateTime(2020),
                lastDate: DateTime(2100),
              );
              if (d != null) setState(() => _date = d);
            },
            child: InputDecorator(
              decoration: const InputDecoration(labelText: 'Tarih', border: OutlineInputBorder()),
              child: Text(DateFormat('dd.MM.yyyy').format(_date)),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _desc,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Açıklama', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _pickReceipt,
            icon: const Icon(Icons.attach_file, size: 18),
            label: Text(_receiptFile == null
                ? 'Fiş/Fatura Ekle (opsiyonel)'
                : _receiptFile!.name),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Kaydediliyor...' : 'Gönder'),
            ),
          ),
        ],
      ),
    );
  }
}
