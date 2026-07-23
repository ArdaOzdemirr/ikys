import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar, Plus } from 'lucide-react';

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Yıllık İzin' },
  { value: 'HALF_DAY_AM', label: 'Öğleden Önce İzni (09:00-13:30)' },
  { value: 'HALF_DAY_PM', label: 'Öğleden Sonra İzni (13:30-18:00)' },
  { value: 'HOURLY', label: 'Saatlik' },
  { value: 'EXCUSE', label: 'Mazeret' },
  { value: 'SICK', label: 'Sağlık Raporu' },
  { value: 'MATERNITY', label: 'Doğum İzni' },
  { value: 'PATERNITY', label: 'Babalık İzni' },
  { value: 'MARRIAGE', label: 'Evlilik İzni' },
  { value: 'BEREAVEMENT', label: 'Vefat İzni' },
  { value: 'UNPAID', label: 'Ücretsiz İzin' },
];

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatRange(startDate: string, endDate: string, totalDays: number) {
  const s = new Date(startDate).toLocaleDateString('tr-TR');
  const e = new Date(endDate).toLocaleDateString('tr-TR');
  return `${s} / ${e} arası izinli · ${totalDays} gün`;
}

// Backend'deki gerçek `type` + `halfDayPeriod` alanlarına göre görünen ad
// (form'daki HALF_DAY_AM/HALF_DAY_PM sadece UI'da kullanılan sözde değerlerdir).
function leaveTypeName(type: string, halfDayPeriod?: string | null) {
  if (type === 'HALF_DAY') {
    return halfDayPeriod === 'PM' ? 'Öğleden Sonra İzni' : 'Öğleden Önce İzni';
  }
  return LEAVE_TYPES.find((t) => t.value === type)?.label || type;
}

export default function LeavePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [year, setYear] = useState(''); // "" = tüm yıllar
  const [month, setMonth] = useState(''); // "" = tüm aylar, aksi halde "1".."12"
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
    mutationFn: (data: typeof form) => {
      const isHalfDay = data.type === 'HALF_DAY_AM' || data.type === 'HALF_DAY_PM';
      const payload: any = { ...data };
      if (isHalfDay) {
        payload.type = 'HALF_DAY';
        payload.halfDayPeriod = data.type === 'HALF_DAY_AM' ? 'AM' : 'PM';
        payload.endDate = data.startDate;
      } else {
        delete payload.halfDayPeriod;
      }
      return api.post('/leave/requests', payload);
    },
    onSuccess: () => {
      toast.success('Talebiniz oluşturuldu, yönetici onayı bekleniyor');
      qc.invalidateQueries({ queryKey: ['leave-me'] });
      qc.invalidateQueries({ queryKey: ['leave-balance'] });
      setShowForm(false);
      setForm({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const downloadDoc = useMutation({
    mutationFn: (r: { id: string; startDate: string }) => {
      const date = new Date(r.startDate).toISOString().slice(0, 10);
      return api.download(`/leave/requests/${r.id}/document`, `izin-onay-belgesi-${date}.pdf`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Belge açılamadı'),
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
                {leaveTypeName(b.type)} ({b.year})
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
      {showForm && (() => {
        const isHalfDay = form.type === 'HALF_DAY_AM' || form.type === 'HALF_DAY_PM';
        return (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
          className="card space-y-4"
        >
          <h3 className="font-semibold">Yeni İzin Talebi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">İzin Tipi</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {isHalfDay ? 'Tarih' : 'Başlangıç'}
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input"
              />
            </div>
            {!isHalfDay && (
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
            )}
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
            <button
              type="submit"
              disabled={create.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {create.isPending ? 'Gönderiliyor...' : 'Talep Gönder'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              İptal
            </button>
          </div>
        </form>
        );
      })()}

      {/* Geçmiş */}
      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold">Talep Geçmişi</h3>
          <div className="flex items-center gap-2">
            <select className="input w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Tüm yıllar</option>
              {[0, 1, 2, 3, 4].map((i) => {
                const y = new Date().getFullYear() - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
            <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Tüm aylar</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            {(year || month) && (
              <button onClick={() => { setYear(''); setMonth(''); }} className="text-xs text-gray-500 hover:underline">
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
              const filtered = (requests ?? [])
                .filter((r: any) => {
                  if (year && r.startDate.slice(0, 4) !== year) return false;
                  if (month && +r.startDate.slice(5, 7) !== +month) return false;
                  return true;
                })
                .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
              if (filtered.length === 0) {
                return <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Talep yok</td></tr>;
              }
              return filtered.map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {leaveTypeName(r.type, r.halfDayPeriod)}
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
                    {r.status === 'APPROVED' && (
                      <button
                        onClick={() => downloadDoc.mutate(r)}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        Belge Görüntüle
                      </button>
                    )}
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
