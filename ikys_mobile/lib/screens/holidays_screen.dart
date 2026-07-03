import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/services.dart';

/// Resmi tatiller: herkes görür, sadece İK/Admin ekleyip silebilir.
class HolidaysScreen extends StatefulWidget {
  const HolidaysScreen({super.key});

  @override
  State<HolidaysScreen> createState() => _HolidaysScreenState();
}

class _HolidaysScreenState extends State<HolidaysScreen> {
  List<Holiday> _holidays = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _holidays = await HolidayService.list()
        ..sort((a, b) => a.date.compareTo(b.date));
    } catch (e) {
      if (mounted) _snack(ApiClient.errorMessage(e, 'Yüklenemedi'));
    }
    if (mounted) setState(() => _loading = false);
  }

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _remove(Holiday h) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Tatili Sil'),
        content: Text('"${h.name}" tatilini silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Sil')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await HolidayService.remove(h.id);
      _snack('Tatil silindi');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Silinemedi'));
    }
  }

  Future<void> _addDialog() async {
    final nameCtrl = TextEditingController();
    DateTime? date;
    bool recurring = false;
    final saved = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setSt) => AlertDialog(
          title: const Text('Yeni Tatil'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Tatil Adı'),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(date == null
                    ? 'Tarih seç'
                    : DateFormat('dd MMMM yyyy').format(date!)),
                trailing: const Icon(Icons.calendar_month),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: c,
                    initialDate: DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                    locale: const Locale('tr', 'TR'),
                  );
                  if (picked != null) setSt(() => date = picked);
                },
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: recurring,
                onChanged: (v) => setSt(() => recurring = v ?? false),
                title: const Text('Her yıl tekrarlanır'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Vazgeç')),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Ekle')),
          ],
        ),
      ),
    );
    if (saved != true) return;
    if (nameCtrl.text.trim().isEmpty || date == null) {
      _snack('Ad ve tarih gerekli');
      return;
    }
    try {
      await HolidayService.create(
        name: nameCtrl.text.trim(),
        date: DateFormat('yyyy-MM-dd').format(date!),
        recurring: recurring,
      );
      _snack('Tatil eklendi');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Eklenemedi'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final canManage = context.watch<AuthProvider>().hasRole(['HR', 'ADMIN']);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Resmi Tatiller'),
        actions: [
          if (canManage)
            IconButton(icon: const Icon(Icons.add), onPressed: _addDialog),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _holidays.isEmpty
                  ? ListView(
                      children: const [
                        Padding(
                          padding: EdgeInsets.all(32),
                          child: Center(child: Text('Tatil yok')),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _holidays.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final h = _holidays[i];
                        return Card(
                          margin: EdgeInsets.zero,
                          child: ListTile(
                            leading: const Icon(Icons.calendar_today, color: Color(0xFF2563EB)),
                            title: Text(h.name),
                            subtitle: Text(
                              DateFormat('dd MMMM yyyy, EEEE').format(h.date) +
                                  (h.recurring ? ' · Her yıl' : ''),
                            ),
                            trailing: canManage
                                ? IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                                    onPressed: () => _remove(h),
                                  )
                                : null,
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
