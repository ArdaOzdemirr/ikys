import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Play, Wallet, X } from 'lucide-react';

const MONTHS = ['', 'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

export default function PayrollManagementPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({});
  const [salaryFor, setSalaryFor] = useState<any | null>(null);

  // Maaş bilgisini de getiren bordro-özel uç (normal /personnel maaşı döndürmüyordu)
  const { data: people } = useQuery<any[]>({
    queryKey: ['payroll-personnel'],
    queryFn: () => api.get('/payroll/personnel'),
  });

  const generate = useMutation({
    mutationFn: (data: any) => api.post('/payroll/generate', data),
    onSuccess: (res: any) => {
      const avans = +res.avansDeduction;
      toast.success(
        avans > 0
          ? `Bordro üretildi — ${avans.toLocaleString('tr-TR')} ₺ avans net maaştan düşüldü`
          : 'Bordro üretildi',
      );
      qc.invalidateQueries({ queryKey: ['payrolls-me'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const generateAll = async () => {
    const withSalary = (people || []).filter((p) => p.salaryConfig);
    if (withSalary.length === 0) {
      toast.error('Maaş tanımı olan personel yok');
      return;
    }
    let success = 0, skipped = 0, totalAvans = 0;
    for (const p of withSalary) {
      try {
        const res: any = await api.post('/payroll/generate', {
          personnelId: p.id, year, month, bonus: +bonusInputs[p.id] || 0,
        });
        success++;
        totalAvans += +res.avansDeduction;
      } catch (e: any) {
        if (e.response?.data?.message?.includes('zaten mevcut')) skipped++;
      }
    }
    toast.success(
      `${success} bordro üretildi${skipped > 0 ? `, ${skipped} atlandı (zaten mevcut)` : ''}`
      + (totalAvans > 0 ? ` — toplam ${totalAvans.toLocaleString('tr-TR')} ₺ avans düşüldü` : ''),
    );
    qc.invalidateQueries({ queryKey: ['payrolls-me'] });
  };

  if (!hasRole('ADMIN', 'HR', 'ACCOUNTING')) {
    return <div className="p-8 text-center"><p className="text-gray-600">Bu sayfaya erişim yetkiniz yok.</p></div>;
  }

  const withSalary = (people || []).filter((p) => p.salaryConfig);
  const withoutSalary = (people || []).filter((p) => !p.salaryConfig);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bordro Yönetimi</h1>
        <p className="text-gray-600 text-sm">Önce maaş tanımlayın, sonra aylık bordro üretin</p>
      </div>

      <div className="card">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1">Yıl</label>
            <select value={year} onChange={(e) => setYear(+e.target.value)} className="input">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ay</label>
            <select value={month} onChange={(e) => setMonth(+e.target.value)} className="input">
              {MONTHS.slice(1).map((m, i) => (<option key={i + 1} value={i + 1}>{m}</option>))}
            </select>
          </div>
          <button onClick={generateAll} className="btn-primary flex items-center gap-2">
            <Play size={16} /> Tümüne Bordro Üret ({withSalary.length} kişi)
          </button>
        </div>
      </div>

      {withoutSalary.length > 0 && (
        <div className="card bg-orange-50 border-orange-200">
          <h3 className="font-semibold text-orange-800 flex items-center gap-2">
            ⚠️ Maaş tanımı olmayan personel ({withoutSalary.length})
          </h3>
          <p className="text-sm text-orange-700 mt-1">
            Bu personeller için bordro üretilemez. "Maaş Tanımla" ile brüt maaşı girin.
          </p>
          <div className="mt-3 space-y-2">
            {withoutSalary.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                <span className="text-sm">{p.firstName} {p.lastName} <span className="text-xs text-gray-400">({p.employeeNo})</span></span>
                <button onClick={() => setSalaryFor(p)} className="btn-primary text-sm flex items-center gap-1">
                  <Wallet size={14} /> Maaş Tanımla
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <h3 className="font-semibold p-4 border-b border-gray-200">
          {MONTHS[month]} {year} - Bordro Üretimi
        </h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Personel</th>
              <th className="px-4 py-3">Departman</th>
              <th className="px-4 py-3">Brüt Maaş</th>
              <th className="px-4 py-3">İkramiye (opsiyonel)</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {withSalary.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Maaş tanımlı personel yok</td></tr>
            ) : withSalary.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  <p className="font-medium">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-gray-500">{p.employeeNo}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.department?.name || '-'}</td>
                <td className="px-4 py-3 text-sm font-medium">
                  {(+p.salaryConfig.grossSalary).toLocaleString('tr-TR')} ₺
                  <button onClick={() => setSalaryFor(p)} className="ml-2 text-xs text-brand-600 hover:underline">düzenle</button>
                </td>
                <td className="px-4 py-3">
                  <input type="number" placeholder="0" value={bonusInputs[p.id] || ''}
                    onChange={(e) => setBonusInputs({ ...bonusInputs, [p.id]: e.target.value })}
                    className="input w-28" />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => generate.mutate({ personnelId: p.id, year, month, bonus: +(bonusInputs[p.id] || 0) })}
                    disabled={generate.isPending}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    Bordro Üret
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card bg-gray-50">
        <p className="text-sm text-gray-600">
          💡 Aynı dönem için tekrar bordro üretilemez. Üretilen bordroyu personel kendi
          "Bordro" sayfasından PDF olarak indirir.
        </p>
      </div>

      {salaryFor && (
        <SalaryModal personnel={salaryFor} onClose={() => setSalaryFor(null)}
          onSaved={() => { setSalaryFor(null); qc.invalidateQueries({ queryKey: ['payroll-personnel'] }); }} />
      )}
    </div>
  );
}

function SalaryModal({ personnel, onClose, onSaved }: { personnel: any; onClose: () => void; onSaved: () => void }) {
  const c = personnel.salaryConfig;
  const [form, setForm] = useState({
    grossSalary: c?.grossSalary ? String(c.grossSalary) : '',
    agi: c?.agi ? String(c.agi) : '',
    mealAllowance: c?.mealAllowance ? String(c.mealAllowance) : '',
    transportAllowance: c?.transportAllowance ? String(c.transportAllowance) : '',
    bes: c?.bes ? String(c.bes) : '',
  });

  const save = useMutation({
    mutationFn: () => api.post(`/payroll/salary/${personnel.id}`, {
      grossSalary: +form.grossSalary,
      agi: form.agi ? +form.agi : undefined,
      mealAllowance: form.mealAllowance ? +form.mealAllowance : undefined,
      transportAllowance: form.transportAllowance ? +form.transportAllowance : undefined,
      bes: form.bes ? +form.bes : undefined,
    }),
    onSuccess: () => { toast.success('Maaş tanımlandı'); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = +form.grossSalary > 0;

  const field = (key: keyof typeof form, label: string) => (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input type="number" className="input" value={form[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Maaş Tanımı — {personnel.firstName} {personnel.lastName}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        {field('grossSalary', 'Brüt Maaş (₺) *')}
        <div className="grid grid-cols-2 gap-3">
          {field('agi', 'AGİ (₺)')}
          {field('bes', 'BES (₺)')}
          {field('mealAllowance', 'Yemek (₺)')}
          {field('transportAllowance', 'Yol (₺)')}
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={() => save.mutate()} disabled={!canSave || save.isPending}
            className="btn-primary flex-1 disabled:opacity-50">Kaydet</button>
          <button onClick={onClose} className="btn-secondary">Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
