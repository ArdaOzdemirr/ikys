import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';
import 'leave_list_detail_screen.dart';

/// İK/Muhasebe/Admin/Yönetici: personel seç, sonra o kişinin izin geçmişine gir.
class LeaveListScreen extends StatefulWidget {
  const LeaveListScreen({super.key});

  @override
  State<LeaveListScreen> createState() => _LeaveListScreenState();
}

class _LeaveListScreenState extends State<LeaveListScreen> {
  List<LeavePersonnelRow> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _rows = await LeaveListService.personnel();
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
    return ListTile(
      title: Text(r.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text(
        [r.department, r.employeeNo].where((e) => e != null && e.isNotEmpty).join(' · '),
      ),
      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LeaveListDetailScreen(personnel: r)),
      ),
    );
  }
}
