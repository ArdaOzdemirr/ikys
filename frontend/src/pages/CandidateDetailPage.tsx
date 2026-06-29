import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import {
  Mail, Phone, Calendar, Briefcase, FileText, MessageSquare,
  UserCheck, Star, ArrowLeft, Plus,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'APPLIED', label: 'Başvurdu', color: 'bg-gray-100 text-gray-800' },
  { value: 'SCREENING', label: 'Ön Eleme', color: 'bg-blue-100 text-blue-800' },
  { value: 'INTERVIEW', label: 'Mülakat', color: 'bg-purple-100 text-purple-800' },
  { value: 'OFFER', label: 'Teklif', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIRED', label: 'İşe Alındı', color: 'bg-green-100 text-green-800' },
  { value: 'REJECTED', label: 'Reddedildi', color: 'bg-red-100 text-red-800' },
];

export default function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showHireForm, setShowHireForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ interviewer: '', notes: '', rating: 5 });

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => api.get(`/recruitment/candidates/${id}`),
    enabled: !!id,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-all'],
    queryFn: () => api.get('/company/departments'),
  });

  const { data: positions } = useQuery({
    queryKey: ['positions-all'],
    queryFn: () => api.get('/company/positions'),
  });

  const { data: personnel } = useQuery({
    queryKey: ['personnel-managers'],
    queryFn: () => api.get('/personnel', { limit: 1000 }),
  });

  const [hireForm, setHireForm] = useState({
    employeeNo: '',
    tcKimlikNo: '',
    departmentId: '',
    positionId: '',
    managerId: '',
    hireDate: new Date().toISOString().split('T')[0],
    contractType: 'PERMANENT',
    grossSalary: '',
    password: 'Welcome123!',
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/recruitment/candidates/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Durum güncellendi');
      qc.invalidateQueries({ queryKey: ['candidate', id] });
    },
  });

  const addNote = useMutation({
    mutationFn: () =>
      api.post(`/recruitment/candidates/${id}/notes`, {
        interviewer: noteForm.interviewer,
        notes: noteForm.notes,
        rating: noteForm.rating,
      }),
    onSuccess: () => {
      toast.success('Mülakat notu eklendi');
      qc.invalidateQueries({ queryKey: ['candidate', id] });
      setShowNoteForm(false);
      setNoteForm({ interviewer: '', notes: '', rating: 5 });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const hire = useMutation({
    mutationFn: () => {
      const payload: any = {
        employeeNo: hireForm.employeeNo,
        tcKimlikNo: hireForm.tcKimlikNo,
        hireDate: hireForm.hireDate,
        contractType: hireForm.contractType,
        password: hireForm.password,
      };
      if (hireForm.departmentId) payload.departmentId = hireForm.departmentId;
      if (hireForm.positionId) payload.positionId = hireForm.positionId;
      if (hireForm.managerId) payload.managerId = hireForm.managerId;
      if (hireForm.grossSalary) payload.grossSalary = +hireForm.grossSalary;
      return api.post(`/recruitment/candidates/${id}/hire`, payload);
    },
    onSuccess: () => {
      toast.success('Aday başarıyla işe alındı!');
      qc.invalidateQueries({ queryKey: ['candidate', id] });
      qc.invalidateQueries({ queryKey: ['personnel'] });
      setShowHireForm(false);
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Hata'));
    },
  });

  if (isLoading) return <div className="p-8">Yükleniyor...</div>;
  if (!candidate) return <div className="p-8">Aday bulunamadı</div>;

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === candidate.status);
  const filteredPositions = hireForm.departmentId
    ? positions?.filter((p: any) => p.departmentId === hireForm.departmentId)
    : positions;

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <button
        onClick={() => navigate('/recruitment')}
        className="text-brand-600 hover:underline flex items-center gap-1 text-sm"
      >
        <ArrowLeft size={16} /> Aday Listesine Dön
      </button>

      {/* Üst başlık */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-2xl font-bold text-brand-700">
              {candidate.firstName[0]}{candidate.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {candidate.firstName} {candidate.lastName}
              </h1>
              {candidate.jobPosting && (
                <p className="text-gray-600 flex items-center gap-1 mt-1">
                  <Briefcase size={14} />
                  {candidate.jobPosting.title}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Başvuru: {new Date(candidate.appliedAt).toLocaleDateString('tr-TR')}
              </p>
            </div>
          </div>
          <span className={`badge ${currentStatus?.color}`}>{currentStatus?.label}</span>
        </div>
      </div>

      {/* İletişim */}
      <div className="card">
        <h3 className="font-semibold mb-3">İletişim</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-gray-400" />
            <a href={`mailto:${candidate.email}`} className="text-brand-600 hover:underline">
              {candidate.email}
            </a>
          </div>
          {candidate.phone && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-gray-400" />
              <span>{candidate.phone}</span>
            </div>
          )}
          {candidate.linkedinUrl && (
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-gray-400" />
              <a href={candidate.linkedinUrl} target="_blank" className="text-brand-600 hover:underline">
                LinkedIn Profili
              </a>
            </div>
          )}
          {candidate.cvUrl && (
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-gray-400" />
              <a href={candidate.cvUrl} target="_blank" className="text-brand-600 hover:underline">
                CV'yi Görüntüle
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Durum güncelleme */}
      {candidate.status !== 'HIRED' && (
        <div className="card">
          <h3 className="font-semibold mb-3">Durum Değiştir</h3>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.filter((s) => s.value !== 'HIRED').map((s) => (
              <button
                key={s.value}
                onClick={() => updateStatus.mutate(s.value)}
                disabled={candidate.status === s.value}
                className={`badge ${s.color} ${
                  candidate.status === s.value
                    ? 'ring-2 ring-offset-2 ring-brand-600'
                    : 'hover:opacity-80'
                } px-3 py-1 cursor-pointer disabled:cursor-default`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mülakat Notları */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare size={18} />
            Mülakat Notları ({candidate.notes?.length || 0})
          </h3>
          <button
            onClick={() => setShowNoteForm(!showNoteForm)}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Plus size={14} /> Not Ekle
          </button>
        </div>

        {showNoteForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); addNote.mutate(); }}
            className="bg-gray-50 p-4 rounded-lg mb-3 space-y-3"
          >
            <input
              required
              placeholder="Mülakatçı adı"
              value={noteForm.interviewer}
              onChange={(e) => setNoteForm({ ...noteForm, interviewer: e.target.value })}
              className="input"
            />
            <div>
              <label className="block text-sm font-medium mb-1">Puan (1-5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNoteForm({ ...noteForm, rating: r })}
                    className="p-1"
                  >
                    <Star
                      size={24}
                      className={
                        r <= noteForm.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Mülakat değerlendirmesi..."
              value={noteForm.notes}
              onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })}
              className="input"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={addNote.isPending} className="btn-primary">
                Notu Kaydet
              </button>
              <button type="button" onClick={() => setShowNoteForm(false)} className="btn-secondary">
                İptal
              </button>
            </div>
          </form>
        )}

        {candidate.notes && candidate.notes.length > 0 ? (
          <div className="space-y-3">
            {candidate.notes.map((n: any) => (
              <div key={n.id} className="border-l-4 border-brand-500 pl-4 py-2 bg-gray-50 rounded-r">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{n.interviewer}</p>
                  {n.rating && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <Star
                          key={r}
                          size={14}
                          className={
                            r <= n.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  {new Date(n.date).toLocaleString('tr-TR')}
                </p>
                <p className="text-sm whitespace-pre-wrap">{n.notes}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">Henüz mülakat notu yok</p>
        )}
      </div>

      {/* İşe Al */}
      {candidate.status !== 'HIRED' && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2 text-green-900">
              <UserCheck size={20} />
              Adayı İşe Al
            </h3>
            {!showHireForm && (
              <button
                onClick={() => setShowHireForm(true)}
                className="btn-primary flex items-center gap-1"
              >
                <UserCheck size={16} /> İşe Al
              </button>
            )}
          </div>

          {showHireForm && (
            <form
              onSubmit={(e) => { e.preventDefault(); hire.mutate(); }}
              className="space-y-3"
            >
              <p className="text-sm text-gray-700 mb-3">
                Bu işlem adayı çalışana çevirir: User kaydı + Personnel kaydı + (opsiyonel) maaş tanımı yapılır.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Sicil No *</label>
                  <input
                    required
                    placeholder="EMP-0010"
                    value={hireForm.employeeNo}
                    onChange={(e) => setHireForm({ ...hireForm, employeeNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">TC Kimlik No *</label>
                  <input
                    required
                    maxLength={11}
                    placeholder="11 hane"
                    value={hireForm.tcKimlikNo}
                    onChange={(e) => setHireForm({ ...hireForm, tcKimlikNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">İşe Giriş Tarihi *</label>
                  <input
                    required
                    type="date"
                    value={hireForm.hireDate}
                    onChange={(e) => setHireForm({ ...hireForm, hireDate: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sözleşme Tipi</label>
                  <select
                    value={hireForm.contractType}
                    onChange={(e) => setHireForm({ ...hireForm, contractType: e.target.value })}
                    className="input"
                  >
                    <option value="PERMANENT">Belirsiz Süreli</option>
                    <option value="TEMPORARY">Belirli Süreli</option>
                    <option value="PARTTIME">Yarı Zamanlı</option>
                    <option value="INTERN">Stajyer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Departman</label>
                  <select
                    value={hireForm.departmentId}
                    onChange={(e) => setHireForm({ ...hireForm, departmentId: e.target.value, positionId: '' })}
                    className="input"
                  >
                    <option value="">Seçiniz</option>
                    {departments?.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pozisyon</label>
                  <select
                    value={hireForm.positionId}
                    onChange={(e) => setHireForm({ ...hireForm, positionId: e.target.value })}
                    className="input"
                    disabled={!hireForm.departmentId}
                  >
                    <option value="">Seçiniz</option>
                    {filteredPositions?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Yönetici</label>
                  <select
                    value={hireForm.managerId}
                    onChange={(e) => setHireForm({ ...hireForm, managerId: e.target.value })}
                    className="input"
                  >
                    <option value="">Yok</option>
                    {personnel?.data?.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Brüt Maaş (opsiyonel)</label>
                  <input
                    type="number"
                    placeholder="örn: 60000"
                    value={hireForm.grossSalary}
                    onChange={(e) => setHireForm({ ...hireForm, grossSalary: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Geçici Şifre</label>
                  <input
                    value={hireForm.password}
                    onChange={(e) => setHireForm({ ...hireForm, password: e.target.value })}
                    className="input"
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Çalışan ilk girişte değiştirmesi önerilir
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-green-200">
                <button
                  type="submit"
                  disabled={hire.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {hire.isPending ? 'İşleniyor...' : '✓ İşe Al ve Çalışan Kaydı Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowHireForm(false)}
                  className="btn-secondary"
                >
                  İptal
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
