import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/services.dart';

/// İzin onayları: onay sırası ŞU AN bu kullanıcıda olan talepler.
/// Organizasyon şemasında amir amir yukarı çıkan zincirin bu kullanıcıya
/// düşen adımını gösterir.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  List<PendingApproval> _items = [];
  List<PendingApproval> _cancellations = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await ApprovalService.pending();
    } catch (e) {
      if (mounted) _snack(ApiClient.errorMessage(e, 'Yüklenemedi'));
    }
    try {
      _cancellations = await ApprovalService.pendingCancellations();
    } catch (_) {
      // 403 olabilir (MANAGER/HR/ADMIN değilse); sessizce boş bırak
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _approveCancellation(PendingApproval a) async {
    try {
      await ApprovalService.decideCancellation(a.id, true);
      _snack('İptal talebi onaylandı');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'İşlem başarısız'));
    }
  }

  Future<void> _rejectCancellation(PendingApproval a) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('İptal Talebini Reddet'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Neden reddediliyor? (opsiyonel)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Vazgeç')),
          FilledButton(
            onPressed: () => Navigator.pop(c, ctrl.text.trim()),
            child: const Text('Reddet'),
          ),
        ],
      ),
    );
    if (reason == null) return;
    try {
      await ApprovalService.decideCancellation(a.id, false, rejectionReason: reason);
      _snack('İptal talebi reddedildi; izin geçerliliğini koruyor');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'İşlem başarısız'));
    }
  }

  void _snack(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _approve(PendingApproval a) async {
    String? paymentType;
    // İlk yıl + son adım ise ücretli/ücretsiz sor
    if (a.isFinalStep && a.requiresPaymentDecision) {
      paymentType = await showDialog<String>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Ödeme Tipi Kararı'),
          content: Text(
              '${a.requesterName} için yıllık izin bakiyesi yeterli değil (ilk yıl veya bakiye bitmiş olabilir). Bu izni ücretli mi ücretsiz mi onaylıyorsunuz? Ücretli onaylarsanız gerekirse gelecek yıl bakiyesinden düşülür.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(c, 'PAID'),
                child: const Text('Ücretli')),
            TextButton(
                onPressed: () => Navigator.pop(c, 'UNPAID'),
                child: const Text('Ücretsiz')),
            TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Vazgeç')),
          ],
        ),
      );
      if (paymentType == null) return; // vazgeçildi
    }

    try {
      await ApprovalService.approve(a.id, paymentType: paymentType);
      _snack(a.isFinalStep ? 'Onaylandı' : 'Onaylandı, bir üst amire iletildi');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'İşlem başarısız'));
    }
  }

  Future<void> _reject(PendingApproval a) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Red Gerekçesi'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Neden reddediliyor?',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c),
              child: const Text('Vazgeç')),
          FilledButton(
            onPressed: () => Navigator.pop(c, ctrl.text.trim()),
            child: const Text('Reddet'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await ApprovalService.reject(a.id, reason);
      _snack('Reddedildi');
      await _load();
    } catch (e) {
      _snack(ApiClient.errorMessage(e, 'İşlem başarısız'));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_items.isEmpty && _cancellations.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: const [
            Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.check_circle_outline, size: 40, color: Colors.green),
                    SizedBox(height: 8),
                    Text('Onay sırası sizde olan talep yok',
                        style: TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ..._items.map(_card),
          if (_cancellations.isNotEmpty) ...[
            const SizedBox(height: 8),
            const Text('İptal Talepleri',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 10),
            ..._cancellations.map(_cancellationCard),
          ],
        ],
      ),
    );
  }

  Widget _cancellationCard(PendingApproval a) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${a.requesterName} (${a.employeeNo})',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 6),
          Text(
            '${a.leaveName} · ${a.totalDays.toStringAsFixed(0)} gün\n'
            '${DateFormat('dd MMM').format(a.startDate)} – '
            '${DateFormat('dd MMM yyyy').format(a.endDate)}',
            style: const TextStyle(color: Color(0xFF374151)),
          ),
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text('Bu izin onaylanmıştı; çalışan iptal talep etti.',
                style: TextStyle(color: Color(0xFFB45309), fontSize: 12, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _approveCancellation(a),
                  icon: const Icon(Icons.check),
                  label: const Text('Onayla'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _rejectCancellation(a),
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                  icon: const Icon(Icons.close),
                  label: const Text('Reddet'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _card(PendingApproval a) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
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
                child: Text('${a.requesterName} (${a.employeeNo})',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 15)),
              ),
              if (a.totalSteps > 1)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(999)),
                  child: Text('Adım ${a.stepOrder}/${a.totalSteps}',
                      style: const TextStyle(
                          color: Color(0xFF1D4ED8),
                          fontSize: 11,
                          fontWeight: FontWeight.w600)),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${a.leaveName} · ${a.totalDays.toStringAsFixed(0)} gün\n'
            '${DateFormat('dd MMM').format(a.startDate)} – '
            '${DateFormat('dd MMM yyyy').format(a.endDate)}',
            style: const TextStyle(color: Color(0xFF374151)),
          ),
          if (a.requiresPaymentDecision)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Ücretli/ücretsiz kararı gerekli',
                  style: TextStyle(
                      color: Color(0xFFB45309),
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
            ),
          if (!a.isFinalStep)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Onaylarsanız bir üst amire iletilir',
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            ),
          if (a.reason != null && a.reason!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('"${a.reason}"',
                  style: const TextStyle(color: Colors.grey, fontSize: 13)),
            ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _approve(a),
                  icon: Icon(a.isFinalStep
                      ? Icons.check
                      : Icons.arrow_upward),
                  label: Text(a.isFinalStep ? 'Onayla' : 'Onayla ve ilet'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _reject(a),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red),
                  icon: const Icon(Icons.close),
                  label: const Text('Reddet'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
