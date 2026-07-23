import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { X, UserCog } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  personnelId: string;
  personnel: any;
}

const CONTRACT_TYPES: { value: string; label: string }[] = [
  { value: 'PERMANENT', label: 'Belirsiz Süreli (Kadrolu)' },
  { value: 'TEMPORARY', label: 'Belirli Süreli' },
  { value: 'PARTTIME', label: 'Yarı Zamanlı' },
  { value: 'INTERN', label: 'Stajyer' },
  { value: 'CONSULTANT', label: 'Danışman' },
];

export default function PersonnelEditModal({ open, onClose, personnelId, personnel }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    phone: '',
    birthDate: '',
    hireDate: '',
    contractType: 'PERMANENT',
  });

  useEffect(() => {
    if (personnel && open) {
      setForm({
        phone: personnel.phone || '',
        birthDate: personnel.birthDate ? personnel.birthDate.split('T')[0] : '',
        hireDate: personnel.hireDate ? personnel.hireDate.split('T')[0] : '',
        contractType: personnel.contractType || 'PERMANENT',
      });
    }
  }, [personnel, open]);

  const save = useMutation({
    mutationFn: (data: any) => api.patch(`/personnel/${personnelId}`, data),
    onSuccess: () => {
      toast.success('Personel bilgileri güncellendi');
      qc.invalidateQueries({ queryKey: ['personnel', personnelId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <UserCog className="text-brand-600" />
            <h2 className="text-xl font-bold">Personel Bilgilerini Düzenle</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
          className="p-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doğum Tarihi</label>
            <input
              type="date"
              className="input"
              value={form.birthDate}
              onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İşe Giriş Tarihi</label>
            <input
              type="date"
              className="input"
              value={form.hireDate}
              onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sözleşme Tipi</label>
            <select
              className="input"
              value={form.contractType}
              onChange={(e) => setForm({ ...form, contractType: e.target.value })}
            >
              {CONTRACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <button type="submit" disabled={save.isPending} className="btn-primary disabled:opacity-50">
              {save.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">İptal</button>
          </div>
        </form>
      </div>
    </div>
  );
}
