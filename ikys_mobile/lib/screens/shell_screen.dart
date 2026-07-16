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
  final String id;
  final String label;
  final IconData icon;
  final Widget screen;
  _Tab(this.id, this.label, this.icon, this.screen);
}

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  /// Bildirime tıklanınca push_service.dart buraya sekme id'si yazar
  /// ('leave', 'approvals' vb.); bu ekran açıkken dinleyip o sekmeye geçer.
  static final ValueNotifier<String?> requestedTab = ValueNotifier<String?>(null);

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _index = 0;
  int _unread = 0;
  Timer? _timer;
  List<_Tab> _tabs = [];

  @override
  void initState() {
    super.initState();
    _loadUnread();
    // Giriş yapılmış durumda token'ı kaydet (push bu cihaza gelsin)
    PushService.registerToken();
    // Okunmamış rozetini periyodik tazele (bildirim gösterimini FCM yapıyor)
    _timer = Timer.periodic(const Duration(seconds: 25), (_) => _loadUnread());
    ShellScreen.requestedTab.addListener(_onTabRequested);
    // Uygulama kapalıyken/bildirime tıklanarak açıldıysa, ilk build'den sonra iste.
    WidgetsBinding.instance.addPostFrameCallback((_) => _onTabRequested());
  }

  void _onTabRequested() {
    final id = ShellScreen.requestedTab.value;
    if (id == null) return;
    final idx = _tabs.indexWhere((t) => t.id == id);
    if (idx != -1 && mounted) setState(() => _index = idx);
    ShellScreen.requestedTab.value = null;
  }

  @override
  void dispose() {
    _timer?.cancel();
    ShellScreen.requestedTab.removeListener(_onTabRequested);
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
      _Tab('home', 'Ana Sayfa', Icons.home_outlined, const HomeScreen()),
      _Tab('attendance', 'Mesai', Icons.access_time, const AttendanceScreen()),
      _Tab('leave', 'İzin', Icons.event_note_outlined, const LeaveScreen()),
      if (auth.hasRole(['MANAGER', 'HR', 'ADMIN']))
        _Tab('approvals', 'Onaylar', Icons.checklist, const ApprovalsScreen()),
      if (auth.hasRole(['MANAGER', 'HR', 'ACCOUNTING', 'ADMIN']))
        _Tab('management', 'Yönetim', Icons.grid_view_outlined, const ManagementScreen()),
      _Tab('profile', 'Profil', Icons.person_outline, const ProfileScreen()),
    ];
    _tabs = tabs;

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
