import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar, Clock, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage() {
  const { user, hasRole } = useAuth();

  const isAdminOrHr = hasRole('ADMIN', 'HR');

  const { data: personnel } = useQuery({
    queryKey: ['personnel-list'],
    queryFn: () => api.get('/personnel', { limit: 1000 }),
    enabled: isAdminOrHr,
  });

  const { data: balance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => api.get('/leave/balance/me'),
    enabled: hasRole('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN', 'ACCOUNTING'),
  });

  const { data: myLeaves } = useQuery({
    queryKey: ['leave-me'],
    queryFn: () => api.get('/leave/requests/me'),
  });

  const { data: kvkkStats } = useQuery({
    queryKey: ['kvkk-stats'],
    queryFn: () => api.get('/kvkk/stats'),
    enabled: hasRole('ADMIN'),
  });

  // Personel istatistikleri
  const personnelStats = personnel?.data
    ? [
        { name: 'Aktif', value: personnel.data.filter((p: any) => p.status === 'ACTIVE').length },
        { name: 'Ayrılan', value: personnel.data.filter((p: any) => p.status === 'RESIGNED').length },
        { name: 'Askıda', value: personnel.data.filter((p: any) => p.status === 'SUSPENDED').length },
      ]
    : [];

  // Departman dağılımı
  const deptDist = personnel?.data
    ? Object.entries(
        personnel.data.reduce((acc: any, p: any) => {
          const name = p.department?.name || 'Atanmamış';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hoş geldiniz, {user?.email}</h1>
        <p className="text-gray-600">İK Yönetim Sistemi - Genel Görünüm</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdminOrHr && (
          <StatCard
            label="Toplam Personel"
            value={personnel?.total || 0}
            icon={Users}
            color="bg-blue-500"
          />
        )}
        <StatCard
          label="Yıllık İzin (Kalan)"
          value={
            balance?.find((b: any) => b.type === 'ANNUAL')?.remainingDays ?? '-'
          }
          icon={Calendar}
          color="bg-green-500"
        />
        <StatCard
          label="Bekleyen Talep"
          value={myLeaves?.filter((l: any) => l.status === 'PENDING').length ?? 0}
          icon={Clock}
          color="bg-orange-500"
        />
        {hasRole('ADMIN') && (
          <StatCard
            label="Son 24h Aktivite"
            value={kvkkStats?.last24hActions ?? 0}
            icon={TrendingUp}
            color="bg-purple-500"
          />
        )}
      </div>

      {/* Charts */}
      {isAdminOrHr && personnel?.data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Personel Durumu</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={personnelStats}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Departman Dağılımı</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={deptDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {deptDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Son izin talepleri */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Son İzin Taleplerim</h3>
        {myLeaves && myLeaves.length > 0 ? (
          <div className="space-y-2">
            {myLeaves.slice(0, 5).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{leaveTypeLabel(l.type)}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(l.startDate).toLocaleDateString('tr-TR')} -{' '}
                    {new Date(l.endDate).toLocaleDateString('tr-TR')} ({l.totalDays} gün)
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Henüz izin talebiniz yok</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`${color} p-3 rounded-lg text-white`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: any = {
    PENDING: { color: 'bg-yellow-100 text-yellow-800', label: 'Beklemede' },
    APPROVED: { color: 'bg-green-100 text-green-800', label: 'Onaylandı' },
    REJECTED: { color: 'bg-red-100 text-red-800', label: 'Reddedildi' },
    CANCELLED: { color: 'bg-gray-100 text-gray-700', label: 'İptal' },
  };
  const c = config[status] || { color: 'bg-gray-100', label: status };
  return <span className={`badge ${c.color}`}>{c.label}</span>;
}

function leaveTypeLabel(type: string): string {
  return {
    ANNUAL: 'Yıllık İzin', HALF_DAY: 'Yarım Gün', HOURLY: 'Saatlik',
    EXCUSE: 'Mazeret', SICK: 'Sağlık', MATERNITY: 'Doğum',
    PATERNITY: 'Babalık', MARRIAGE: 'Evlilik', BEREAVEMENT: 'Vefat', UNPAID: 'Ücretsiz',
  }[type] || type;
}
