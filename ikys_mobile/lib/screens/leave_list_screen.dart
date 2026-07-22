import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/services.dart';
import 'leave_list_detail_screen.dart';

/// İK/Muhasebe/Admin/Yönetici: personel seç, sonra o kişinin izin geçmişine gir.
/// Ayrı bir "Personel İzin Bakiyeleri" ekranına gerek kalmasın diye bakiyeler
/// de (yalnızca HR/Admin için) burada gösteriliyor.
class LeaveListScreen extends StatefulWidget {
  const LeaveListScreen({super.key});

  @override
  State<LeaveListScreen> createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> {
  List<LeavePersonnelRow> _rows = [];
  List<LeaveBalanceRow> _balances = [];
  bool _loading = true;
  bool _downloadingPdf = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool get _canSeeBalances =>
      context.read<AuthProvider>().hasRole(['HR', 'ADMIN']);

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _rows = await LeaveListService.personnel();
      if (_canSeeBalances) _balances = await LeaveService.allBalances();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Yüklenemedi'))));
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _viewPdf(int year) async {
    setState(() => _downloadingPdf = true);
    try {
      await ApiClient.instance.openFileUrl(
        '/leave/balance/all/pdf?year=$year',
        fileName: 'izin-tablosu-$year.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(ApiClient.errorMessage(e, 'Açılamadı'))));
      }
    }
    if (mounted) setState(() => _downloadingPdf = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('İzin Listesi'),
        actions: [
          if (_canSeeBalances)
            _downloadingPdf
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    ),
                  )
                : PopupMenuButton<int>(
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    tooltip: 'PDF Görüntüle',
                    onSelected: _viewPdf,
                    itemBuilder: (context) {
                      final thisYear = DateTime.now().year;
                      return List.generate(
                        4,
                        (i) => PopupMenuItem(
                          value: thisYear - i,
                          child: Text('${thisYear - i} yılı'),
                        ),
                      );
                    },
                  ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _rows.isEmpty
                  ? ListView(children: const [
                      Padding(
                        padding: EdgeInsets.only(top: 80),
                        child: Center(
                            child: Text('Görüntülenecek personel yok',
                                style: TextStyle(color: Colors.grey))),
                      )
                    ])
                  : ListView.separated(
                      itemCount: _rows.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) => _row(_rows[i]),
                    ),
            ),
    );
  }

  Widget _row(LeavePersonnelRow r) {
    final balance = _balances.where((b) => b.personnelId == r.id).toList();
    return ListTile(
      title: Text(r.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text(
        [r.department, r.employeeNo].where((e) => e != null && e.isNotEmpty).join(' · '),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_canSeeBalances && balance.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('${formatDays(balance.first.remaining)} gün kaldı',
                  style: const TextStyle(color: Color(0xFF1D4ED8), fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          const Icon(Icons.chevron_right, color: Colors.grey),
        ],
      ),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LeaveListDetailScreen(personnel: r)),
      ),
    );
  }
}
