import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, Plus, Repeat } from 'lucide-react';

export default function HolidaysPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    date: '',
    recurring: false,
    isOfficial: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.get('/leave/holidays'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/leave/holidays', form),
    onSuccess: () => {
      toast.success('Tatil eklendi');
      qc.invalidateQueries({ queryKey: ['holidays'] });
      setShowForm(false);
      setForm({ name: '', date: '', recurring: false, isOfficial: true });
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Hata'));
    },
  });

  // Note: Backend'de holidays için DELETE endpoint yoktu, eklemek gerek
  // Şimdilik UI'da gösteriyoruz, silmeyi backend ekleyince aktif edeceğiz
  const sorted = data ? [...data].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  ) : [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-brand-600" />
            Resmi Tatil Yönetimi
          </h1>
          <p className="text-gray-600 text-sm">
            İzin hesaplamasında kullanılacak tatil günleri (Belge: Dinamik Takvim)
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Tatil
        </button>
      </div>

      {/* Tatiller sabit/yinelenen tarihler olduğundan yıl filtresi yoktur */}
      <div className="card flex items-center">
        <p className="text-sm text-gray-600">Tanımlı tatil günleri</p>
        <p className="text-xs text-gray-500 ml-auto">
          {sorted.length} tatil günü
        </p>
      </div>

      {/* Yeni Tatil Formu */}
      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="card space-y-3"
        >
          <h3 className="font-semibold">Yeni Tatil Günü</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tatil Adı *</label>
              <input
                required
                placeholder="örn: Kurban Bayramı 1. Gün"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tarih *</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recurring"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="recurring" className="text-sm">
                Her yıl tekrarlanır (sabit tarihli tatiller için)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isOfficial"
                checked={form.isOfficial}
                onChange={(e) => setForm({ ...form, isOfficial: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isOfficial" className="text-sm">
                Resmi tatil (izin günlerinde sayılmaz)
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            💡 Sabit tarihli tatilleri (Cumhuriyet Bayramı, Yılbaşı vb.) "Her yıl tekrarlanır" olarak işaretleyin.
            Bayramlar gibi her yıl değişen tatiller için tek tek girin.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending} className="btn-primary">
              {create.isPending ? 'Ekleniyor...' : 'Tatil Ekle'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Tatil Listesi */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Tatil Adı</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Tekrarlama</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-gray-500">Tatil yok</td></tr>
            ) : sorted.map((h: any) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono">
                  {new Date(h.date).toLocaleDateString('tr-TR', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-sm font-medium">{h.name}</td>
                <td className="px-4 py-3 text-sm">
                  {h.isOfficial ? (
                    <span className="badge bg-red-100 text-red-800">Resmi Tatil</span>
                  ) : (
                    <span className="badge bg-blue-100 text-blue-800">Bilgi</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {h.recurring ? (
                    <span className="badge bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
                      <Repeat size={10} /> Her yıl
                    </span>
                  ) : (
                    <span className="text-gray-500">Tek seferlik</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
