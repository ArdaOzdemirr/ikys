import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CalendarDays, ChevronRight } from 'lucide-react';

interface TakenLeave {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

interface Row {
  personnelId: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  department: string | null;
  hireDate: string;
  totalEntitled: number;
  used: number;
  remaining: number;
  takenLeaves: TakenLeave[];
}

/** HR/Admin: personel seç, sonra o kişinin izin detayına gir (bkz. LeaveBalanceDetailPage). */
export default function LeaveBalancesPage() {
  const navigate = useNavigate();

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
      <p className="text-sm text-gray-500">
        Detaylı izin tarihlerini görmek için bir personel seçin.
      </p>

      <div className="card p-0 divide-y divide-gray-200">
        {!rows ? (
          <p className="p-6 text-center text-gray-500">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Aktif personel yok</p>
        ) : rows.map((r) => (
          <button
            key={r.personnelId}
            onClick={() => navigate(`/leave/balances/${r.personnelId}`)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {r.firstName} {r.lastName}
                <span className="text-xs text-gray-400 ml-1">({r.employeeNo})</span>
              </p>
              <p className="text-xs text-gray-500">{r.department ?? '-'}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge bg-brand-50 text-brand-700">{r.remaining} gün kaldı</span>
              <ChevronRight className="text-gray-400" size={18} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
