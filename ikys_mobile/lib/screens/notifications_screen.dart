import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../services/services.dart';
import '../services/push_service.dart';

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

  /// Listedeki bir bildirime dokununca: okundu işaretle, mesaj değilse
  /// (zaten bu ekrandayız) ilgili sayfaya/sekmeye git.
  Future<void> _open(NotificationItem n) async {
    await _markRead(n);
    if (n.type != 'MESSAGE') {
      PushService.routeForType(n.type);
    }
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
      onTap: () => _open(n),
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

/// Seçili kişiyle aramızdaki eski mesajlar — normal bir sohbet alanı gibi.
class _MessageThread extends StatefulWidget {
  final String otherId;
  final bool expand;
  const _MessageThread({super.key, required this.otherId, this.expand = false});

  @override
  State<_MessageThread> createState() => _MessageThreadState();
}

class _MessageThreadState extends State<_MessageThread> {
  List<ThreadMessage>? _messages;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _MessageThread old) {
    super.didUpdateWidget(old);
    if (old.otherId != widget.otherId) {
      _messages = null;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final msgs = await NotificationService.thread(widget.otherId);
      if (mounted) setState(() => _messages = msgs);
    } catch (_) {
      if (mounted) setState(() => _messages = []);
    }
  }

  Widget _list(BuildContext context, List<ThreadMessage> messages) {
    return ListView.builder(
      shrinkWrap: !widget.expand,
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
      itemCount: messages.length,
      itemBuilder: (_, i) {
        final m = messages[i];
        final fromMe = m.senderId != widget.otherId;
        return Align(
          alignment: fromMe ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
            decoration: BoxDecoration(
              color: fromMe ? const Color(0xFFDBEAFE) : Colors.white,
              border: fromMe ? null : Border.all(color: const Color(0xFFE5E7EB)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(m.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                if (m.body != null && m.body!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(m.body!, style: const TextStyle(fontSize: 13)),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(_timeAgo(m.createdAt),
                      style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final messages = _messages;
    final body = messages == null
        ? const Center(child: Text('Yükleniyor...', style: TextStyle(color: Colors.grey)))
        : messages.isEmpty
            ? const Center(child: Text('Bu kişiyle henüz mesajlaşma yok.', style: TextStyle(color: Colors.grey)))
            : _list(context, messages);

    if (widget.expand) {
      return Container(color: const Color(0xFFF9FAFB), child: body);
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      constraints: const BoxConstraints(maxHeight: 260),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(10, 8, 10, 4),
            child: Text('Önceki Mesajlar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          ),
          Flexible(child: body),
        ],
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
  final _chatTitle = TextEditingController();
  final _chatText = TextEditingController();
  final _search = TextEditingController();
  bool _loading = true;
  bool _sending = false;
  bool _broadcast = false;
  String _priority = 'NORMAL';
  int _threadRefreshKey = 0;

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

  // Gönderim seçenekleri (alıcı/duyuru/önem) aynı kalıyor; tek bir alıcıyla
  // (ya da yanıt modunda) normal bir sohbet alanı gibi eski mesajlar + mesaj
  // kutusu gösteriliyor. Birden fazla alıcı / toplu duyuruda eski form kalıyor.
  String? get _threadOtherId {
    if (_broadcast) return null;
    if (widget.replyToId != null) return widget.replyToId;
    return _selected.length == 1 ? _selected.first : null;
  }

  bool get _chatMode => _threadOtherId != null;

  Future<void> _send() async {
    final title = _chatMode ? _chatTitle.text.trim() : _title.text.trim();
    final body = _chatMode ? _chatText.text.trim() : _body.text.trim();
    if (title.isEmpty) return;
    if (!_broadcast && widget.replyToNotificationId == null && _selected.isEmpty) return;
    setState(() => _sending = true);
    try {
      final int n;
      if (_broadcast) {
        n = await NotificationService.broadcast(title, body, priority: _priority);
      } else if (widget.replyToNotificationId != null) {
        n = await NotificationService.reply(
          notificationId: widget.replyToNotificationId!,
          title: title,
          body: body,
          priority: _priority,
        );
      } else {
        n = await NotificationService.sendMessage(
          recipientIds: _selected.toList(),
          title: title,
          body: body,
          priority: _priority,
        );
      }
      if (_chatMode) {
        // Sohbet modunda ekrandan çıkmadan devam edilebilsin.
        _chatText.clear();
        _chatTitle.clear();
        setState(() {
          _sending = false;
          _threadRefreshKey++;
        });
      } else {
        _snack('$n kişiye gönderildi');
        if (mounted) Navigator.pop(context, true);
      }
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

  Widget _priorityRow({bool compact = false}) {
    return Wrap(
      spacing: 8,
      children: [
        _priorityChip('NORMAL', 'Normal', Colors.grey),
        _priorityChip('IMPORTANT', 'Önemli', const Color(0xFFD97706)),
        _priorityChip('URGENT', 'Çok Önemli', const Color(0xFFDC2626)),
      ],
    );
  }

  Widget _chatBody() {
    final other = _recipients.where((r) => r.id == _threadOtherId).toList();
    final headerName = widget.replyToName ?? (other.isNotEmpty ? other.first.fullName : '...');
    final canSend = _chatTitle.text.trim().isNotEmpty && _chatText.text.trim().isNotEmpty;
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB))),
          ),
          child: Row(
            children: [
              if (widget.replyToId != null) ...[
                const Icon(Icons.reply, size: 16, color: Color(0xFF1D4ED8)),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(headerName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ),
              if (widget.replyToId == null)
                TextButton(
                  onPressed: () => setState(() => _selected.clear()),
                  child: const Text('Değiştir'),
                ),
            ],
          ),
        ),
        Expanded(
          child: _MessageThread(
            key: ValueKey('${_threadOtherId!}-$_threadRefreshKey'),
            otherId: _threadOtherId!,
            expand: true,
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: _chatTitle,
                  maxLength: 150,
                  buildCounter: (context, {required currentLength, required isFocused, maxLength}) => null,
                  decoration: const InputDecoration(
                    hintText: 'Başlık',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 8),
                _priorityRow(compact: true),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _chatText,
                        maxLength: 2000,
                        maxLines: 4,
                        minLines: 1,
                        buildCounter: (context, {required currentLength, required isFocused, maxLength}) => null,
                        decoration: const InputDecoration(
                          hintText: 'Mesajınızı yazın...',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: (!canSend || _sending) ? null : _send,
                      icon: _sending
                          ? const SizedBox(
                              width: 18, height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.send),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _formBody(bool canBroadcast) {
    final q = _search.text.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _recipients
        : _recipients
            .where((r) => '${r.fullName} ${r.position ?? ''} ${r.department ?? ''}'
                .toLowerCase()
                .contains(q))
            .toList();
    final canSend = _title.text.trim().isNotEmpty &&
        (_broadcast || _selected.isNotEmpty);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (canBroadcast)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(8),
            ),
            child: SwitchListTile(
              value: _broadcast,
              onChanged: (v) => setState(() {
                _broadcast = v;
                _selected.clear();
              }),
              title: const Text('Herkese gönder (toplu duyuru)',
                  style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600)),
              subtitle: const Text('Tüm personele bildirim'),
            ),
          ),
        if (!_broadcast) ...[
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
          if (_recipients.isEmpty)
            const Text('Kişi bulunamadı.', style: TextStyle(color: Colors.grey))
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
        _priorityRow(),
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
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final canBroadcast = context
        .watch<AuthProvider>()
        .hasRole(['HR', 'ADMIN', 'ACCOUNTING']);

    return Scaffold(
      appBar: AppBar(title: const Text('Mesaj Gönder')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : (_chatMode ? _chatBody() : _formBody(canBroadcast)),
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
