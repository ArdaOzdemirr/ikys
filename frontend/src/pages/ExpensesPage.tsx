import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Receipt, Plus, Paperclip, X } from 'lucide-react';

const CATEGORIES = ['yemek', 'yol', 'iş', 'konaklama', 'avans', 'diğer'];

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: 'yemek', amount: '', date: '', description: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ['expenses-me'],
    queryFn: () => api.get('/payroll/expenses/me'),
  });

  const create = useMutation({
    mutationFn: async (data: any) => {
      let receiptUrl: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/payroll/expenses/upload-receipt', fd);
        receiptUrl = res.receiptUrl;
      }
      return api.post('/payroll/expenses', { ...data, amount: +data.amount, receiptUrl });
    },
    onSuccess: () => {
      toast.success('Talep oluşturuldu');
      qc.invalidateQueries({ queryKey: ['expenses-me'] });
      setShowForm(false);
      setForm({ category: 'yemek', amount: '', date: '', description: '' });
      setFile(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="text-brand-600" size={24} /> Masraflarım
        </h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Yeni Masraf / Para Talebi
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Yemek/yol/iş gibi harcamalarınız için fiş/fatura ekleyin; doğrudan para talebi için
        "avans" kategorisini seçin (fiş gerekmez). Talebiniz muhasebeye iletilir.
      </p>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
          className="card space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tutar (TRY)</label>
              <input type="number" step="0.01" required value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tarih</label>
              <input type="date" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Açıklama</label>
              <textarea required value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input" rows={2} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Fiş/Fatura (opsiyonel)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center gap-2 text-sm">
                  <Paperclip size={16} className="text-brand-600" />
                  <span>{file.name}</span>
                  <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2">
                  <Paperclip size={16} /> Dosya Seç
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending} className="btn-primary">Gönder</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">İptal</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Tutar</th>
              <th className="px-4 py-3">Açıklama</th>
              <th className="px-4 py-3">Fiş</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Masraf yok</td></tr>
            ) : data?.map((e: any) => (
              <tr key={e.id}>
                <td className="px-4 py-3 text-sm">{new Date(e.date).toLocaleDateString('tr-TR')}</td>
                <td className="px-4 py-3 text-sm">{e.category}</td>
                <td className="px-4 py-3 text-sm font-medium">{(+e.amount).toLocaleString('tr-TR')} {e.currency}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{e.description}</td>
                <td className="px-4 py-3 text-sm">
                  {e.receiptUrl ? (
                    <button
                      type="button"
                      onClick={() => api.openProtectedFile(e.receiptUrl).catch(() => toast.error('Dosya açılamadı'))}
                      className="text-brand-600 hover:underline"
                    >
                      📎 Görüntüle
                    </button>
                  ) : '—'}
                </td>
                <td className="px-4 py-3"><ExpenseBadge status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpenseBadge({ status }: { status: string }) {
  const c: any = {
    PENDING: { color: 'bg-yellow-100 text-yellow-800', label: 'Beklemede' },
    APPROVED: { color: 'bg-blue-100 text-blue-800', label: 'Onaylandı' },
    REJECTED: { color: 'bg-red-100 text-red-800', label: 'Reddedildi' },
    PAID: { color: 'bg-green-100 text-green-800', label: 'Ödendi' },
  };
  const x = c[status] || { color: 'bg-gray-100', label: status };
  return <span className={`badge ${x.color}`}>{x.label}</span>;
}
