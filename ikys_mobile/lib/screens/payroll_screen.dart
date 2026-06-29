import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/services.dart';

const _months = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

String _money(double v) =>
    '${NumberFormat('#,##0.00', 'tr_TR').format(v)} ₺';

class PayrollScreen extends StatefulWidget {
  const PayrollScreen({super.key});

  @override
  State<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends State<PayrollScreen> {
  List<PayrollRecord> _list = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _list = await PayrollService.mine();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bordrom')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _list.isEmpty
              ? const Center(child: Text('Henüz bordron yok.'))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: _list.map(_card).toList(),
                  ),
                ),
    );
  }

  Widget _card(PayrollRecord p) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        title: Text('${_months[p.month]} ${p.year}',
            style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('Net: ${_money(p.netSalary)}',
            style: const TextStyle(color: Color(0xFF16A34A), fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          builder: (_) => _PayrollDetail(p),
        ),
      ),
    );
  }
}

class _PayrollDetail extends StatelessWidget {
  final PayrollRecord p;
  const _PayrollDetail(this.p);

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.92,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Text('${_months[p.month]} ${p.year} Bordrosu',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 16),
          _section('Kazançlar'),
          _row('Brüt Maaş', p.grossSalary),
          if (p.agi > 0) _row('AGİ', p.agi),
          if (p.mealAllowance > 0) _row('Yemek', p.mealAllowance),
          if (p.transportAllowance > 0) _row('Yol', p.transportAllowance),
          if (p.overtimePay > 0) _row('Fazla Mesai', p.overtimePay),
          if (p.bonus > 0) _row('İkramiye', p.bonus),
          const Divider(height: 24),
          _section('Kesintiler'),
          _row('SGK İşçi Payı', p.sgkEmployee, negative: true),
          _row('İşsizlik Sig.', p.unemploymentIns, negative: true),
          _row('Gelir Vergisi', p.incomeTax, negative: true),
          _row('Damga Vergisi', p.stampTax, negative: true),
          if (p.bes > 0) _row('BES', p.bes, negative: true),
          if (p.avansDeduction > 0) _row('Avans Kesintisi', p.avansDeduction, negative: true),
          if (p.otherDeductions > 0) _row('Diğer', p.otherDeductions, negative: true),
          _row('Toplam Kesinti', p.totalDeductions, negative: true, bold: true),
          const Divider(height: 24),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Net Ödeme',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Text(_money(p.netSalary),
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: Color(0xFF16A34A))),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'PDF olarak indirmek için web (İKYS) > Bordro sayfasını kullanabilirsin.',
            style: TextStyle(color: Colors.grey, fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _section(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
      );

  Widget _row(String k, double v, {bool negative = false, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k,
              style: TextStyle(
                  color: Colors.grey[700],
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text('${negative ? '- ' : ''}${_money(v)}',
              style: TextStyle(
                  fontWeight: bold ? FontWeight.bold : FontWeight.w500,
                  color: negative ? const Color(0xFFDC2626) : Colors.black87)),
        ],
      ),
    );
  }
}
