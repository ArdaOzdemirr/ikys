import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';

class CategoriesAdminScreen extends StatefulWidget {
  const CategoriesAdminScreen({super.key});

  @override
  State<CategoriesAdminScreen> createState() => _CategoriesAdminScreenState();
}

class _CategoriesAdminScreenState extends State<CategoriesAdminScreen> {
  List<AdminCategory> _cats = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _cats = await CategoryAdminService.list();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Yüklenemedi'));
    }
    if (mounted) setState(() => _loading = false);
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  Future<void> _edit([AdminCategory? cat]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CategorySheet(cat: cat),
    );
    if (saved == true) _load();
  }

  Future<void> _delete(AdminCategory c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sil'),
        content: Text('${c.name} silinsin mi? (Talep bağlıysa pasifleştirilir)'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Vazgeç')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sil')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await CategoryAdminService.remove(c.id);
      _snack('Silindi/pasifleştirildi');
      _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e));
    }
  }

  Future<void> _visibility(AdminCategory c) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => _VisibilityScreen(cat: c)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('İzin Kategorileri')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(),
        icon: const Icon(Icons.add),
        label: const Text('Yeni'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: _cats.map(_card).toList(),
              ),
            ),
    );
  }

  Widget _card(AdminCategory c) {
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
                child: Text(c.name,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ),
              if (c.isSystem)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(999)),
                  child: const Text('sistem',
                      style: TextStyle(fontSize: 11, color: Colors.grey)),
                ),
            ],
          ),
          Text(c.code, style: const TextStyle(color: Colors.grey, fontSize: 12)),
          const SizedBox(height: 6),
          Wrap(spacing: 8, runSpacing: 4, children: [
            _chip(c.isPaid ? 'Ücretli' : 'Ücretsiz'),
            if (c.affectsAnnualBalance) _chip('Bakiyeden düşer'),
            _chip(c.defaultVisible ? 'Herkese açık' : 'Varsayılan gizli'),
            _chip(c.isActive ? 'Aktif' : 'Pasif'),
            if (c.accessCount > 0) _chip('${c.accessCount} istisna'),
          ]),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => _visibility(c),
                icon: const Icon(Icons.visibility_outlined, size: 18),
                label: const Text('Görünürlük'),
              ),
              TextButton.icon(
                onPressed: () => _edit(c),
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('Düzenle'),
              ),
              if (!c.isSystem)
                IconButton(
                  onPressed: () => _delete(c),
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chip(String t) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
            color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(999)),
        child: Text(t, style: const TextStyle(fontSize: 11, color: Color(0xFF4B5563))),
      );
}

class _CategorySheet extends StatefulWidget {
  final AdminCategory? cat;
  const _CategorySheet({this.cat});

