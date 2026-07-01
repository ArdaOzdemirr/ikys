import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';

const _typeStyle = {
  'LEAVE_APPROVAL_PENDING': (
    icon: Icons.schedule,
    color: Color(0xFFB45309),
    bg: Color(0xFFFEF3C7)
  ),
  'LEAVE_APPROVED': (
    icon: Icons.event_available,
    color: Color(0xFF166534),
    bg: Color(0xFFDCFCE7)
  ),
  'LEAVE_REJECTED': (
    icon: Icons.event_busy,
    color: Color(0xFF991B1B),
    bg: Color(0xFFFEE2E2)
  ),
  'MESSAGE': (
    icon: Icons.chat_bubble_outline,
    color: Color(0xFF1D4ED8),
    bg: Color(0xFFEFF6FF)
  ),
};

String _timeAgo(DateTime d) {
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return 'az önce';
  if (diff.inMinutes < 60) return '${diff.inMinutes} dk önce';
  if (diff.inHours < 24) return '${diff.inHours} saat önce';
  if (diff.inDays < 7) return '${diff.inDays} gün önce';
  return DateFormat('dd MMM yyyy').format(d);
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await NotificationService.list();
    } catch (e) {
      if (mounted) _snack(ApiClient.errorMessage(e, 'Yüklenemedi'));
    }
    if (mounted) setState(() => _loading = false);
  }

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _markRead(NotificationItem n) async {
    if (n.isRead) return;
    try {
      await NotificationService.markRead(n.id);
      await _load();
    } catch (_) {}
  }

  Future<void> _markAll() async {
    try {
      await NotificationService.markAllRead();
      _snack('Tümü okundu işaretlendi');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e));
    }
  }

  Future<void> _delete(NotificationItem n) async {
    try {
      await NotificationService.delete(n.id);
      setState(() => _items.removeWhere((x) => x.id == n.id));
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Silinemedi'));
    }
  }

  Future<void> _reply(NotificationItem n) async {
    if (n.senderId == null) return;
    final sent = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ComposeMessageScreen(
          replyToId: n.senderId,
          replyToName: n.senderName,
          replyToNotificationId: n.id,
        ),
      ),
    );
    if (sent == true) _load();
  }

  Future<void> _compose() async {
    final sent = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ComposeMessageScreen()),
    );
    if (sent == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final unread = _items.where((n) => !n.isRead).length;

    return Scaffold(
      appBar: AppBar(title: const Text('Bildirimler')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        unread > 0 ? '$unread okunmamış' : 'Tümü okundu',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      if (unread > 0)
                        TextButton.icon(
                          onPressed: _markAll,
                          icon: const Icon(Icons.done_all, size: 18),
                          label: const Text('Tümünü okundu yap'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (_items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 48),
                      child: Center(
                        child: Text('Henüz bildiriminiz yok',
                            style: TextStyle(color: Colors.grey)),
                      ),
                    )
                  else
                    ..._items.map(_card),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _compose,
        icon: const Icon(Icons.send),
        label: const Text('Mesaj'),
      ),
    );
  }

  Widget _card(NotificationItem n) {
    final st = _typeStyle[n.type] ?? _typeStyle['MESSAGE']!;
    final urgent = n.priority == 'URGENT';
    final important = n.priority == 'IMPORTANT';
    final bg = urgent
        ? const Color(0xFFFEF2F2)
        : important
            ? const Color(0xFFFFFBEB)
            : (n.isRead ? Colors.white : const Color(0xFFF5F9FF));
    final border = urgent
        ? const Color(0xFFF87171)
        : important
            ? const Color(0xFFFBBF24)
            : (n.isRead ? const Color(0xFFF3F4F6) : const Color(0xFFBFDBFE));
    return InkWell(
      onTap: () => _markRead(n),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: border, width: urgent ? 1.5 : 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(color: st.bg, shape: BoxShape.circle),
              child: Icon(st.icon, color: st.color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (urgent || important)
                    Container(
                      margin: const EdgeInsets.only(bottom: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: urgent ? const Color(0xFFDC2626) : const Color(0xFFD97706),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(urgent ? 'ÇOK ÖNEMLİ' : 'ÖNEMLİ',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold)),
                    ),
                  Row(
                    children: [
                      Expanded(
                        child: Text(n.title,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14)),
                      ),
                      Text(_timeAgo(n.createdAt),
                          style: const TextStyle(
                              color: Colors.grey, fontSize: 11)),
                    ],
                  ),
                  if (n.body != null) ...[
                    const SizedBox(height: 2),
                    Text(n.body!,
                        style: const TextStyle(
                            color: Color(0xFF4B5563), fontSize: 13)),
                  ],
                  if (n.senderName != null) ...[
                    const SizedBox(height: 4),
                    Text('Gönderen: ${n.senderName}',
                        style: const TextStyle(
                            color: Colors.grey, fontSize: 11)),
                  ],
                ],
              ),
            ),
            Column(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                if (!n.isRead)
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                        color: Color(0xFF2563EB), shape: BoxShape.circle),
                  ),
                if (n.type == 'MESSAGE' && n.senderId != null)
                  InkWell(
                    onTap: () => _reply(n),
                    child: const Padding(
                      padding: EdgeInsets.all(2),
                      child: Icon(Icons.reply, size: 18, color: Colors.grey),
                    ),
                  ),
                InkWell(
                  onTap: () => _delete(n),
                  child: const Padding(
                    padding: EdgeInsets.all(2),
                    child: Icon(Icons.delete_outline, size: 18, color: Colors.grey),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Kendi seviyesi / bir alt seviyesindeki kişilere serbest mesaj.
/// replyTo verilirse (size mesaj atan bir üst amire yanıt), o kişi zorunlu alıcı olur.
class ComposeMessageScreen extends StatefulWidget {
  final String? replyToId;
  final String? replyToName;
  final String? replyToNotificationId;
  const ComposeMessageScreen({
    super.key,
    this.replyToId,
    this.replyToName,
    this.replyToNotificationId,
  });

  @override
  State<ComposeMessageScreen> createState() => _ComposeMessageScreenState();
}

class _ComposeMessageScreenState extends State<ComposeMessageScreen> {
  List<MessageRecipient> _recipients = [];
  final Set<String> _selected = {};
  final _title = TextEditingController();
  final _body = TextEditingController();
  final _search = TextEditingController();
  bool _loading = true;
  bool _sending = false;
  bool _broadcast = false;
  String _priority = 'NORMAL';

  @override
  void initState() {
    super.initState();
    if (widget.replyToId != null) _selected.add(widget.replyToId!);
    _load();
  }

  Future<void> _load() async {
    try {
      _recipients = await NotificationService.recipients();
    } catch (e) {
      if (mounted) _snack(ApiClient.errorMessage(e, 'Yüklenemedi'));
    }
    if (mounted) setState(() => _loading = false);
  }

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _send() async {
    if (_title.text.trim().isEmpty) return;
    if (!_broadcast && widget.replyToNotificationId == null && _selected.isEmpty) return;
    setState(() => _sending = true);
    try {
      final int n;
      if (_broadcast) {
        n = await NotificationService.broadcast(
            _title.text.trim(), _body.text.trim(), priority: _priority);
      } else if (widget.replyToNotificationId != null) {
        n = await NotificationService.reply(
          notificationId: widget.replyToNotificationId!,
          title: _title.text.trim(),
          body: _body.text.trim(),
          priority: _priority,
        );
      } else {
        n = await NotificationService.sendMessage(
          recipientIds: _selected.toList(),
          title: _title.text.trim(),
          body: _body.text.trim(),
          priority: _priority,
        );
      }
      _snack('$n kişiye gönderildi');
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'Gönderilemedi'));
      setState(() => _sending = false);
    }
  }

  String _sub(MessageRecipient p) {
    final s = [p.position, p.department]
        .where((e) => e != null && e.isNotEmpty)
        .join(' · ');
    return s.isEmpty ? '-' : s;
  }

  @override
  Widget build(BuildContext context) {
    final q = _search.text.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _recipients
        : _recipients
            .where((r) => '${r.fullName} ${r.position ?? ''} ${r.department ?? ''}'
                .toLowerCase()
                .contains(q))
            .toList();
    final canSend = _title.text.trim().isNotEmpty &&
        (_broadcast || widget.replyToNotificationId != null || _selected.isNotEmpty);

    return Scaffold(
      appBar: AppBar(title: const Text('Mesaj Gönder')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SwitchListTile(
                    value: _broadcast,
                    onChanged: (v) => setState(() => _broadcast = v),
                    title: const Text('Herkese gönder (toplu duyuru)',
                        style: TextStyle(
                            color: Color(0xFF1D4ED8),
                            fontWeight: FontWeight.w600)),
                    subtitle: const Text('Tüm personele bildirim'),
                  ),
                ),
                if (widget.replyToName != null && !_broadcast)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.reply, size: 16, color: Color(0xFF1D4ED8)),
                        const SizedBox(width: 8),
                        Text('Yanıt: ${widget.replyToName}',
                            style: const TextStyle(
                                color: Color(0xFF1D4ED8),
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                if (!_broadcast && widget.replyToNotificationId == null) ...[
                  const Text(
                    'İstediğiniz herhangi bir çalışana mesaj gönderebilirsiniz.',
                    style: TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Text('Alıcılar (${_selected.length} seçili)',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _search,
                    decoration: const InputDecoration(
                      hintText: 'Ad, departman veya pozisyona göre ara...',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 8),
                  if (_recipients.isEmpty && widget.replyToId == null)
                    const Text('Kişi bulunamadı.',
                        style: TextStyle(color: Colors.grey))
                  else
                    ...filtered.map((p) => CheckboxListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          value: _selected.contains(p.id),
                          onChanged: (v) => setState(() {
                            v == true ? _selected.add(p.id) : _selected.remove(p.id);
                          }),
                          title: Text(p.fullName),
                          subtitle: Text(_sub(p)),
                        )),
                ],
                const SizedBox(height: 16),
                TextField(
                  controller: _title,
                  maxLength: 150,
                  decoration: const InputDecoration(
                    labelText: 'Başlık',
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _body,
                  maxLength: 2000,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    labelText: 'Mesaj',
                    alignLabelWithHint: true,
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                const Text('Önem', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  children: [
                    _priorityChip('NORMAL', 'Normal', Colors.grey),
                    _priorityChip('IMPORTANT', 'Önemli', const Color(0xFFD97706)),
                    _priorityChip('URGENT', 'Çok Önemli', const Color(0xFFDC2626)),
                  ],
                ),
                if (_priority == 'URGENT')
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text(
                      'Alıcının telefonunda farklı sesle, kırmızı heads-up bildirim olarak düşer.',
                      style: TextStyle(color: Color(0xFFDC2626), fontSize: 12),
                    ),
                  ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: (!canSend || _sending) ? null : _send,
                    icon: const Icon(Icons.send),
                    label: Text(_sending ? 'Gönderiliyor...' : 'Gönder'),
                    style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14)),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _priorityChip(String val, String label, Color color) {
    final sel = _priority == val;
    return ChoiceChip(
      label: Text(label),
      selected: sel,
      selectedColor: color.withOpacity(0.15),
      labelStyle: TextStyle(
          color: sel ? color : Colors.grey[700],
          fontWeight: sel ? FontWeight.bold : FontWeight.normal),
      onSelected: (_) => setState(() => _priority = val),
    );
  }

}
