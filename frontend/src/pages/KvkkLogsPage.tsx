import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useState } from 'react';
import { Shield, Filter } from 'lucide-react';

export default function KvkkLogsPage() {
  const [filters, setFilters] = useState({ entity: '', action: '', userId: '' });
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['kvkk-logs', filters, page],
    queryFn: () => api.get('/kvkk/logs', { ...filters, page, limit: 50 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['kvkk-stats'],
    queryFn: () => api.get('/kvkk/stats'),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="text-brand-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KVKK Audit Log</h1>
          <p className="text-gray-600 text-sm">Kim, neyi, ne zaman görüntüledi/değiştirdi</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">Toplam Log</p>
          <p className="text-2xl font-bold">{stats?.totalLogs ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Aktif Kullanıcı</p>
          <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Son 24 Saat</p>
          <p className="text-2xl font-bold">{stats?.last24hActions ?? 0}</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} />
          <h3 className="font-semibold">Filtreler</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Entity (personnel, payroll...)"
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
            className="input"
          />
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="input"
          >
            <option value="">Tüm aksiyonlar</option>
            <option value="CREATE">CREATE</option>
            <option value="READ">READ</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
          </select>
          <input
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            className="input"
          />
        </div>
      </div>

      {/* Log Listesi */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Zaman</th>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">Aksiyon</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Log bulunamadı</td></tr>
            ) : data?.data?.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs font-mono">
                  {new Date(log.timestamp).toLocaleString('tr-TR')}
                </td>
                <td className="px-4 py-3 text-xs">{log.user?.email || log.userId || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${actionColor(log.action)}`}>{log.action}</span>
                </td>
                <td className="px-4 py-3">{log.entity}</td>
                <td className="px-4 py-3 text-xs text-gray-600 font-mono">{log.ipAddress || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 50 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Toplam {data.total} kayıt - Sayfa {data.page}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              Önceki
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={data.data.length < 50}
              className="btn-secondary disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function actionColor(action: string): string {
  return ({
    CREATE: 'bg-green-100 text-green-800',
    READ: 'bg-blue-100 text-blue-800',
    UPDATE: 'bg-yellow-100 text-yellow-800',
    DELETE: 'bg-red-100 text-red-800',
    LOGIN: 'bg-purple-100 text-purple-800',
    LOGOUT: 'bg-gray-100 text-gray-800',
  } as any)[action] || 'bg-gray-100 text-gray-800';
}
