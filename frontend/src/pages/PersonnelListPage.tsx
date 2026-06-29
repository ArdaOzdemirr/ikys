import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Search, UserPlus, Eye, UserMinus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import PersonnelFormModal from '../components/PersonnelFormModal';

export default function PersonnelListPage() {
  const { hasRole, user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [resignTarget, setResignTarget] = useState<any | null>(null);
  const [resignForm, setResignForm] = useState({
    resignDate: new Date().toISOString().split('T')[0],
    resignReason: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['personnel', search, status, page],
    queryFn: () => api.get('/personnel', { search, status, page, limit: 20 }),
  });

  const resign = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/personnel/${id}/resign`, data),
    onSuccess: () => {
      toast.success('Personel işten çıkarıldı');
      qc.invalidateQueries({ queryKey: ['personnel'] });
      setResignTarget(null);
      setResignForm({
        resignDate: new Date().toISOString().split('T')[0],
        resignReason: '',
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/personnel/${id}`),
    onSuccess: () => {
      toast.success('Personel kalıcı olarak silindi');
      qc.invalidateQueries({ queryKey: ['personnel'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Silinemedi'),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personel Yönetimi</h1>
          <p className="text-gray-600 text-sm">Toplam {data?.total ?? 0} personel</p>
        </div>
        {hasRole('ADMIN', 'HR') && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <UserPlus size={18} />
            Yeni Personel
          </button>
        )}
      </div>

      <PersonnelFormModal open={showAdd} onClose={() => setShowAdd(false)} />

      <div className="card mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="İsim veya sicil no ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="RESIGNED">Ayrılmış</option>
            <option value="SUSPENDED">Askıda</option>
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase">
              <th className="px-4 py-3">Sicil</th>
              <th className="px-4 py-3">Ad Soyad</th>
              <th className="px-4 py-3">Departman</th>
              <th className="px-4 py-3">Pozisyon</th>
              <th className="px-4 py-3">İşe Giriş</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Personel bulunamadı</td></tr>
            ) : (
              data?.data?.map((p: any) => {
                const isSelf = p.user?.email === user?.email;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{p.employeeNo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {p.firstName} {p.lastName}
                      {isSelf && (
                        <span className="ml-2 badge bg-blue-100 text-blue-800 text-xs">Siz</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.department?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.position?.title || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(p.hireDate).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-4 py-3"><PersonnelStatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/personnel/${p.id}`}
                          className="text-brand-600 hover:bg-brand-50 p-1.5 rounded"
                          title="Görüntüle"
                        >
                          <Eye size={16} />
                        </Link>
                        {hasRole('ADMIN', 'HR') && p.status === 'ACTIVE' && !isSelf && (
                          <button
                            onClick={() => setResignTarget(p)}
                            className="text-orange-600 hover:bg-orange-50 p-1.5 rounded"
                            title="İşten Çıkar"
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                        {hasRole('ADMIN') && !isSelf && (
                          <button
                            onClick={() => {
                              const msg =
                                `"${p.firstName} ${p.lastName}" personelini KALICI olarak silmek istediğinize emin misiniz?\n\n` +
                                `⚠️ Bu işlem geri alınamaz. Personelin tüm verisi (mesai, izin, bordro, masraf, belgeler) DB'den silinecek.\n\n` +
                                `Öneri: KVKK uyumu için "İşten Çıkar" özelliğini tercih edin (kayıt korunur, sadece pasif olur).`;
                              if (confirm(msg)) {
                                remove.mutate(p.id);
                              }
                            }}
                            disabled={remove.isPending}
                            className="text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-50"
                            title="Kalıcı Sil (sadece Admin)"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600">
            Sayfa {data.page} / {data.totalPages}
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
              disabled={page >= data.totalPages}
              className="btn-secondary disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      {/* İşten Çıkar Modalı */}
      {resignTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-5 border-b">
              <h3 className="text-lg font-bold">İşten Çıkar</h3>
              <p className="text-sm text-gray-600 mt-1">
                {resignTarget.firstName} {resignTarget.lastName}
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resign.mutate({ id: resignTarget.id, data: resignForm });
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Ayrılış Tarihi *</label>
                <input
                  type="date"
                  required
                  value={resignForm.resignDate}
                  onChange={(e) => setResignForm({ ...resignForm, resignDate: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ayrılış Sebebi *</label>
                <textarea
                  required
                  rows={3}
                  value={resignForm.resignReason}
                  onChange={(e) => setResignForm({ ...resignForm, resignReason: e.target.value })}
                  className="input"
                  placeholder="örn: İstifa, performans, dönemsel..."
                />
              </div>
              <div className="bg-orange-50 p-3 rounded-lg text-xs text-orange-800">
                💡 Bu işlem yumuşak silmedir. Personelin tüm geçmiş verileri (bordro, izin, mesai)
                korunur. Hesap pasifleşir, sisteme giriş yapamaz.
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <button
                  type="submit"
                  disabled={resign.isPending}
                  className="btn-danger flex-1 disabled:opacity-50"
                >
                  {resign.isPending ? 'İşleniyor...' : 'İşten Çıkar'}
                </button>
                <button
                  type="button"
                  onClick={() => setResignTarget(null)}
                  className="btn-secondary"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonnelStatusBadge({ status }: { status: string }) {
  const config: any = {
    ACTIVE: { color: 'bg-green-100 text-green-800', label: 'Aktif' },
    RESIGNED: { color: 'bg-gray-100 text-gray-700', label: 'Ayrıldı' },
    SUSPENDED: { color: 'bg-yellow-100 text-yellow-800', label: 'Askıda' },
  };
  const c = config[status] || { color: 'bg-gray-100', label: status };
  return <span className={`badge ${c.color}`}>{c.label}</span>;
}
