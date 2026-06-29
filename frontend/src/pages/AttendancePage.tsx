import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AttendancePage() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: records } = useQuery({
    queryKey: ['attendance-me'],
    queryFn: () => api.get('/attendance/me'),
  });

  const today = records?.find((r: any) => {
    const recordDate = r.date.split('T')[0]; //
    const now = new Date();
    const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    return recordDate === todayUtc;
});

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mesai Takibi</h1>

      {/* Bugünkü durum */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="text-brand-600" />
          <h3 className="font-semibold">Bugün - {now.toLocaleDateString('tr-TR')}</h3>
        </div>
        <p className="text-3xl font-mono font-bold text-gray-900 mb-6">
          {now.toLocaleTimeString('tr-TR')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Giriş</p>
            <p className="text-lg font-bold text-green-700">
              {today?.checkIn ? new Date(today.checkIn).toLocaleTimeString('tr-TR') : '-'}
            </p>
            {today?.isLate && (
              <span className="badge bg-orange-100 text-orange-700 mt-2 inline-block">
                Geç kalındı
              </span>
            )}
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Çıkış</p>
            <p className="text-lg font-bold text-red-700">
              {today?.checkOut ? new Date(today.checkOut).toLocaleTimeString('tr-TR') : '-'}
            </p>
            {today?.workedMinutes && (
              <p className="text-xs text-gray-600 mt-1">
                Çalışılan: {(today.workedMinutes / 60).toFixed(1)}h
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Mesai giriş/çıkışı yalnızca <strong>mobil uygulamadan</strong> (QR + konum ile)
          yapılır. Web üzerinden mesai başlatılamaz; bu ekran yalnızca görüntüleme içindir.
        </div>
      </div>

      {/* Geçmiş */}
      <div className="card overflow-x-auto p-0">
        <h3 className="font-semibold p-4 border-b border-gray-200">Son Mesailerim</h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Giriş</th>
              <th className="px-4 py-3">Çıkış</th>
              <th className="px-4 py-3">Çalışma</th>
              <th className="px-4 py-3">Fazla Mesai</th>
              <th className="px-4 py-3">Yöntem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records?.slice(0, 30).map((r: any) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{new Date(r.date).toLocaleDateString('tr-TR')}</td>
                <td className="px-4 py-3 text-sm">
                  {r.checkIn ? new Date(r.checkIn).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {r.checkOut ? new Date(r.checkOut).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {r.workedMinutes ? `${(r.workedMinutes / 60).toFixed(1)}h` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-orange-600">
                  {r.overtimeMin > 0 ? `+${(r.overtimeMin / 60).toFixed(1)}h` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{r.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
