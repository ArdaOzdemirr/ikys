import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Eye, X, Lock, Check } from 'lucide-react';

interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  isPaid: boolean;
  affectsAnnualBalance: boolean;
  defaultVisible: boolean;
  isActive: boolean;
  isSystem: boolean;
  _count?: { requests: number; accesses: number };
}

const empty = {
  code: '', name: '', description: '',
  isPaid: true, affectsAnnualBalance: false, defaultVisible: true, isActive: true,
};

export default function LeaveCategoriesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [visibilityFor, setVisibilityFor] = useState<Category | null>(null);

  const { data: cats } = useQuery<Category[]>({
    queryKey: ['leave-categories'],
    queryFn: () => api.get('/leave/categories'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/categories/${id}`),
    onSuccess: () => { toast.success('Silindi/pasifleştirildi'); qc.invalidateQueries({ queryKey: ['leave-categories'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İzin Kategorileri</h1>
          <p className="text-gray-600 text-sm">Kategori açın, düzenleyin, kişiye özel gizleyin</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary flex items-center gap-1">
          <Plus size={16} /> Yeni Kategori
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Ücret</th>
              <th className="px-4 py-3">Bakiye</th>
              <th className="px-4 py-3">Görünürlük</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cats?.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">
                    {c.name}{' '}
                    {c.isSystem && <span className="badge bg-gray-100 text-gray-500">sistem</span>}
                  </p>
                  <p className="text-xs text-gray-400">{c.code}</p>
                </td>
                <td className="px-4 py-3 text-sm">{c.isPaid ? 'Ücretli' : 'Ücretsiz'}</td>
                <td className="px-4 py-3 text-sm">{c.affectsAnnualBalance ? 'Düşer' : '-'}</td>
                <td className="px-4 py-3 text-sm">
                  {c.defaultVisible ? 'Herkese açık' : 'Varsayılan gizli'}
                  {c._count?.accesses ? ` (+${c._count.accesses} istisna)` : ''}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setVisibilityFor(c)} title="Kişiye özel görünürlük"
                      className="text-gray-400 hover:text-brand-600"><Eye size={16} /></button>
                    <button onClick={() => setEditing(c)} title="Düzenle"
                      className="text-gray-400 hover:text-brand-600"><Pencil size={16} /></button>
                    {!c.isSystem && (
                      <button onClick={() => del.mutate(c.id)} title="Sil"
                        className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <CategoryModal cat={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {visibilityFor && <VisibilityModal cat={visibilityFor} onClose={() => setVisibilityFor(null)} />}
    </div>
  );
}

function CategoryModal({ cat, onClose }: { cat: Category | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(cat ? { ...cat } : { ...empty });
  const isNew = !cat;

  const save = useMutation({
    mutationFn: () => {
      if (isNew) {
        return api.post('/leave/categories', {
          code: form.code, name: form.name, description: form.description,
          isPaid: form.isPaid, affectsAnnualBalance: form.affectsAnnualBalance,
          defaultVisible: form.defaultVisible,
        });
      }
      return api.patch(`/leave/categories/${cat!.id}`, {
        name: form.name, description: form.description,
        isPaid: form.isPaid, affectsAnnualBalance: form.affectsAnnualBalance,
        defaultVisible: form.defaultVisible, isActive: form.isActive,
      });
    },
    onSuccess: () => {
      toast.success(isNew ? 'Kategori açıldı' : 'Güncellendi');
      qc.invalidateQueries({ queryKey: ['leave-categories'] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const canSave = form.name?.trim() && (isNew ? form.code?.trim() : true);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{isNew ? 'Yeni Kategori' : 'Kategoriyi Düzenle'}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {isNew && (
          <div>
            <label className="text-sm text-gray-600">Kod (ör. DOGUM_GUNU)</label>
            <input className="input" value={form.code} onChange={(e) => set('code', e.target.value)} />
          </div>
        )}
        <div>
          <label className="text-sm text-gray-600">Ad</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-600">Açıklama</label>
          <input className="input" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={form.isPaid}
            onChange={(e) => set('isPaid', e.target.checked)} /> Ücretli izin
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={form.affectsAnnualBalance}
            onChange={(e) => set('affectsAnnualBalance', e.target.checked)} /> Yıllık bakiyeden düşer
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-brand-600" checked={form.defaultVisible}
            onChange={(e) => set('defaultVisible', e.target.checked)} /> Varsayılan herkese açık
        </label>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand-600" checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)} /> Aktif
          </label>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={() => save.mutate()} disabled={!canSave || save.isPending}
            className="btn-primary flex-1 disabled:opacity-50">Kaydet</button>
          <button onClick={onClose} className="btn-secondary">Vazgeç</button>
        </div>
      </div>
    </div>
  );
}

function VisibilityModal({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: personnel } = useQuery<any>({
    queryKey: ['personnel-flat'],
    queryFn: () => api.get('/personnel', { limit: 200 }),
  });
  const { data: overrides } = useQuery<any[]>({
    queryKey: ['cat-visibility', cat.id],
    queryFn: () => api.get(`/leave/categories/${cat.id}/visibility`),
  });

  const setVis = useMutation({
    mutationFn: (v: { personnelId: string; visible: boolean }) =>
      api.put(`/leave/categories/${cat.id}/visibility`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cat-visibility', cat.id] }),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });
  const clearVis = useMutation({
    mutationFn: (personnelId: string) => api.delete(`/leave/categories/${cat.id}/visibility/${personnelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cat-visibility', cat.id] }),
  });

  const overrideMap = new Map<string, boolean>((overrides || []).map((o: any) => [o.personnelId, o.visible]));
  const list = (personnel?.data || []).filter((p: any) => {
    const s = `${p.firstName} ${p.lastName} ${p.employeeNo}`.toLowerCase();
    return s.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Kişiye Özel Görünürlük</h3>
            <p className="text-sm text-gray-500">{cat.name} · varsayılan {cat.defaultVisible ? 'açık' : 'gizli'}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <input className="input" placeholder="Personel ara..." value={search}
          onChange={(e) => setSearch(e.target.value)} />

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
          {list.map((p: any) => {
            const ov = overrideMap.get(p.id); // undefined = varsayılan
            const effective = ov === undefined ? cat.defaultVisible : ov;
            return (
              <div key={p.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-gray-400">
                    {p.employeeNo}
                    {ov === undefined ? ' · varsayılan' : ' · istisna'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVis.mutate({ personnelId: p.id, visible: true })}
                    className={`badge flex items-center gap-1 ${effective ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    <Check size={12} /> Açık
                  </button>
                  <button
                    onClick={() => setVis.mutate({ personnelId: p.id, visible: false })}
                    className={`badge flex items-center gap-1 ${!effective ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    <Lock size={12} /> Gizli
                  </button>
                  {ov !== undefined && (
                    <button onClick={() => clearVis.mutate(p.id)} title="İstisnayı kaldır"
                      className="text-gray-400 hover:text-gray-700"><X size={14} /></button>
                  )}
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Personel bulunamadı</p>}
        </div>
      </div>
    </div>
  );
}
