import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Briefcase, Plus, X, Users, Clock, CheckCircle, XCircle, Trash2, RefreshCw } from 'lucide-react';

export default function JobPostingsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [form, setForm] = useState({
    title: '',
    description: '',
    requirements: '',
    location: '',
    departmentId: '',
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/company/departments'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['postings', filter],
    queryFn: () => {
      const params: any = {};
      if (filter === 'active') params.active = 'true';
      if (filter === 'closed') params.active = 'false';
      return api.get('/recruitment/postings', params);
    },
  });

  const create = useMutation({
    mutationFn: (d: any) => {
      const cleaned: any = {};
      Object.keys(d).forEach((k) => {
        if (d[k] !== '' && d[k] !== null) cleaned[k] = d[k];
      });
      return api.post('/recruitment/postings', cleaned);
    },
    onSuccess: () => {
      toast.success('İş ilanı oluşturuldu');
      qc.invalidateQueries({ queryKey: ['postings'] });
      setShowForm(false);
      setForm({ title: '', description: '', requirements: '', location: '', departmentId: '' });
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Hata'));
    },
  });

  const close = useMutation({
    mutationFn: (id: string) => api.patch(`/recruitment/postings/${id}/close`, {}),
    onSuccess: () => {
      toast.success('İlan kapatıldı');
      qc.invalidateQueries({ queryKey: ['postings'] });
    },
  });

  const reopen = useMutation({
    mutationFn: (id: string) => api.patch(`/recruitment/postings/${id}`, { isActive: true, closedAt: null }),
    onSuccess: () => {
      toast.success('İlan yeniden açıldı');
      qc.invalidateQueries({ queryKey: ['postings'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/recruitment/postings/${id}`),
    onSuccess: () => {
      toast.success('İlan silindi');
      qc.invalidateQueries({ queryKey: ['postings'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İş İlanları</h1>
          <p className="text-gray-600 text-sm">İlan oluşturma ve yönetimi</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Yeni İlan
        </button>
      </div>

      <div className="flex gap-1 border-b">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="Tümü" />
        <FilterButton active={filter === 'active'} onClick={() => setFilter('active')} label="Aktif" />
        <FilterButton active={filter === 'closed'} onClick={() => setFilter('closed')} label="Kapalı" />
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
          className="card space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Briefcase size={18} />
              Yeni İş İlanı
            </h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Pozisyon Başlığı *</label>
              <input
                required
                placeholder="örn: Senior Backend Developer"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Departman</label>
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="input"
              >
                <option value="">Seçiniz</option>
                {departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lokasyon</label>
              <input
                placeholder="örn: İstanbul / Hibrit"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">İş Tanımı *</label>
              <textarea
                required
                rows={4}
                placeholder="Pozisyonun sorumlulukları, görev tanımı..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Aranan Nitelikler</label>
              <textarea
                rows={3}
                placeholder="Deneyim, teknik beceriler, gereksinimler..."
                value={form.requirements}
                onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <button type="submit" disabled={create.isPending} className="btn-primary">
              {create.isPending ? 'Yayınlanıyor...' : 'İlanı Yayınla'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <p className="text-gray-500">Yükleniyor...</p>
        ) : data?.length === 0 ? (
          <div className="card col-span-full text-center py-12 text-gray-500">
            <Briefcase className="mx-auto mb-2 text-gray-400" />
            İlan bulunamadı
          </div>
        ) : data?.map((p: any) => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{p.title}</h3>
                {p.location && (
                  <p className="text-sm text-gray-600 mt-1">📍 {p.location}</p>
                )}
              </div>
              {p.isActive ? (
                <span className="badge bg-green-100 text-green-800 flex items-center gap-1">
                  <CheckCircle size={12} /> Aktif
                </span>
              ) : (
                <span className="badge bg-gray-100 text-gray-700 flex items-center gap-1">
                  <XCircle size={12} /> Kapalı
                </span>
              )}
            </div>

            {p.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-3">{p.description}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Users size={12} />
                {p._count?.candidates || 0} başvuru
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {new Date(p.publishedAt).toLocaleDateString('tr-TR')}
              </span>
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t">
              {p.isActive ? (
                <button
                  onClick={() => {
                    if (confirm('Bu ilanı kapatmak istediğinize emin misiniz?')) {
                      close.mutate(p.id);
                    }
                  }}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <XCircle size={12} /> Kapat
                </button>
              ) : (
                <button
                  onClick={() => reopen.mutate(p.id)}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Yeniden Aç
                </button>
              )}
              <button
                onClick={() => {
                  const msg = p._count?.candidates > 0
                    ? `Bu ilana ${p._count.candidates} başvuru var. İlanı silerseniz adaylar saklanır ama ilana bağlantıları kopar. Emin misiniz?`
                    : 'Bu ilanı kalıcı olarak silmek istediğinize emin misiniz?';
                  if (confirm(msg)) {
                    remove.mutate(p.id);
                  }
                }}
                disabled={remove.isPending}
                className="btn-danger text-xs flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 size={12} /> Sil
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}
