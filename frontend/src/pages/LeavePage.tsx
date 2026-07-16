import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Plus } from 'lucide-react';

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Yıllık İzin' },
  { value: 'HALF_DAY', label: 'Yarım Gün' },
  { value: 'HOURLY', label: 'Saatlik' },
  { value: 'EXCUSE', label: 'Mazeret' },
  { value: 'SICK', label: 'Sağlık Raporu' },
  { value: 'MATERNITY', label: 'Doğum İzni' },
  { value: 'PATERNITY', label: 'Babalık İzni' },
  { value: 'MARRIAGE', label: 'Evlilik İzni' },
  { value: 'BEREAVEMENT', label: 'Vefat İzni' },
  { value: 'UNPAID', label: 'Ücretsiz İzin' },
];

function formatRange(startDate: string, endDate: string, totalDays: number) {
  const s = new Date(startDate).toLocaleDateString('tr-TR');
  const e = new Date(endDate).toLocaleDateString('tr-TR');
  return `${s} / ${e} arası izinli · ${totalDays} gün`;
}

export default function LeavePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [month, setMonth] = useState(''); // "" = tüm aylar, aksi halde "YYYY-MM"
  const [form, setForm] = useState({
    type: 'ANNUAL', startDate: '', endDate: '', reason: '',
  });

  const { data: balance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/leave/balance/me'),
  });

  const { data: requests } = useQuery({
    queryKey: ['leave-me'],
    queryFn: () => api.get('/leave/requests/me'),
  });

  const create = useMutation({
    mutationFn: (data: any) => api.post('/leave/requests', data),
    onSuccess: () => {
      toast.success('Talebiniz oluşturuldu, yönetici onayı bekleniyor');
      qc.invalidateQueries({ queryKey: ['leave-me'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setShowForm(false);
      setForm({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/requests/${id}`),
    onSuccess: () => {
      toast.success('Talep iptal edildi');
      qc.invalidateQueries({ queryKey: ['leave-me'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/requests/${id}/remove`),
    onSuccess: () => {
      toast.success('Talep silindi');
      qc.invalidateQueries({ queryKey: ['leave-me'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Silinemedi'),
  });

  const requestCancellation = useMutation({
    mutationFn: (id: string) => api.post(`/leave/requests/${id}/request-cancellation`, {}),
    onSuccess: () => {
      toast.success('İptal talebiniz amire iletildi');
      qc.invalidateQueries({ queryKey: ['leave-me'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">İzinlerim</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Yeni Talep
        </button>
      </div>

      {/* Bakiye */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {balance?.map((b: any) => (
          <div key={b.id} className="card">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="text-brand-600" size={18} />
              <p className="text-sm text-gray-600">
                {LEAVE_TYPES.find((t) => t.value === b.type)?.label || b.type} ({b.year})
              </p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{b.remainingDays}</p>
            <p className="text-xs text-gray-500">
              Toplam: {b.totalDays} · Kullanılan: {b.usedDays}
            </p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
          className="card space-y-4"
        >
          <h3 className="font-semibold">Yeni İzin Talebi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">İzin Tipi</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Başlangıç</label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bitiş</label>
              <input
                type="date"
                required
                min={form.startDate || new Date().toISOString().split('T')[0]}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Açıklama</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="input"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={create.isPending} className="btn-primary">
              {create.isPending ? 'Gönderiliyor...' : 'Talep Gönder'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Geçmiş */}
      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold">Talep Geçmişi</h3>
          <div className="flex items-center gap-2">
            <input
              type="month"
              className="input w-auto"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            {month && (
              <button onClick={() => setMonth('')} className="text-xs text-gray-500 hover:underline">
                Temizle
              </button>
            )}
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(() => {
              const filtered = (requests ?? []).filter(
                (r: any) => !month || r.startDate.slice(0, 7) === month,
              );
              if (filtered.length === 0) {
                return <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Talep yok</td></tr>;
              }
              return filtered.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {LEAVE_TYPES.find((t) => t.value === r.type)?.label || r.type}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {formatRange(r.startDate, r.endDate, r.totalDays)}
                </td>
                <td className="px-4 py-3">
                  <LeaveStatusBadge status={r.status} />
                  {r.status === 'PENDING' && r.approvalSteps?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const cur = r.approvalSteps.find(
                          (s: any) => s.stepOrder === r.currentStepOrder,
                        );
                        const who = cur?.approver
                          ? `${cur.approver.firstName} ${cur.approver.lastName}`
                          : 'amir';
                        return `Onayda: ${who} (${r.currentStepOrder}/${r.approvalSteps.length})`;
                      })()}
                    </p>
                  )}
                  {r.status === 'REJECTED' && r.rejectionReason && (
                    <p className="text-xs text-red-500 mt-1">{r.rejectionReason}</p>
                  )}
                  {r.status === 'APPROVED' && r.paymentType && (
                    <p className={`text-xs mt-1 ${r.paymentType === 'UNPAID' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {r.paymentType === 'PAID' ? 'Ücretli' : 'Ücretsiz'}
                    </p>
                  )}
                  {r.status === 'CANCEL_REQUESTED' && (
                    <p className="text-xs text-amber-600 mt-1">İptal talebiniz amir onayını bekliyor</p>
                  )}
                  {r.status === 'APPROVED' && new Date(r.startDate) <= new Date() && (
                    <p className="text-xs text-gray-400 mt-1">Başlamış izin iptal edilemez</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 items-center">
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => cancel.mutate(r.id)}
                        className="text-amber-600 hover:underline text-xs"
                      >
                        İptal
                      </button>
                    )}
                    {r.status === 'APPROVED' && new Date(r.startDate) > new Date() && (
                      <button
                        onClick={() => {
                          if (confirm('Bu izin için amir onayı gerektiren bir iptal talebi oluşturulsun mu?')) {
                            requestCancellation.mutate(r.id);
                          }
                        }}
                        className="text-amber-600 hover:underline text-xs"
                      >
                        İptal Talebi Oluştur
                      </button>
                    )}
                    {(r.status === 'REJECTED' || r.status === 'CANCELLED') && (
                      <button
                        onClick={() => {
                          if (confirm('Bu izin kaydı kalıcı olarak silinsin mi?')) remove.mutate(r.id);
                        }}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Sil
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaveStatusBadge({ status }: { status: string }) {
  const c: any = {
    PENDING: { color: 'bg-yellow-100 text-yellow-800', label: 'Beklemede' },
    APPROVED: { color: 'bg-green-100 text-green-800', label: 'Onaylandı' },
    REJECTED: { color: 'bg-red-100 text-red-800', label: 'Reddedildi' },
    CANCELLED: { color: 'bg-gray-100 text-gray-700', label: 'İptal' },
    CANCEL_REQUESTED: { color: 'bg-amber-100 text-amber-800', label: 'İptal Onayı Bekliyor' },
  };
  const x = c[status] || { color: 'bg-gray-100', label: status };
  return <span className={`badge ${x.color}`}>{x.label}</span>;
}
