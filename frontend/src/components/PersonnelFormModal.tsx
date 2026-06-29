import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PersonnelFormModal({ open, onClose }: Props) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    employeeNo: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    tcKimlikNo: '',
    phone: '',
    departmentId: '',
    positionId: '',
    managerId: '',
    contractType: 'PERMANENT',
    hireDate: new Date().toISOString().split('T')[0],
    role: 'EMPLOYEE',
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/company/departments'),
    enabled: open,
  });

  const { data: positions } = useQuery({
    queryKey: ['positions', form.departmentId],
    queryFn: () => api.get('/company/positions', { departmentId: form.departmentId }),
    enabled: open && !!form.departmentId,
  });

  const { data: personnel } = useQuery({
    queryKey: ['personnel-list-managers'],
    queryFn: () => api.get('/personnel', { limit: 1000 }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: (data: any) => {
      // Boş string olan opsiyonel alanları temizle
      const cleaned: any = {};
      Object.keys(data).forEach((k) => {
        if (data[k] !== '' && data[k] !== null && data[k] !== undefined) {
          cleaned[k] = data[k];
        }
      });
      return api.post('/personnel', cleaned);
    },
    onSuccess: () => {
      toast.success('Personel başarıyla eklendi');
      qc.invalidateQueries({ queryKey: ['personnel'] });
      qc.invalidateQueries({ queryKey: ['org-chart'] });
      onClose();
      setForm({
        employeeNo: '', email: '', password: '', firstName: '', lastName: '',
        tcKimlikNo: '', phone: '', departmentId: '', positionId: '', managerId: '',
        contractType: 'PERMANENT',
        hireDate: new Date().toISOString().split('T')[0],
        role: 'EMPLOYEE',
      });
    },
    onError: (e: any) => {
      const msg = e.response?.data?.message;
      if (Array.isArray(msg)) toast.error(msg.join(', '));
      else toast.error(msg || 'Personel eklenemedi');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-bold">Yeni Personel Ekle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}
          className="p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Sicil No *" required>
              <input
                value={form.employeeNo}
                onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                className="input"
                placeholder="EMP-0003"
                required
              />
            </Field>

            <Field label="TC Kimlik No *" required>
              <input
                value={form.tcKimlikNo}
                onChange={(e) => setForm({ ...form, tcKimlikNo: e.target.value })}
                className="input"
                placeholder="11 hane"
                maxLength={11}
                required
              />
            </Field>

            <Field label="Ad *" required>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="input"
                required
              />
            </Field>

            <Field label="Soyad *" required>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="input"
                required
              />
            </Field>

            <Field label="E-posta *" required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                required
              />
            </Field>

            <Field label="Geçici Şifre *" required>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder="Min 8 karakter"
                minLength={8}
                required
              />
            </Field>

            <Field label="Telefon">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
                placeholder="+90 5xx xxx xx xx"
              />
            </Field>

            <Field label="İşe Giriş Tarihi *" required>
              <input
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                className="input"
                required
              />
            </Field>

            <Field label="Departman">
              <select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value, positionId: '' })}
                className="input"
              >
                <option value="">Seçiniz</option>
                {departments?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Pozisyon">
              <select
                value={form.positionId}
                onChange={(e) => setForm({ ...form, positionId: e.target.value })}
                className="input"
                disabled={!form.departmentId}
              >
                <option value="">Seçiniz</option>
                {positions?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </Field>

            <Field label="Yönetici">
              <select
                value={form.managerId}
                onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                className="input"
              >
                <option value="">Yok</option>
                {personnel?.data?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.employeeNo})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sözleşme Tipi">
              <select
                value={form.contractType}
                onChange={(e) => setForm({ ...form, contractType: e.target.value })}
                className="input"
              >
                <option value="PERMANENT">Belirsiz Süreli</option>
                <option value="TEMPORARY">Belirli Süreli</option>
                <option value="PARTTIME">Yarı Zamanlı</option>
                <option value="INTERN">Stajyer</option>
                <option value="CONSULTANT">Danışman</option>
              </select>
            </Field>

            <Field label="Sistem Rolü">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="input"
              >
                <option value="EMPLOYEE">Çalışan</option>
                <option value="MANAGER">Yönetici</option>
                <option value="HR">İK</option>
                <option value="ACCOUNTING">Muhasebe</option>
                <option value="ADMIN">Admin</option>
              </select>
            </Field>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button
              type="submit"
              disabled={create.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {create.isPending ? 'Ekleniyor...' : 'Personeli Ekle'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required: _required, children }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
