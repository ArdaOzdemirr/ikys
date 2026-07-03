import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useState } from 'react';
import { Users } from 'lucide-react';

interface Row {
  personnelId: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  department: string | null;
  checkIn: string | null;
  checkOut: string | null;
  isLate: boolean;
  workedMinutes: number | null;
}

function todayStr() {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

export default function AttendanceOverviewPage() {
  const [date, setDate] = useState(todayStr());

  const { data: rows } = useQuery<Row[]>({
    queryKey: ['attendance-all', date],
    queryFn: () => api.get('/attendance/all', { date }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">Personel Mesai Durumu</h1>
        </div>
        <input
          type="date"
          className="input w-auto"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Personel</th>
              <th className="px-4 py-3">Departman</th>
              <th className="px-4 py-3">Giriş</th>
              <th className="px-4 py-3">Çıkış</th>
              <th className="px-4 py-3">Çalışma</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {!rows ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Yükleniyor...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aktif personel yok</td></tr>
            ) : rows.map((r) => (
              <tr key={r.personnelId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {r.firstName} {r.lastName}
                  <span className="text-xs text-gray-400 ml-1">({r.employeeNo})</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{r.department ?? '-'}</td>
                <td className="px-4 py-3 text-sm">
                  {r.checkIn ? new Date(r.checkIn).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.checkOut ? new Date(r.checkOut).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {r.workedMinutes ? `${(r.workedMinutes / 60).toFixed(1)}h` : '-'}
                </td>
                <td className="px-4 py-3">
                  {!r.checkIn ? (
                    <span className="badge bg-gray-100 text-gray-500">Giriş yapmadı</span>
                  ) : r.isLate ? (
                    <span className="badge bg-orange-100 text-orange-700">Geç kaldı</span>
                  ) : (
                    <span className="badge bg-green-100 text-green-700">Zamanında</span>
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
