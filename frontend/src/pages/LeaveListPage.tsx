import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { ListChecks, ChevronRight, Eye } from 'lucide-react';

interface PersonnelRow {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  department: { name: string } | null;
}

interface BalanceRow {
  personnelId: string;
  remaining: number;
}

/** HR/Muhasebe/Admin/Yönetici: personel seç, sonra o kişinin izin geçmişine gir. */
export default function LeaveListPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canSeeBalances = hasRole('HR', 'ADMIN');

  const { data: rows } = useQuery<PersonnelRow[]>({
    queryKey: ['leave-list-personnel'],
    queryFn: () => api.get('/leave/list/personnel'),
  });

  // Bakiyeler ayrı bir "Personel İzin Bakiyeleri" sayfası gerektirmesin diye
  // burada, kişi seçme listesinde de gösteriliyor (sadece HR/Admin görebilir).
  const { data: balances } = useQuery<BalanceRow[]>({
    queryKey: ['leave-balances-all'],
    queryFn: () => api.get('/leave/balance/all'),
    enabled: canSeeBalances,
  });

  const year = new Date().getFullYear();
  const downloadPdf = useMutation({
    mutationFn: () => api.openProtectedFile(`/leave/balance/all/pdf?year=${year}`),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Açılamadı'),
  });

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="text-brand-600" />
          <h1 className="text-2xl font-bold text-gray-900">İzin Listesi</h1>
        </div>
        {canSeeBalances && (
          <button
            onClick={() => downloadPdf.mutate()}
            disabled={downloadPdf.isPending}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Eye size={16} /> PDF Görüntüle
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500">
        İzin geçmişini görmek için bir personel seçin.
      </p>

      <div className="card p-0 divide-y divide-gray-200">
        {!rows ? (
          <p className="p-6 text-center text-gray-500">Yükleniyor...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-gray-500">Görüntülenecek personel yok</p>
        ) : rows.map((r) => (
          <button
            key={r.id}
            onClick={() => navigate(`/leave/list/${r.id}`)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">
                {r.firstName} {r.lastName}
                <span className="text-xs text-gray-400 ml-1">({r.employeeNo})</span>
              </p>
              <p className="text-xs text-gray-500">{r.department?.name ?? '-'}</p>
            </div>
            <div className="flex items-center gap-3">
              {canSeeBalances && (
                <span className="badge bg-brand-50 text-brand-700">
                  {balances?.find((b) => b.personnelId === r.id)?.remaining ?? '-'} gün kaldı
                </span>
              )}
              <ChevronRight className="text-gray-400" size={18} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
