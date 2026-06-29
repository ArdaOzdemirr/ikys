import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { X, Wallet } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  personnelId: string;
  personnelName?: string;
}

export default function SalaryConfigModal({ open, onClose, personnelId, personnelName }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    grossSalary: 0,
    agi: 0,
    mealAllowance: 0,
    transportAllowance: 0,
    bes: 0,
  });

  // Personel detayında mevcut maaş varsa onu yükle
  const { data: personnel } = useQuery({
    queryKey: ['personnel', personnelId],
    queryFn: () => api.get(`/personnel/${personnelId}`),
    enabled: open && !!personnelId,
  });

  useEffect(() => {
    if (personnel?.salaryConfig) {
      setForm({
        grossSalary: +personnel.salaryConfig.grossSalary,
        agi: +personnel.salaryConfig.agi,
        mealAllowance: +personnel.salaryConfig.mealAllowance,
        transportAllowance: +personnel.salaryConfig.transportAllowance,
        bes: +personnel.salaryConfig.bes,
      });
    } else {
      setForm({ grossSalary: 0, agi: 0, mealAllowance: 0, transportAllowance: 0, bes: 0 });
    }
  }, [personnel, open]);

  const save = useMutation({
    mutationFn: (data: any) => api.post(`/payroll/salary/${personnelId}`, data),
    onSuccess: () => {
      toast.success('Maaş bilgisi kaydedildi');
      qc.invalidateQueries({ queryKey: ['personnel', personnelId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  if (!open) return null;

  // Yaklaşık net tahmin (basit gösterim için)
  const approxDeduction = form.grossSalary * 0.20; // ~%20 toplam kesinti
  const approxNet = form.grossSalary - approxDeduction + form.mealAllowance + form.transportAllowance + form.agi;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Wallet className="text-brand-600" />
            <h2 className="text-xl font-bold">Maaş Tanımla</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {personnelName && (
          <div className="px-5 pt-4 text-sm text-gray-600">
            Personel: <strong>{personnelName}</strong>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="p-5 space-y-4">
          <NumField
            label="Brüt Maaş (TL) *"
            value={form.grossSalary}
            onChange={(v) => setForm({ ...form, grossSalary: v })}
            required
          />
          <NumField
            label="AGİ - Asgari Geçim İndirimi"
            value={form.agi}
            onChange={(v) => setForm({ ...form, agi: v })}
          />
          <NumField
            label="Yemek Yardımı (aylık)"
            value={form.mealAllowance}
            onChange={(v) => setForm({ ...form, mealAllowance: v })}
          />
          <NumField
            label="Yol Yardımı (aylık)"
            value={form.transportAllowance}
            onChange={(v) => setForm({ ...form, transportAllowance: v })}
          />
          <NumField
            label="BES (Bireysel Emeklilik)"
            value={form.bes}
            onChange={(v) => setForm({ ...form, bes: v })}
          />

          {form.grossSalary > 0 && (
            <div className="bg-brand-50 rounded-lg p-3 text-sm">
              <p className="text-gray-600 mb-1">Yaklaşık Net (tahmini):</p>
              <p className="text-2xl font-bold text-brand-700">
                ~{approxNet.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Gerçek net, bordro üretildiğinde vergi dilimleri ve birikimli matraha göre hesaplanır
              </p>
            </div>
          )}

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

function NumField({ label, value, onChange, required }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          step={0.01}
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="input pr-12"
          required={required}
          placeholder="0"
        />
        <span className="absolute right-3 top-2 text-gray-400 text-sm">₺</span>
      </div>
    </div>
  );
}