  @override
  State<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends State<_CategorySheet> {
  late final TextEditingController _code;
  late final TextEditingController _name;
  late final TextEditingController _desc;
  late bool _isPaid;
  late bool _affects;
  late bool _defaultVisible;
  late bool _isActive;
  bool _saving = false;

  bool get isNew => widget.cat == null;

  @override
  void initState() {
    super.initState();
    final c = widget.cat;
    _code = TextEditingController(text: c?.code ?? '');
    _name = TextEditingController(text: c?.name ?? '');
    _desc = TextEditingController(text: c?.description ?? '');
    _isPaid = c?.isPaid ?? true;
    _affects = c?.affectsAnnualBalance ?? false;
    _defaultVisible = c?.defaultVisible ?? true;
    _isActive = c?.isActive ?? true;
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty || (isNew && _code.text.trim().isEmpty)) return;
    setState(() => _saving = true);
    try {
      if (isNew) {
        await CategoryAdminService.create(
          code: _code.text.trim(),
          name: _name.text.trim(),
          description: _desc.text.trim(),
          isPaid: _isPaid,
          affectsAnnualBalance: _affects,
          defaultVisible: _defaultVisible,
        );
      } else {
        await CategoryAdminService.update(widget.cat!.id, {
          'name': _name.text.trim(),
          'description': _desc.text.trim(),
          'isPaid': _isPaid,
          'affectsAnnualBalance': _affects,
          'defaultVisible': _defaultVisible,
          'isActive': _isActive,
        });
      }
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
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isNew ? 'Yeni Kategori' : 'Kategoriyi Düzenle',
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (isNew)
              TextField(
                controller: _code,
                decoration: const InputDecoration(
                    labelText: 'Kod (ör. DOGUM_GUNU)', border: OutlineInputBorder()),
              ),
            if (isNew) const SizedBox(height: 8),
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Ad', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _desc,
              decoration:
                  const InputDecoration(labelText: 'Açıklama', border: OutlineInputBorder()),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Ücretli izin'),
              value: _isPaid,
              onChanged: (v) => setState(() => _isPaid = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Yıllık bakiyeden düşer'),
              value: _affects,
              onChanged: (v) => setState(() => _affects = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Varsayılan herkese açık'),
              value: _defaultVisible,
              onChanged: (v) => setState(() => _defaultVisible = v),
            ),
            if (!isNew)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Aktif'),
                value: _isActive,
                onChanged: (v) => setState(() => _isActive = v),
              ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Kaydediliyor...' : 'Kaydet'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VisibilityScreen extends StatefulWidget {
  final AdminCategory cat;
  const _VisibilityScreen({required this.cat});

  @override
  State<_VisibilityScreen> createState() => _VisibilityScreenState();
}

class _VisibilityScreenState extends State<_VisibilityScreen> {
  List<SimplePersonnel> _people = [];
  Map<String, bool> _overrides = {};
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        PersonnelService.list(),
        CategoryAdminService.visibility(widget.cat.id),
      ]);
      _people = results[0] as List<SimplePersonnel>;
      final ov = results[1] as List<CategoryVisibility>;
      _overrides = {for (final o in ov) o.personnelId: o.visible};
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Yüklenemedi'));
    }
    if (mounted) setState(() => _loading = false);
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  Future<void> _set(String personnelId, bool visible) async {
    try {
      await CategoryAdminService.setVisibility(widget.cat.id, personnelId, visible);
      setState(() => _overrides[personnelId] = visible);
    } catch (e) {
      _snack(ApiClient.errorMessage(e));
    }
  }

  Future<void> _clear(String personnelId) async {
    try {
      await CategoryAdminService.clearVisibility(widget.cat.id, personnelId);
      setState(() => _overrides.remove(personnelId));
    } catch (e) {
      _snack(ApiClient.errorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = _people.where((p) {
      final s = '${p.fullName} ${p.employeeNo}'.toLowerCase();
      return s.contains(_search.toLowerCase());
    }).toList();

    return Scaffold(
      appBar: AppBar(title: Text('${widget.cat.name} · Görünürlük')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'Personel ara...',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (v) => setState(() => _search = v),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                        'Varsayılan: ${widget.cat.defaultVisible ? "açık" : "gizli"}',
                        style: const TextStyle(color: Colors.grey, fontSize: 12)),
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final p = list[i];
                      final ov = _overrides[p.id]; // null = varsayılan
                      final effective = ov ?? widget.cat.defaultVisible;
                      return ListTile(
                        title: Text(p.fullName),
                        subtitle: Text(
                            '${p.employeeNo}${ov == null ? " · varsayılan" : " · istisna"}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              tooltip: 'Açık',
                              icon: Icon(Icons.check_circle,
                                  color: effective ? Colors.green : Colors.grey.shade400),
                              onPressed: () => _set(p.id, true),
                            ),
                            IconButton(
                              tooltip: 'Gizli',
                              icon: Icon(Icons.cancel,
                                  color: !effective ? Colors.red : Colors.grey.shade400),
                              onPressed: () => _set(p.id, false),
                            ),
                            if (ov != null)
                              IconButton(
                                tooltip: 'İstisnayı kaldır',
                                icon: const Icon(Icons.restart_alt, color: Colors.grey),
                                onPressed: () => _clear(p.id),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}
