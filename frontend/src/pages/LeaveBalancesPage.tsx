import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { CalendarDays } from 'lucide-react';

interface Row {
  personnelId: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  department: string | null;
  remaining: number;
}

// Kimin hangi tarihlerde izin aldığı zaten "İzin Listesi"nde var, burada tekrar edilmiyor.
export default function LeaveBalancesPage() {
  const { data: rows } = useQuery<Row[]>({
    queryKey: ['leave-balances-all'],
    queryFn: () => api.get('/leave/balance/all'),
  });

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <CalendarDays className="text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900">Personel İzin Bakiyeleri</h1>
      </div>

      <div className="card p-0 divide-y divide-gray-200">
        {!rows ? (
          <p className="p-6 text-center text-gray-500">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Aktif personel yok</p>
        ) : rows.map((r) => (
          <div key={r.personnelId} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {r.firstName} {r.lastName}
                <span className="text-xs text-gray-400 ml-1">({r.employeeNo})</span>
              </p>
              <p className="text-xs text-gray-500">{r.department ?? '-'}</p>
            </div>
            <span className="badge bg-brand-50 text-brand-700">{r.remaining} gün kaldı</span>
          </div>
        ))}
      </div>
    </div>
  );
}
