import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import '../providers/auth_provider.dart';
import '../models/models.dart';
import '../services/services.dart';
import '../services/push_service.dart';
import '../services/api_client.dart';
import 'payroll_screen.dart';

const _roleLabel = {
  'EMPLOYEE': 'Çalışan',
  'MANAGER': 'Yönetici',
  'HR': 'İnsan Kaynakları',
  'ACCOUNTING': 'Muhasebe',
  'ADMIN': 'Yönetici (Admin)',
};

const _documentTypes = {
  'diploma': 'Diploma',
  'kimlik': 'Kimlik',
  'ikametgah': 'İkametgah',
  'sozlesme': 'İş Sözleşmesi',
  'sgk': 'SGK Belgesi',
  'saglik_raporu': 'Sağlık Raporu',
  'cv': 'CV',
  'fotograf': 'Vesikalık',
  'diger': 'Diğer',
};

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  MyProfile? _profile;
  List<LeaveBalance> _balances = [];
  List<PersonnelDocument> _documents = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _profile = await ProfileService.me();
    } catch (_) {}
    try {
      _balances = await LeaveService.myBalance();
    } catch (_) {}
    if (_profile != null) {
      try {
        _documents = await DocumentService.list(_profile!.id);
      } catch (_) {}
    }
    if (mounted) setState(() => _loading = false);
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  Future<void> _editContact() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ContactSheet(profile: _profile),
    );
    if (saved == true) {
      _snack('Bilgiler güncellendi');
      _load();
    }
  }

  Future<void> _uploadDocument() async {
    if (_profile == null) return;
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'],
    );
    if (result == null || result.files.isEmpty || result.files.first.path == null) return;
    final picked = result.files.first;

    if (!mounted) return;
    String type = 'diploma';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setSt) => AlertDialog(
          title: const Text('Belge Türü'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(picked.name, style: const TextStyle(color: Colors.grey, fontSize: 13)),
              const SizedBox(height: 12),
              DropdownButton<String>(
                value: type,
                isExpanded: true,
                items: _documentTypes.entries
                    .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged: (v) => setSt(() => type = v ?? type),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Vazgeç')),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Yükle')),
          ],
        ),
      ),
    );
    if (confirmed != true) return;

    try {
      await DocumentService.upload(
        personnelId: _profile!.id,
        filePath: picked.path!,
        fileName: picked.name,
        type: type,
      );
      _snack('Belge yüklendi');
      _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Belge yüklenemedi'));
    }
  }

  Future<void> _deleteDocument(PersonnelDocument d) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Belgeyi Sil'),
        content: Text('"${d.fileName}" belgesini silmek istediğinize emin misiniz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Sil')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await DocumentService.remove(d.id);
      _snack('Belge silindi');
      _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Silinemedi'));
    }
  }

  Future<void> _changePassword() async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _PasswordSheet(),
    );
    if (ok == true) _snack('Şifre değiştirildi');
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final name = _profile?.fullName.trim();
    final initials = ((name != null && name.isNotEmpty)
            ? name
            : (user?.email ?? '?'))
        .substring(0, 1)
        .toUpperCase();
    final role = _profile?.role ?? user?.role;
    final canManageDocs = auth.hasRole(['HR', 'ADMIN']);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: const Color(0xFFEFF6FF),
                  child: Text(initials,
                      style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF2563EB))),
                ),
                const SizedBox(height: 12),
                Text(
                    (name != null && name.isNotEmpty) ? name : (user?.email ?? ''),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(999)),
                  child: Text(_roleLabel[role] ?? role ?? '',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563))),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            _section('İş Bilgileri'),
            _row('Sicil No', _profile?.employeeNo ?? '-'),
            _row('Departman', _profile?.department ?? '-'),
            _row('Pozisyon', _profile?.position ?? '-'),
            if (_profile?.managerName != null)
              _row('Yönetici', _profile!.managerName!),
            if (_profile?.hireDate != null)
              _row('İşe Giriş',
                  DateFormat('dd.MM.yyyy').format(_profile!.hireDate!)),

            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _section('İletişim'),
                TextButton.icon(
                  onPressed: _editContact,
                  icon: const Icon(Icons.edit, size: 16),
                  label: const Text('Düzenle'),
                ),
              ],
            ),
            _row('E-posta', _profile?.email ?? user?.email ?? '-'),
            _row('Telefon', _profile?.phone ?? '-'),
            _row('Adres', _profile?.address ?? '-'),
            _row('Acil Durum', _profile?.emergencyContact ?? '-'),

            const SizedBox(height: 20),
            _section('İzin Bakiyem'),
            if (_balances.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Tanımlı izin bakiyesi yok.',
                    style: TextStyle(color: Colors.grey)),
              )
            else
              ..._balances.map(_balanceCard),

            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _section('Belgelerim'),
                Row(
                  children: [
                    if (canManageDocs)
                      TextButton.icon(
                        onPressed: _uploadDocument,
                        icon: const Icon(Icons.upload_file_outlined, size: 16),
                        label: const Text('Ekle'),
                      ),
                    TextButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const PayrollScreen()),
                      ),
                      icon: const Icon(Icons.receipt_long_outlined, size: 16),
                      label: const Text('Bordrolarım'),
                    ),
                  ],
                ),
              ],
            ),
            if (_documents.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Henüz belge yüklenmemiş.', style: TextStyle(color: Colors.grey)),
              )
            else
              ..._documents.map((d) => _documentRow(d, canManageDocs)),
          ],

          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: _changePassword,
            icon: const Icon(Icons.lock_outline),
            label: const Text('Şifre Değiştir'),
            style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14)),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: () => _confirmLogout(context, auth),
            icon: const Icon(Icons.logout),
            label: const Text('Çıkış Yap', style: TextStyle(fontWeight: FontWeight.bold)),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFEE2E2),
              foregroundColor: const Color(0xFFDC2626),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 12),
          const Center(
            child: Text('İKYS Mobil', style: TextStyle(color: Colors.grey, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Widget _section(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(t,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      );

  Widget _documentRow(PersonnelDocument d, bool canManage) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF3F4F6))),
      ),
      child: Row(
        children: [
          const Icon(Icons.description_outlined, size: 18, color: Color(0xFF2563EB)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(d.fileName, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
          IconButton(
            icon: const Icon(Icons.open_in_new, size: 18),
            tooltip: 'Görüntüle',
            onPressed: () => ApiClient.instance.openFileUrl(d.fileUrl, fileName: d.fileName),
          ),
          if (canManage)
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
              tooltip: 'Sil',
              onPressed: () => _deleteDocument(d),
            ),
        ],
      ),
    );
  }

  Widget _balanceCard(LeaveBalance b) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${b.type} · ${b.year}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(
                  'Kullanılan: ${formatDays(b.usedDays)} / ${formatDays(b.totalDays)} gün',
                  style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatDays(b.remainingDays),
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: b.remainingDays < 0
                          ? const Color(0xFFDC2626)
                          : const Color(0xFF16A34A))),
              const Text('kalan', style: TextStyle(color: Colors.grey, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String k, String v) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF3F4F6))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: const TextStyle(color: Colors.grey, fontSize: 15)),
          Flexible(
            child: Text(v,
                textAlign: TextAlign.right,
                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15)),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, AuthProvider auth) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Çıkış'),
        content: const Text('Oturumu kapatmak istiyor musun?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Vazgeç')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Çıkış Yap')),
        ],
      ),
    );
    if (ok == true) {
      await PushService.unregisterToken();
      auth.logout();
    }
  }
}

