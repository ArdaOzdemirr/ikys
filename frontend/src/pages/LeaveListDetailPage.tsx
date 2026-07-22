import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, ListChecks, Clock, Download } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Yıllık İzin',
  HALF_DAY: 'Yarım Gün',
  HOURLY: 'Saatlik',
  EXCUSE: 'Mazeret',
  SICK: 'Sağlık Raporu',
  MATERNITY: 'Doğum İzni',
  PATERNITY: 'Babalık İzni',
  MARRIAGE: 'Evlilik İzni',
  BEREAVEMENT: 'Vefat İzni',
  UNPAID: 'Ücretsiz İzin',
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'Onaylandı', cls: 'bg-green-100 text-green-700' },
  PENDING: { label: 'Beklemede', cls: 'bg-amber-100 text-amber-700' },
  REJECTED: { label: 'Reddedildi', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'İptal', cls: 'bg-gray-100 text-gray-500' },
  CANCEL_REQUESTED: { label: 'İptal Onayı Bekliyor', cls: 'bg-amber-100 text-amber-800' },
};

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR');

/** HR/Muhasebe/Admin/Yönetici: tek bir personelin tüm izin geçmişi. */
export default function LeaveListDetailPage() {
  const { personnelId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [status, setStatus] = useState('ALL');
  const [yr, setYr] = useState(String(year));
  const [month, setMonth] = useState('');
  const [showHourly, setShowHourly] = useState(false);
  const [hourlyForm, setHourlyForm] = useState({ date: '', startTime: '', endTime: '', reason: '' });

  const { data: rows } = useQuery<any[]>({
    queryKey: ['leave-list', status, yr],
    queryFn: () => api.get('/leave/list', { status, year: yr || undefined }),
  });

  const { data: balances } = useQuery<any[]>({
    queryKey: ['leave-balances-all'],
    queryFn: () => api.get('/leave/balance/all'),
  });
  const balance = balances?.find((b) => b.personnelId === personnelId);

  const downloadDoc = useMutation({
    mutationFn: (id: string) => api.download(`/leave/requests/${id}/document`, `izin-onay-belgesi-${id}.pdf`),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Belge indirilemedi'),
  });

  const downloadYearlyReport = useMutation({
    mutationFn: () => api.download(
      `/leave/balance/${personnelId}/pdf?year=${yr || year}`,
      `izin-dokumu-${personnelId}-${yr || year}.pdf`,
    ),
    onError: (e: any) => toast.error(e.response?.data?.message || 'İndirilemedi'),
  });

  const grantHourly = useMutation({
    mutationFn: () => api.post('/leave/requests/hourly', { personnelId, ...hourlyForm }),
    onSuccess: () => {
      toast.success('Saatlik izin tanımlandı');
      qc.invalidateQueries({ queryKey: ['leave-list'] });
      setShowHourly(false);
      setHourlyForm({ date: '', startTime: '', endTime: '', reason: '' });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Tanımlanamadı'),
  });

  const mine = (rows ?? [])
    .filter((r) => r.personnelId === personnelId && (!month || new Date(r.startDate).getMonth() + 1 === +month))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const person = mine[0]?.personnel;

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <button
        onClick={() => navigate('/leave/list')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Personel listesine dön
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            {person ? `${person.firstName} ${person.lastName}` : 'İzin Geçmişi'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadYearlyReport.mutate()}
            disabled={downloadYearlyReport.isPending}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Download size={16} /> Yıllık Rapor İndir
          </button>
          <button onClick={() => setShowHourly(!showHourly)} className="btn-secondary flex items-center gap-2 text-sm">
            <Clock size={16} /> Saatlik İzin Ver
          </button>
        </div>
      </div>
      {person && <p className="text-sm text-gray-500">{person.department?.name ?? '-'}</p>}

      {balance && (
        <div className="grid grid-cols-3 gap-4 max-w-lg">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{balance.totalEntitled}</p>
            <p className="text-xs text-gray-500 mt-1">Toplam Hak</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{balance.used}</p>
            <p className="text-xs text-gray-500 mt-1">Kullanılan</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-brand-700">{balance.remaining}</p>
            <p className="text-xs text-gray-500 mt-1">Kalan</p>
          </div>
        </div>
      )}

      {showHourly && (
        <form
          onSubmit={(e) => { e.preventDefault(); grantHourly.mutate(); }}
          className="card space-y-3"
        >
          <h3 className="font-semibold">Saatlik İzin Ver</h3>
          <p className="text-xs text-gray-500">Bu izin doğrudan onaylı olarak kaydedilir ve yıllık izin bakiyesini etkilemez.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="date"
              required
              value={hourlyForm.date}
              onChange={(e) => setHourlyForm({ ...hourlyForm, date: e.target.value })}
              className="input"
            />
            <input
              type="time"
              required
              value={hourlyForm.startTime}
              onChange={(e) => setHourlyForm({ ...hourlyForm, startTime: e.target.value })}
              className="input"
            />
            <input
              type="time"
              required
              value={hourlyForm.endTime}
              onChange={(e) => setHourlyForm({ ...hourlyForm, endTime: e.target.value })}
              className="input"
            />
            <input
              placeholder="Açıklama (opsiyonel)"
              value={hourlyForm.reason}
              onChange={(e) => setHourlyForm({ ...hourlyForm, reason: e.target.value })}
              className="input md:col-span-3"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={grantHourly.isPending} className="btn-primary disabled:opacity-50">
              {grantHourly.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => setShowHourly(false)} className="btn-secondary">İptal</button>
          </div>
        </form>
      )}

      <div className="flex gap-3 flex-wrap">
        <select className="input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">Tümü</option>
          <option value="APPROVED">Onaylanmış</option>
          <option value="PENDING">Bekleyen</option>
          <option value="CANCEL_REQUESTED">İptal Onayı Bekleyen</option>
          <option value="REJECTED">Reddedilen</option>
          <option value="CANCELLED">İptal Edilen</option>
        </select>
        <select className="input max-w-[140px]" value={yr} onChange={(e) => setYr(e.target.value)}>
          <option value="">Tüm yıllar</option>
          {[year, year - 1, year - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select className="input max-w-[150px]" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Tüm aylar</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">İzin Türü</th>
              <th className="px-4 py-3">Başlangıç</th>
              <th className="px-4 py-3">Bitiş</th>
              <th className="px-4 py-3">Gün</th>
              <th className="px-4 py-3">Ücret</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!rows ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Yükleniyor...</td></tr>
            ) : mine.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Kayıt yok</td></tr>
            ) : mine.map((r: any) => {
              const s = statusLabel[r.status] || statusLabel.PENDING;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {r.category?.name ||
                      (r.type === 'HALF_DAY'
                        ? r.halfDayPeriod === 'PM' ? 'Öğleden Sonra İzni' : 'Öğleden Önce İzni'
                        : r.type ? TYPE_LABELS[r.type] ?? r.type : '-')}
                  </td>
                  <td className="px-4 py-3 text-sm">{fmt(r.startDate)}</td>
                  <td className="px-4 py-3 text-sm">{fmt(r.endDate)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.totalDays}</td>
                  <td className={`px-4 py-3 text-sm ${r.paymentType === 'UNPAID' ? 'text-red-600 font-medium' : ''}`}>
                    {r.paymentType === 'PAID' ? 'Ücretli' : r.paymentType === 'UNPAID' ? 'Ücretsiz' : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'APPROVED' && (
                      <button
                        onClick={() => downloadDoc.mutate(r.id)}
                        className="text-brand-600 hover:underline text-xs"
                      >
                        Belge İndir
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
