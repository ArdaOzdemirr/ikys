import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import '../services/services.dart';
import 'leave_screen.dart';
import 'notifications_screen.dart';
import 'approvals_screen.dart';
import 'expenses_screen.dart';
import 'payroll_screen.dart';

const _roleLabels = {
  'EMPLOYEE': 'Personel',
  'MANAGER': 'Yönetici',
  'HR': 'İK Yetkilisi',
  'ACCOUNTING': 'Muhasebe',
  'ADMIN': 'Sistem Yöneticisi',
};

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  MyProfile? _profile;
  Attendance? _today;
  LeaveBalance? _annual;
  int _unread = 0;
  int _pending = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final isManager =
        context.read<AuthProvider>().hasRole(['MANAGER', 'HR', 'ADMIN']);

    try {
      _profile = await ProfileService.me();
    } catch (_) {}
    try {
      final att = await AttendanceService.me(today, today);
      _today = att.isNotEmpty ? att.first : null;
    } catch (_) {}
    try {
      final balances = await LeaveService.myBalance();
      _annual = balances.where((b) => b.type == 'ANNUAL').isNotEmpty
          ? balances.firstWhere((b) => b.type == 'ANNUAL')
          : (balances.isNotEmpty ? balances.first : null);
    } catch (_) {}
    try {
      _unread = await NotificationService.unreadCount();
    } catch (_) {}
    if (isManager) {
      try {
        _pending = (await ApprovalService.pending()).length;
      } catch (_) {}
    }
    if (mounted) setState(() => _loading = false);
  }

  void _go(Widget screen) {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => screen))
        .then((_) => _load());
  }

  /// Tab gövdesi (kendi Scaffold'u olmayan) ekranları başlıklı Scaffold içinde açar.
  void _openTab(String title, Widget body) {
    _go(Scaffold(appBar: AppBar(title: Text(title)), body: body));
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final isManager =
        context.read<AuthProvider>().hasRole(['MANAGER', 'HR', 'ADMIN']);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Hoş geldin 👋',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
              (_profile?.fullName.trim().isNotEmpty ?? false)
                  ? _profile!.fullName
                  : (user?.email ?? ''),
              style: const TextStyle(color: Colors.grey, fontSize: 15)),
          const SizedBox(height: 10),
          Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFDBEAFE),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(_roleLabels[user?.role] ?? user?.role ?? '',
                style: const TextStyle(
                    color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: 20),

          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            Row(
              children: [
                Expanded(child: _statCard(
                  'Bugün Mesai',
                  _today?.checkIn == null
                      ? 'Giriş yok'
                      : 'Giriş ${DateFormat('HH:mm').format(_today!.checkIn!)}'
                          '${_today?.checkOut != null ? '\nÇıkış ${DateFormat('HH:mm').format(_today!.checkOut!)}' : ''}',
                  Icons.access_time,
                  const Color(0xFF2563EB),
                )),
                const SizedBox(width: 12),
                Expanded(child: _statCard(
                  'Yıllık İzin',
                  _annual != null
                      ? '${formatDays(_annual!.remainingDays)} gün kaldı'
                      : '-',
                  Icons.beach_access,
                  const Color(0xFF16A34A),
                )),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _statCard(
                  'Okunmamış Bildirim',
                  '$_unread',
                  Icons.notifications,
                  const Color(0xFFD97706),
                )),
                const SizedBox(width: 12),
                Expanded(child: isManager
                    ? _statCard('Bekleyen Onay', '$_pending', Icons.checklist,
                        const Color(0xFF7C3AED))
                    : const SizedBox()),
              ],
            ),
          ],

          const SizedBox(height: 24),
          const Text('Hızlı İşlemler',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _action(Icons.event_note, 'İzin Talebi / İzinlerim',
              () => _openTab('İzinlerim', const LeaveScreen())),
          _action(Icons.receipt_long, 'Masraflarım',
              () => _go(const ExpensesScreen())),
          _action(Icons.payments_outlined, 'Bordrom',
              () => _go(const PayrollScreen())),
          _action(Icons.send, 'Mesaj Gönder',
              () => _go(const ComposeMessageScreen())),
          _action(Icons.notifications_none, 'Bildirimler',
              () => _go(const NotificationsScreen())),
          if (isManager)
            _action(Icons.checklist, 'İzin Onayları',
                () => _openTab('İzin Onayları', const ApprovalsScreen())),
        ],
      ),
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    if (label.isEmpty) return const SizedBox();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        ],
      ),
    );
  }

  Widget _action(IconData icon, String label, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFF3F4F6)),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFEFF6FF),
          child: Icon(icon, color: const Color(0xFF2563EB)),
        ),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
