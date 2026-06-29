import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'leave_list_screen.dart';
import 'categories_admin_screen.dart';

/// Yönetim merkezi: role göre İzin Listesi ve İzin Kategorileri'ne erişim.
class ManagementScreen extends StatelessWidget {
  const ManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final canCategories = auth.hasRole(['HR', 'ADMIN']);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _tile(
          context,
          icon: Icons.list_alt,
          title: 'İzin Listesi',
          subtitle: 'Alınan/bekleyen izinler (yetkinize göre filtreli)',
          screen: const LeaveListScreen(),
        ),
        if (canCategories)
          _tile(
            context,
            icon: Icons.category_outlined,
            title: 'İzin Kategorileri',
            subtitle: 'Kategori aç/düzenle, kişiye özel gizle',
            screen: const CategoriesAdminScreen(),
          ),
      ],
    );
  }

  Widget _tile(BuildContext context,
      {required IconData icon,
      required String title,
      required String subtitle,
      required Widget screen}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFEFF6FF),
          child: Icon(icon, color: const Color(0xFF2563EB)),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => screen)),
      ),
    );
  }
}
