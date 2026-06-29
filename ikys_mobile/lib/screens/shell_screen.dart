import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/services.dart';
import '../services/push_service.dart';
import 'home_screen.dart';
import 'attendance_screen.dart';
import 'leave_screen.dart';
import 'profile_screen.dart';
import 'notifications_screen.dart';
import 'approvals_screen.dart';
import 'management_screen.dart';

class _Tab {
  final String label;
  final IconData icon;
  final Widget screen;
  _Tab(this.label, this.icon, this.screen);
}

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _index = 0;
  int _unread = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _loadUnread();
    // Giriş yapılmış durumda token'ı kaydet (push bu cihaza gelsin)
    PushService.registerToken();
    // Okunmamış rozetini periyodik tazele (bildirim gösterimini FCM yapıyor)
    _timer = Timer.periodic(const Duration(seconds: 25), (_) => _loadUnread());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadUnread() async {
    try {
      final c = await NotificationService.unreadCount();
      if (mounted) setState(() => _unread = c);
    } catch (_) {}
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const NotificationsScreen()),
    );
    _loadUnread();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    // Role göre sekmeler (RN'deki role-based tabs karşılığı)
    final tabs = <_Tab>[
      _Tab('Ana Sayfa', Icons.home_outlined, const HomeScreen()),
      _Tab('Mesai', Icons.access_time, const AttendanceScreen()),
      _Tab('İzin', Icons.event_note_outlined, const LeaveScreen()),
      if (auth.hasRole(['MANAGER', 'HR', 'ADMIN']))
        _Tab('Onaylar', Icons.checklist, const ApprovalsScreen()),
      if (auth.hasRole(['MANAGER', 'HR', 'ACCOUNTING', 'ADMIN']))
        _Tab('Yönetim', Icons.grid_view_outlined, const ManagementScreen()),
      _Tab('Profil', Icons.person_outline, const ProfileScreen()),
    ];

    final safeIndex = _index < tabs.length ? _index : 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(tabs[safeIndex].label),
        actions: [
          IconButton(
            onPressed: _openNotifications,
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text(_unread > 99 ? '99+' : '$_unread'),
              child: const Icon(Icons.notifications_none),
            ),
            tooltip: 'Bildirimler',
          ),
        ],
      ),
      body: IndexedStack(
        index: safeIndex,
        children: tabs.map((t) => t.screen).toList(),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: tabs
            .map((t) => NavigationDestination(icon: Icon(t.icon), label: t.label))
            .toList(),
      ),
    );
  }
}
