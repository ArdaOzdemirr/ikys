import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Building2, Briefcase, Users, Plus, Trash2, Edit, X } from 'lucide-react';

type Tab = 'branches' | 'departments' | 'positions';

export default function CompanyStructurePage() {
  const [tab, setTab] = useState<Tab>('branches');

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Şirket Yapısı</h1>
        <p className="text-gray-600 text-sm">Şube, departman ve pozisyon yönetimi</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <TabButton active={tab === 'branches'} onClick={() => setTab('branches')} icon={Building2} label="Şubeler" />
        <TabButton active={tab === 'departments'} onClick={() => setTab('departments')} icon={Users} label="Departmanlar" />
        <TabButton active={tab === 'positions'} onClick={() => setTab('positions')} icon={Briefcase} label="Pozisyonlar" />
      </div>

      {tab === 'branches' && <BranchesTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'positions' && <PositionsTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

// ============================================================
// ŞUBELER
// ============================================================
function BranchesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', latitude: '', longitude: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/company/branches'),
  });

  const reset = () => {
    setForm({ name: '', city: '', address: '', phone: '', latitude: '', longitude: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      city: b.city || '',
      address: b.address || '',
      phone: b.phone || '',
      latitude: b.latitude != null ? String(b.latitude) : '',
      longitude: b.longitude != null ? String(b.longitude) : '',
    });
    setShowForm(true);
  };

  const save = useMutation({
    mutationFn: (d: typeof form) => {
      const payload = {
        ...d,
        latitude: d.latitude !== '' ? parseFloat(d.latitude) : null,
        longitude: d.longitude !== '' ? parseFloat(d.longitude) : null,
      };
      return editingId
        ? api.patch(`/company/branches/${editingId}`, payload)
        : api.post('/company/branches', payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Şube güncellendi' : 'Şube eklendi');
      qc.invalidateQueries({ queryKey: ['branches'] });
      reset();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/company/branches/${id}`),
    onSuccess: () => {
      toast.success('Şube silindi');
      qc.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Silinemedi'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Şube
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
          className="card space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? 'Şubeyi Düzenle' : 'Yeni Şube'}</h3>
            <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              required
              placeholder="Şube adı"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
            <input
              placeholder="Şehir"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input"
            />
            <input
              placeholder="Telefon"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
            <input
              placeholder="Adres"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
            />
            <input
              placeholder="Enlem (latitude)"
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="input"
            />
            <input
              placeholder="Boylam (longitude)"
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="input"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) {
                toast.error('Tarayıcın konum desteklemiyor');
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (pos) =>
                  setForm((f) => ({
                    ...f,
                    latitude: String(pos.coords.latitude),
                    longitude: String(pos.coords.longitude),
                  })),
                () => toast.error('Konum alınamadı'),
              );
            }}
            className="btn-secondary text-sm"
          >
            📍 Şu anki konumumu kullan
          </button>
          <p className="text-xs text-gray-500">
            Konum girilirse, QR ile mesai girişi/çıkışı bu noktaya 300 metreden uzaktan yapılamaz.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="btn-primary">
              {save.isPending ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
            </button>
            <button type="button" onClick={reset} className="btn-secondary">İptal</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-gray-500">Yükleniyor...</p>
        ) : data?.length === 0 ? (
          <div className="card col-span-full text-center py-8 text-gray-500">
            Henüz şube eklenmemiş
          </div>
        ) : data?.map((b: any) => (
          <div key={b.id} className="card">
            <div className="flex items-start gap-3">
              <div className="bg-brand-100 p-2 rounded-lg">
                <Building2 className="text-brand-600" size={20} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{b.name}</h4>
                <p className="text-sm text-gray-600">{b.city || '-'}</p>
                {b.address && <p className="text-xs text-gray-500 mt-1">{b.address}</p>}
                {b.phone && <p className="text-xs text-gray-500">📞 {b.phone}</p>}
                {b.latitude != null && b.longitude != null ? (
                  <p className="text-xs text-green-600 mt-1">📍 Konum tanımlı (geofence aktif)</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Konum tanımlı değil</p>
                )}
                <p className="text-xs text-brand-600 mt-2">
                  {b.departments?.length || 0} departman
                </p>
                <div className="flex gap-1 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => startEdit(b)} className="btn-secondary text-xs flex items-center gap-1">
                    <Edit size={12} /> Düzenle
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${b.name}" şubesini silmek istediğinize emin misiniz?`)) {
                        remove.mutate(b.id);
                      }
                    }}
                    disabled={remove.isPending}
                    className="btn-danger text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Sil
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DEPARTMANLAR
// ============================================================
function DepartmentsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', branchId: '', parentId: '' });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/company/branches'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/company/departments'),
  });

  const reset = () => {
    setForm({ name: '', code: '', branchId: '', parentId: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (d: any) => {
    setEditingId(d.id);
    setForm({
      name: d.name,
      code: d.code || '',
      branchId: d.branchId,
      parentId: d.parentId || '',
    });
    setShowForm(true);
  };

  const save = useMutation({
    mutationFn: (d: any) => {
      const cleaned: any = {};
      Object.keys(d).forEach((k) => {
        if (d[k] !== '' && d[k] !== null) cleaned[k] = d[k];
      });
      return editingId
        ? api.patch(`/company/departments/${editingId}`, cleaned)
        : api.post('/company/departments', cleaned);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Departman güncellendi' : 'Departman eklendi');
      qc.invalidateQueries({ queryKey: ['departments-all'] });
      qc.invalidateQueries({ queryKey: ['departments'] });
      qc.invalidateQueries({ queryKey: ['branches'] });
      reset();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Hata'));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/company/departments/${id}`),
    onSuccess: () => {
      toast.success('Departman silindi');
      qc.invalidateQueries({ queryKey: ['departments-all'] });
      qc.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Silinemedi'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Departman
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
          className="card space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? 'Departmanı Düzenle' : 'Yeni Departman'}</h3>
            <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Departman Adı *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kod</label>
              <input
                placeholder="örn: DEV"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Şube *</label>
              <select
                required
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="input"
              >
                <option value="">Şube seçin</option>
                {branches?.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Üst Departman (opsiyonel)</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="input"
              >
                <option value="">Yok (en üst seviye)</option>
                {data?.filter((d: any) => d.id !== editingId).map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="btn-primary">
              {save.isPending ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
            </button>
            <button type="button" onClick={reset} className="btn-secondary">İptal</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Kod</th>
              <th className="px-4 py-3">Departman Adı</th>
              <th className="px-4 py-3">Şube</th>
              <th className="px-4 py-3">Üst Departman</th>
              <th className="px-4 py-3">Pozisyon</th>
              <th className="px-4 py-3">Personel</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : data?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Departman yok</td></tr>
            ) : data?.map((d: any) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-700">{d.code || '-'}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {branches?.find((b: any) => b.id === d.branchId)?.name || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{d.parent?.name || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="badge bg-blue-100 text-blue-800">{d.positions?.length || 0}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="badge bg-green-100 text-green-800">{d._count?.personnel || 0}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => startEdit(d)} className="text-brand-600 hover:bg-brand-50 p-1.5 rounded">
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`"${d.name}" departmanını silmek istediğinize emin misiniz?`)) {
                          remove.mutate(d.id);
                        }
                      }}
                      disabled={remove.isPending}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// POZİSYONLAR
// ============================================================
function PositionsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState('');
  const [form, setForm] = useState({ title: '', departmentId: '', level: 1, description: '' });

  const { data: departments } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/company/departments'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['positions-all', filterDept],
    queryFn: () => api.get('/company/positions', filterDept ? { departmentId: filterDept } : undefined),
  });

  const reset = () => {
    setForm({ title: '', departmentId: '', level: 1, description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      departmentId: p.departmentId,
      level: p.level,
      description: p.description || '',
    });
    setShowForm(true);
  };

  const save = useMutation({
    mutationFn: (d: any) => {
      const payload = { ...d, level: +d.level };
      return editingId
        ? api.patch(`/company/positions/${editingId}`, payload)
        : api.post('/company/positions', payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Pozisyon güncellendi' : 'Pozisyon eklendi');
      qc.invalidateQueries({ queryKey: ['positions-all'] });
      qc.invalidateQueries({ queryKey: ['positions'] });
      qc.invalidateQueries({ queryKey: ['departments-all'] });
      reset();
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Hata'));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/company/positions/${id}`),
    onSuccess: () => {
      toast.success('Pozisyon silindi');
      qc.invalidateQueries({ queryKey: ['positions-all'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Silinemedi'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="input max-w-xs"
        >
          <option value="">Tüm departmanlar</option>
          {departments?.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Yeni Pozisyon
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
          className="card space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? 'Pozisyonu Düzenle' : 'Yeni Pozisyon'}</h3>
            <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Pozisyon Adı *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Departman *</label>
              <select
                required
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="input"
              >
                <option value="">Departman seçin</option>
                {departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Seviye (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.level}
                onChange={(e) => setForm({ ...form, level: +e.target.value })}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="btn-primary">
              {save.isPending ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Ekle'}
            </button>
            <button type="button" onClick={reset} className="btn-secondary">İptal</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Pozisyon</th>
              <th className="px-4 py-3">Departman</th>
              <th className="px-4 py-3">Seviye</th>
              <th className="px-4 py-3">Personel</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Yükleniyor...</td></tr>
            ) : data?.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">Pozisyon yok</td></tr>
            ) : data?.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.title}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.department?.name || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <span className="badge bg-purple-100 text-purple-800">L{p.level}</span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="badge bg-green-100 text-green-800">{p._count?.personnel || 0}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => startEdit(p)} className="text-brand-600 hover:bg-brand-50 p-1.5 rounded">
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`"${p.title}" pozisyonunu silmek istediğinize emin misiniz?`)) {
                          remove.mutate(p.id);
                        }
                      }}
                      disabled={remove.isPending}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
