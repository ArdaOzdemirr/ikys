import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/services.dart';

/// Resmi tatiller: herkes görür, sadece İK/Admin ekleyip silebilir.
/// İki sekme: "Bütün Resmi Tatiller" (yıl seçilebilir) ve "Yaklaşan Tatiller"
/// (bugünden itibaren, ileriye dönük).
class HolidaysScreen extends StatelessWidget {
  const HolidaysScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Resmi Tatiller'),
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.calendar_month), text: 'Bütün Tatiller'),
              Tab(icon: Icon(Icons.upcoming_outlined), text: 'Yaklaşan'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [_AllHolidaysTab(), _UpcomingHolidaysTab()],
        ),
      ),
    );
  }
}

class _AllHolidaysTab extends StatefulWidget {
  const _AllHolidaysTab();

  @override
  State<_AllHolidaysTab> createState() => _AllHolidaysTabState();
}

class _AllHolidaysTabState extends State<_AllHolidaysTab> {
  List<Holiday> _holidays = [];
  bool _loading = true;
  late int _year;

  @override
  void initState() {
    super.initState();
    _year = DateTime.now().year;
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _holidays = await HolidayService.list(year: _year)
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
    final thisYear = DateTime.now().year;

    return Scaffold(
      floatingActionButton: canManage
          ? FloatingActionButton(onPressed: _addDialog, child: const Icon(Icons.add))
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [
                DropdownButton<int>(
                  value: _year,
                  items: [thisYear - 1, thisYear, thisYear + 1, thisYear + 2]
                      .map((y) => DropdownMenuItem(value: y, child: Text('$y')))
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _year = v);
                    _load();
                  },
                ),
                const Spacer(),
                Text('${_holidays.length} tatil günü', style: const TextStyle(color: Colors.grey)),
              ],
            ),
          ),
          Expanded(
            child: _loading
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
          ),
        ],
      ),
    );
  }
}

class _UpcomingHolidaysTab extends StatefulWidget {
  const _UpcomingHolidaysTab();

  @override
  State<_UpcomingHolidaysTab> createState() => _UpcomingHolidaysTabState();
}

class _UpcomingHolidaysTabState extends State<_UpcomingHolidaysTab> {
  List<Holiday>? _holidays;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await HolidayService.upcoming();
      if (mounted) setState(() => _holidays = rows);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Yüklenemedi'))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final holidays = _holidays;
    return RefreshIndicator(
      onRefresh: _load,
      child: holidays == null
          ? const Center(child: CircularProgressIndicator())
          : holidays.isEmpty
              ? ListView(children: const [
                  Padding(
                    padding: EdgeInsets.only(top: 80),
                    child: Center(
                        child: Text('Yaklaşan tatil yok', style: TextStyle(color: Colors.grey))),
                  )
                ])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: holidays.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final h = holidays[i];
                    return Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        leading: const Icon(Icons.calendar_today, color: Color(0xFF2563EB)),
                        title: Text(h.name),
                        subtitle: Text(DateFormat('dd MMMM yyyy, EEEE').format(h.date)),
                      ),
                    );
                  },
                ),
    );
  }
}
