import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { CalendarDays } from 'lucide-react';

const statusLabel: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'Onaylandı', cls: 'bg-green-100 text-green-700' },
  PENDING: { label: 'Beklemede', cls: 'bg-amber-100 text-amber-700' },
  REJECTED: { label: 'Reddedildi', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'İptal', cls: 'bg-gray-100 text-gray-500' },
  CANCEL_REQUESTED: { label: 'İptal Onayı Bekliyor', cls: 'bg-amber-100 text-amber-800' },
};

const fmt = (d: string) => new Date(d).toLocaleDateString('tr-TR');

export default function LeaveListPage() {
  const year = new Date().getFullYear();
  const [status, setStatus] = useState('APPROVED');
  const [yr, setYr] = useState(String(year));

  const { data: rows } = useQuery<any[]>({
    queryKey: ['leave-list', status, yr],
    queryFn: () => api.get('/leave/list', { status, year: yr || undefined }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900">İzin Listesi</h1>
      </div>
      <p className="text-gray-600 text-sm">
        İK / Muhasebe / Admin tüm personeli görür; yöneticiler kendi alanlarındaki personeli görür.
      </p>

      <div className="flex gap-3 flex-wrap">
        <select className="input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="APPROVED">Onaylanmış</option>
          <option value="PENDING">Bekleyen</option>
          <option value="CANCEL_REQUESTED">İptal Onayı Bekleyen</option>
          <option value="REJECTED">Reddedilen</option>
          <option value="CANCELLED">İptal Edilen</option>
          <option value="ALL">Tümü</option>
        </select>
        <select className="input max-w-[140px]" value={yr} onChange={(e) => setYr(e.target.value)}>
          <option value="">Tüm yıllar</option>
          {[year, year - 1, year - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Personel</th>
              <th className="px-4 py-3">Departman</th>
              <th className="px-4 py-3">İzin Türü</th>
              <th className="px-4 py-3">Başlangıç</th>
              <th className="px-4 py-3">Bitiş</th>
              <th className="px-4 py-3">Gün</th>
              <th className="px-4 py-3">Ücret</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!rows ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Yükleniyor...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Kayıt yok</td></tr>
            ) : rows.map((r: any) => {
              const s = statusLabel[r.status] || statusLabel.PENDING;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-900">
                      {r.personnel?.firstName} {r.personnel?.lastName}
                    </span>
                    <span className="text-xs text-gray-400 block">{r.personnel?.employeeNo}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{r.personnel?.department?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{r.category?.name || r.type || '-'}</td>
                  <td className="px-4 py-3 text-sm">{fmt(r.startDate)}</td>
                  <td className="px-4 py-3 text-sm">{fmt(r.endDate)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.totalDays}</td>
                  <td className="px-4 py-3 text-sm">
                    {r.paymentType === 'PAID' ? 'Ücretli' : r.paymentType === 'UNPAID' ? 'Ücretsiz' : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.cls}`}>{s.label}</span>
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
