import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ListChecks, ChevronRight } from 'lucide-react';

interface PersonnelRow {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  department: { name: string } | null;
}

/** HR/Muhasebe/Admin/Yönetici: personel seç, sonra o kişinin izin geçmişine gir. */
export default function LeaveListPage() {
  const navigate = useNavigate();

  const { data: rows } = useQuery<PersonnelRow[]>({
    queryKey: ['leave-list-personnel'],
    queryFn: () => api.get('/leave/list/personnel'),
  });

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <ListChecks className="text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900">İzin Listesi</h1>
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
            <ChevronRight className="text-gray-400" size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
