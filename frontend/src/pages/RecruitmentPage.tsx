import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Briefcase, Users, Eye, Upload, FileText, Plus, X } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  APPLIED: { label: 'Başvurdu', color: 'bg-gray-100 text-gray-800' },
  SCREENING: { label: 'Ön Eleme', color: 'bg-blue-100 text-blue-800' },
  INTERVIEW: { label: 'Mülakat', color: 'bg-purple-100 text-purple-800' },
  OFFER: { label: 'Teklif', color: 'bg-yellow-100 text-yellow-800' },
  HIRED: { label: 'İşe Alındı', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Reddedildi', color: 'bg-red-100 text-red-800' },
};

// CV'yi token ile çekip yeni sekmede açar
async function openCv(url: string) {
  try {
    const path = url.replace('/api/v1', '');
    const blob = await api.getBlob(path);
    const objUrl = URL.createObjectURL(blob);
    window.open(objUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
  } catch {
    toast.error('CV açılamadı');
  }
}

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const uploadRef = useRef<{ id: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: postings } = useQuery({
    queryKey: ['postings'],
    queryFn: () => api.get('/recruitment/postings', { active: 'true' }),
  });
  const { data: candidates } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => api.get('/recruitment/candidates'),
  });
  const { data: stats } = useQuery({
    queryKey: ['recruit-stats'],
    queryFn: () => api.get('/recruitment/stats'),
  });

  // Var olan adaya CV yükle
  const uploadCv = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/recruitment/candidates/${id}/cv`, fd);
    },
    onSuccess: () => { toast.success('CV yüklendi'); qc.invalidateQueries({ queryKey: ['candidates'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'CV yüklenemedi'),
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadRef.current) uploadCv.mutate({ id: uploadRef.current.id, file });
    e.target.value = '';
    uploadRef.current = null;
  };

  const triggerUpload = (id: string) => {
    uploadRef.current = { id };
    fileInput.current?.click();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İşe Alım (ATS)</h1>
          <p className="text-gray-600 text-sm">Aday havuzu ve iş ilanları</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1">
          <Plus size={16} /> CV ile Aday Ekle
        </button>
      </div>

      <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden" onChange={onPickFile} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card flex items-center gap-3">
          <Briefcase className="text-brand-600" />
          <div>
            <p className="text-sm text-gray-600">Açık İlan</p>
            <p className="text-2xl font-bold">{stats?.totalActivePostings ?? 0}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Users className="text-green-600" />
          <div>
            <p className="text-sm text-gray-600">Toplam Aday</p>
            <p className="text-2xl font-bold">{candidates?.length ?? 0}</p>
          </div>
        </div>
        {stats?.byStatus?.slice(0, 2).map((s: any) => (
          <div key={s.status} className="card">
            <p className="text-sm text-gray-600">{STATUS_LABELS[s.status]?.label || s.status}</p>
            <p className="text-2xl font-bold">{s._count}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Açık İş İlanları</h3>
        {postings?.length === 0 ? (
          <p className="text-gray-500 text-sm">Açık ilan yok</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {postings?.map((p: any) => (
              <div key={p.id} className="border border-gray-200 rounded-lg p-4 hover:border-brand-500 transition">
                <h4 className="font-semibold text-gray-900">{p.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{p.location}</p>
                <p className="text-xs text-gray-500 mt-2">{p._count?.candidates ?? 0} başvuru</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <h3 className="font-semibold p-4 border-b border-gray-200">Aday Havuzu</h3>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Aday</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Pozisyon</th>
              <th className="px-4 py-3">CV</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {candidates?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Aday yok</td></tr>
            ) : candidates?.map((c: any) => {
              const s = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-gray-100' };
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{c.firstName} {c.lastName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.email}</td>
                  <td className="px-4 py-3 text-sm">{c.jobPosting?.title || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.cvUrl ? (
                      <button onClick={() => openCv(c.cvUrl)} className="text-brand-600 hover:underline inline-flex items-center gap-1">
                        <FileText size={14} /> CV Gör
                      </button>
                    ) : (
                      <button onClick={() => triggerUpload(c.id)} className="text-gray-500 hover:text-brand-600 inline-flex items-center gap-1">
                        <Upload size={14} /> CV Yükle
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className={`badge ${s.color}`}>{s.label}</span></td>
                  <td className="px-4 py-3">
                    <Link to={`/recruitment/candidates/${c.id}`}
                      className="text-brand-600 hover:bg-brand-50 p-1.5 rounded inline-flex" title="Detay">
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddCandidateModal postings={postings || []} onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['candidates'] }); qc.invalidateQueries({ queryKey: ['recruit-stats'] }); }} />
      )}
    </div>
  );
}

function AddCandidateModal({ postings, onClose, onSaved }: { postings: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', source: 'Mail', jobPostingId: '' });
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (file) fd.append('file', file);
      return api.post('/recruitment/candidates/upload', fd);
    },
    onSuccess: () => { toast.success('Aday eklendi'); onSaved(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Eklenemedi'),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.firstName.trim() && form.lastName.trim() && form.email.trim();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">CV ile Aday Ekle</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-500">Mail veya başka yolla gelen CV'leri buradan yükleyip havuza ekleyin.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600">Ad *</label>
            <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Soyad *</label>
            <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-600">E-posta *</label>
          <input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600">Telefon</label>
            <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Kaynak</label>
            <input className="input" value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="Mail, LinkedIn..." />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-600">İlan (opsiyonel)</label>
          <select className="input" value={form.jobPostingId} onChange={(e) => set('jobPostingId', e.target.value)}>
            <option value="">— Genel havuz —</option>
            {postings.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600">CV Dosyası (PDF/Word, max 10MB)</label>
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-600 mt-1" />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={() => save.mutate()} disabled={!canSave || save.isPending}
            className="btn-primary flex-1 disabled:opacity-50">Kaydet</button>
          <button onClick={onClose} className="btn-secondary">Vazgeç</button>
        </div>
      </div>
    </div>
  );
}
