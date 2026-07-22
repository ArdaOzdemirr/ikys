import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Wallet, Edit, FileText, Upload } from 'lucide-react';
import SalaryConfigModal from '../components/SalaryConfigModal';
import DocumentUploadModal from '../components/DocumentUploadModal';
import PersonnelEditModal from '../components/PersonnelEditModal';

export default function PersonnelDetailPage() {
  const { id } = useParams();
  const { hasRole, canManagePayroll } = useAuth();
  const [showSalary, setShowSalary] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ['personnel', id],
    queryFn: () => api.get(`/personnel/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8">Yükleniyor...</div>;
  if (!p) return <div className="p-8">Personel bulunamadı</div>;

  const tcKimlik = hasRole('ADMIN', 'HR')
    ? p.tcKimlikNo
    : `${p.tcKimlikNo?.slice(0, 3)}******${p.tcKimlikNo?.slice(-2)}`;

  const canSeeSalary = canManagePayroll;
  const canEdit = hasRole('ADMIN', 'HR');

  return (
    <div className="p-8 space-y-6">
      <div className="card">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center">
            <span className="text-3xl text-brand-700 font-bold">
              {p.firstName?.[0]}{p.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {p.firstName} {p.lastName}
            </h1>
            <p className="text-gray-600">{p.position?.title} · {p.department?.name}</p>
            <p className="text-sm text-gray-500 mt-1">Sicil: {p.employeeNo}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowEdit(true)}
              className="btn-secondary flex items-center gap-1 text-sm h-fit"
            >
              <Edit size={14} />
              Düzenle
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold mb-4">Kişisel Bilgiler</h3>
          <Field label="TC Kimlik No" value={tcKimlik} />
          <Field label="E-posta" value={p.user?.email} />
          <Field label="Telefon" value={p.phone || '-'} />
          <Field
            label="Doğum Tarihi"
            value={p.birthDate ? new Date(p.birthDate).toLocaleDateString('tr-TR') : '-'}
          />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-4">İş Bilgileri</h3>
          <Field label="İşe Giriş" value={new Date(p.hireDate).toLocaleDateString('tr-TR')} />
          <Field label="Sözleşme Tipi" value={p.contractType} />
          <Field
            label="Yönetici"
            value={p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : '-'}
          />
          <Field label="Durum" value={p.status} />
        </div>
      </div>

      {/* DİJİTAL ARŞİV */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="text-brand-600" />
            <h3 className="font-semibold">Dijital Arşiv</h3>
            <span className="badge bg-gray-100 text-gray-700">{p.documents?.length || 0} belge</span>
          </div>
          <button
            onClick={() => setShowDocs(true)}
            className="btn-secondary flex items-center gap-1 text-sm"
          >
            <Upload size={14} />
            Belgeleri Yönet
          </button>
        </div>

        {p.documents && p.documents.length > 0 ? (
          <ul className="space-y-2">
            {p.documents.slice(0, 3).map((d: any) => (
              <li key={d.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                <FileText className="text-brand-600" size={16} />
                <span className="text-sm flex-1 truncate">{d.fileName}</span>
                <span className="badge bg-blue-100 text-blue-800 text-xs">{d.type}</span>
                <button onClick={() => api.openProtectedFile(d.fileUrl)} className="text-brand-600 hover:underline text-xs">
                  Görüntüle
                </button>
              </li>
            ))}
            {p.documents.length > 3 && (
              <li className="text-xs text-center text-gray-500 pt-1">
                ve {p.documents.length - 3} belge daha...
              </li>
            )}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">
            Henüz belge yüklenmemiş. Diploma, kimlik, sözleşme gibi belgeleri yükleyebilirsiniz.
          </p>
        )}
      </div>

      {/* MAAŞ BİLGİSİ */}
      {canSeeSalary && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="text-brand-600" />
              <h3 className="font-semibold">Maaş Bilgileri</h3>
            </div>
            <button
              onClick={() => setShowSalary(true)}
              className="btn-secondary flex items-center gap-1 text-sm"
            >
              <Edit size={14} />
              {p.salaryConfig ? 'Düzenle' : 'Maaş Tanımla'}
            </button>
          </div>

          {p.salaryConfig ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <SalaryItem label="Brüt Maaş" value={p.salaryConfig.grossSalary} highlight />
              <SalaryItem label="AGİ" value={p.salaryConfig.agi} />
              <SalaryItem label="Yemek" value={p.salaryConfig.mealAllowance} />
              <SalaryItem label="Yol" value={p.salaryConfig.transportAllowance} />
              <SalaryItem label="BES" value={p.salaryConfig.bes} />
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Henüz maaş tanımı yok. Bordro üretebilmek için maaş tanımlamalısınız.
            </p>
          )}
        </div>
      )}

      <SalaryConfigModal
        open={showSalary}
        onClose={() => setShowSalary(false)}
        personnelId={id!}
        personnelName={`${p.firstName} ${p.lastName}`}
      />

      <DocumentUploadModal
        open={showDocs}
        onClose={() => setShowDocs(false)}
        personnelId={id!}
        personnelName={`${p.firstName} ${p.lastName}`}
      />

      <PersonnelEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        personnelId={id!}
        personnel={p}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function SalaryItem({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-brand-50' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`font-bold ${highlight ? 'text-brand-700 text-lg' : 'text-gray-900'}`}>
        {(+value).toLocaleString('tr-TR')} ₺
      </p>
    </div>
  );
}