class _ContactSheet extends StatefulWidget {
  final MyProfile? profile;
  const _ContactSheet({this.profile});

  @override
  State<_ContactSheet> createState() => _ContactSheetState();
}

class _ContactSheetState extends State<_ContactSheet> {
  late final TextEditingController _phone;
  late final TextEditingController _address;
  late final TextEditingController _emergency;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _phone = TextEditingController(text: widget.profile?.phone ?? '');
    _address = TextEditingController(text: widget.profile?.address ?? '');
    _emergency = TextEditingController(text: widget.profile?.emergencyContact ?? '');
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ProfileService.updateContact(
        phone: _phone.text.trim(),
        address: _address.text.trim(),
        emergencyContact: _emergency.text.trim(),
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
          const Text('İletişim Bilgileri',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Telefon', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _address,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Adres', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _emergency,
            decoration: const InputDecoration(
                labelText: 'Acil durum kişisi', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Kaydediliyor...' : 'Kaydet'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordSheet extends StatefulWidget {
  const _PasswordSheet();

  @override
  State<_PasswordSheet> createState() => _PasswordSheetState();
}

class _PasswordSheetState extends State<_PasswordSheet> {
  final _old = TextEditingController();
  final _new = TextEditingController();
  final _new2 = TextEditingController();
  bool _saving = false;

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  Future<void> _save() async {
    if (_new.text.length < 6) {
      _snack('Yeni şifre en az 6 karakter olmalı');
      return;
    }
    if (_new.text != _new2.text) {
      _snack('Yeni şifreler eşleşmiyor');
      return;
    }
    setState(() => _saving = true);
    try {
      await ProfileService.changePassword(_old.text, _new.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Şifre değiştirilemedi'));
      setState(() => _saving = false);
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
          const Text('Şifre Değiştir',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(
            controller: _old,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Mevcut şifre', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _new,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Yeni şifre', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _new2,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Yeni şifre (tekrar)', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Kaydediliyor...' : 'Değiştir'),
            ),
          ),
        ],
      ),
    );
  }
}
