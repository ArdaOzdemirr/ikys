import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { api } from '../services/api';
import { ArrowLeft, CalendarDays } from 'lucide-react';

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

function formatRange(startDate: string, endDate: string, totalDays: number) {
  const s = new Date(startDate).toLocaleDateString('tr-TR');
  const e = new Date(endDate).toLocaleDateString('tr-TR');
  return `${s} / ${e} arası izinli · ${totalDays} gün`;
}

/** HR/Admin: tek bir personelin yıllık izin hakedişi + aldığı tüm izin tarihleri. */
export default function LeaveBalanceDetailPage() {
  const { personnelId } = useParams();
  const navigate = useNavigate();
  const [month, setMonth] = useState(''); // "" = tüm aylar, aksi halde "YYYY-MM"

  // Aynı sorgu anahtarı: liste sayfasından geldiyse veriyi tekrar çekmez.
  const { data: rows } = useQuery<Row[]>({
    queryKey: ['leave-balances-all'],
    queryFn: () => api.get('/leave/balance/all'),
  });

  const row = rows?.find((r) => r.personnelId === personnelId);

  if (!rows) {
    return <div className="p-8 text-gray-500">Yükleniyor...</div>;
  }
  if (!row) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-gray-500">Personel bulunamadı.</p>
        <button onClick={() => navigate('/leave/balances')} className="btn-secondary">Geri dön</button>
      </div>
    );
  }

  const filtered = row.takenLeaves.filter((l) => !month || l.startDate.slice(0, 7) === month);

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <button
        onClick={() => navigate('/leave/balances')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Personel listesine dön
      </button>

      <div className="flex items-center gap-2">
        <CalendarDays className="text-brand-600" />
        <h1 className="text-2xl font-bold text-gray-900">{row.firstName} {row.lastName}</h1>
      </div>
      <p className="text-sm text-gray-500">
        {row.department ?? '-'} · İşe Giriş: {new Date(row.hireDate).toLocaleDateString('tr-TR')}
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{row.totalEntitled}</p>
          <p className="text-xs text-gray-500 mt-1">Toplam Hak</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-900">{row.used}</p>
          <p className="text-xs text-gray-500 mt-1">Kullanılan</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-brand-700">{row.remaining}</p>
          <p className="text-xs text-gray-500 mt-1">Kalan</p>
        </div>
      </div>

      <div className="card p-0">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold">Aldığı İzinler</h3>
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
        <div className="divide-y divide-gray-200">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-gray-500">
              {month ? 'Bu ayda izin yok.' : 'Hiç yıllık izin kullanmamış.'}
            </p>
          ) : filtered.map((l) => (
            <p key={l.id} className="px-4 py-3 text-sm text-gray-700">
              {formatRange(l.startDate, l.endDate, l.totalDays)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
