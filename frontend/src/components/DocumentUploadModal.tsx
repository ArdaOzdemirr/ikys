import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { X, Upload, FileText, Trash2, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  personnelId: string;
  personnelName?: string;
}

const DOCUMENT_TYPES = [
  { value: 'diploma', label: 'Diploma' },
  { value: 'kimlik', label: 'Kimlik' },
  { value: 'ikametgah', label: 'İkametgah' },
  { value: 'sozlesme', label: 'İş Sözleşmesi' },
  { value: 'sgk', label: 'SGK Belgesi' },
  { value: 'saglik_raporu', label: 'Sağlık Raporu' },
  { value: 'cv', label: 'CV' },
  { value: 'fotograf', label: 'Vesikalık' },
  { value: 'diger', label: 'Diğer' },
];

export default function DocumentUploadModal({ open, onClose, personnelId, personnelName }: Props) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [docType, setDocType] = useState('diploma');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = hasRole('ADMIN', 'HR');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', personnelId],
    queryFn: () => api.get(`/documents/personnel/${personnelId}`),
    enabled: open,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Dosya seçilmedi');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docType);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/v1/documents/upload/${personnelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Yükleme başarısız');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Belge yüklendi');
      qc.invalidateQueries({ queryKey: ['documents', personnelId] });
      qc.invalidateQueries({ queryKey: ['personnel', personnelId] });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: any) => toast.error(e.message || 'Hata'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      toast.success('Belge silindi');
      qc.invalidateQueries({ queryKey: ['documents', personnelId] });
      qc.invalidateQueries({ queryKey: ['personnel', personnelId] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="text-brand-600" />
              Dijital Arşiv
            </h2>
            {personnelName && (
              <p className="text-sm text-gray-600">{personnelName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Yükleme formu (sadece HR/Admin) */}
          {canManage && (
            <div className="card bg-brand-50 border-brand-200">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Upload size={16} />
                Yeni Belge Yükle
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Belge Türü</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="input"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dosya (PDF, Word, Resim - max 10MB)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="input"
                  />
                  {file && (
                    <p className="text-xs text-gray-600 mt-1">
                      Seçildi: {file.name} ({(file.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>
                <button
                  onClick={() => upload.mutate()}
                  disabled={!file || upload.isPending}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {upload.isPending ? 'Yükleniyor...' : 'Yükle'}
                </button>
              </div>
            </div>
          )}

          {/* Belge listesi */}
          <div>
            <h3 className="font-semibold mb-3">
              Mevcut Belgeler ({documents?.length || 0})
            </h3>
            {isLoading ? (
              <p className="text-gray-500 text-sm">Yükleniyor...</p>
            ) : !documents || documents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Henüz belge yok
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((d: any) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <FileText className="text-brand-600 flex-shrink-0" size={20} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{d.fileName}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="badge bg-blue-100 text-blue-800">
                          {DOCUMENT_TYPES.find((t) => t.value === d.type)?.label || d.type}
                        </span>
                        <span>{(d.fileSize / 1024).toFixed(0)} KB</span>
                        <span>{new Date(d.uploadedAt).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:bg-brand-50 p-2 rounded"
                      title="Görüntüle/İndir"
                    >
                      <Download size={16} />
                    </a>
                    {canManage && (
                      <button
                        onClick={() => {
                          if (confirm(`"${d.fileName}" belgesini silmek istediğinize emin misiniz?`)) {
                            remove.mutate(d.id);
                          }
                        }}
                        disabled={remove.isPending}
                        className="text-red-600 hover:bg-red-50 p-2 rounded disabled:opacity-50"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
