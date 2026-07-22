import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ShieldCheck, ShieldOff, KeyRound, FileText, Upload, Wallet, Edit, Save } from 'lucide-react';
import SalaryConfigModal from '../components/SalaryConfigModal';
import DocumentUploadModal from '../components/DocumentUploadModal';

export default function ProfilePage() {
  const { user, logout, canManagePayroll } = useAuth();
  const qc = useQueryClient();
  const [showSalary, setShowSalary] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const { data: p } = useQuery<any>({
    queryKey: ['personnel-me'],
    queryFn: () => api.get('/personnel/me'),
  });

  const closeModals = () => {
    setShowSalary(false);
    setShowDocs(false);
    qc.invalidateQueries({ queryKey: ['personnel-me'] });
  };

  // === Kişisel iletişim bilgileri (kendi güncelleyebileceği alanlar) ===
  const [contactForm, setContactForm] = useState({ phone: '', address: '', emergencyContact: '' });
  useEffect(() => {
    if (p) {
      setContactForm({
        phone: p.phone || '',
        address: p.address || '',
        emergencyContact: p.emergencyContact || '',
      });
    }
  }, [p]);

  const saveContact = useMutation({
    mutationFn: () => api.patch('/personnel/me', contactForm),
    onSuccess: () => {
      toast.success('İletişim bilgileri güncellendi');
      qc.invalidateQueries({ queryKey: ['personnel-me'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  // === Şifre değiştirme ===
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const changePwd = useMutation({
    mutationFn: () =>
      api.post('/auth/change-password', {
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      }),
    onSuccess: () => {
      toast.success('Şifre değiştirildi. Tekrar giriş yapın.');
      setTimeout(() => logout(), 1500);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  // === 2FA ===
  const [setupData, setSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [verifyToken, setVerifyToken] = useState('');

  const setup2FA = useMutation({
    mutationFn: () => api.post('/auth/2fa/setup'),
    onSuccess: (data) => {
      setSetupData(data);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const verify2FA = useMutation({
    mutationFn: () => api.post('/auth/2fa/verify', { token: verifyToken }),
    onSuccess: () => {
      toast.success('2FA başarıyla aktif edildi 🔐');
      setSetupData(null);
      setVerifyToken('');
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Kod hatalı'),
  });

  const disable2FA = useMutation({
    mutationFn: () => api.post('/auth/2fa/disable'),
    onSuccess: () => {
      toast.success('2FA kapatıldı');
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profilim</h1>
        <p className="text-gray-600 text-sm">Kişisel bilgiler, bordro/belge ve hesap güvenliği</p>
      </div>

      {/* Hesap bilgileri */}
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
            <span className="text-brand-700 font-bold">{user?.email?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {p ? `${p.firstName} ${p.lastName}` : user?.email}
            </p>
            <p className="text-sm text-gray-500">
              {p ? `${p.position?.title ?? '-'} · ${p.department?.name ?? '-'}` : `Rol: ${user?.role}`}
            </p>
          </div>
        </div>
      </div>

      {p && (
        <>
          {/* Kişisel Bilgiler */}
          <div className="card">
            <h3 className="font-semibold mb-4">Kişisel Bilgiler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Sicil No" value={p.employeeNo} />
              <Field label="E-posta" value={p.user?.email} />
              <Field label="İşe Giriş" value={new Date(p.hireDate).toLocaleDateString('tr-TR')} />
              <Field
                label="Yönetici"
                value={p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : '-'}
              />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); saveContact.mutate(); }}
              className="space-y-3 border-t border-gray-100 pt-4"
            >
              <p className="text-xs text-gray-500">Aşağıdaki bilgileri kendiniz güncelleyebilirsiniz:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Telefon</label>
                  <input
                    className="input"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Acil Durum İletişim</label>
                  <input
                    className="input"
                    value={contactForm.emergencyContact}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyContact: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Adres</label>
                  <input
                    className="input"
                    value={contactForm.address}
                    onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" disabled={saveContact.isPending} className="btn-secondary flex items-center gap-2 text-sm">
                <Save size={14} /> {saveContact.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </form>
          </div>

          {/* Dijital Arşiv */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="text-brand-600" />
                <h3 className="font-semibold">Belgelerim</h3>
                <span className="badge bg-gray-100 text-gray-700">{p.documents?.length || 0} belge</span>
              </div>
              <button
                onClick={() => setShowDocs(true)}
                className="btn-secondary flex items-center gap-1 text-sm"
              >
                <Upload size={14} />
                Belgeleri Görüntüle
              </button>
            </div>
            {p.documents && p.documents.length > 0 ? (
              <ul className="space-y-2">
                {p.documents.slice(0, 3).map((d: any) => (
                  <li key={d.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <FileText className="text-brand-600" size={16} />
                    <span className="text-sm flex-1 truncate">{d.fileName}</span>
                    <span className="badge bg-blue-100 text-blue-800 text-xs">{d.type}</span>
                  </li>
                ))}
                {p.documents.length > 3 && (
                  <li className="text-xs text-center text-gray-500 pt-1">
                    ve {p.documents.length - 3} belge daha...
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">Henüz belge yüklenmemiş.</p>
            )}
          </div>

          {/* Maaş / Bordro */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="text-brand-600" />
                <h3 className="font-semibold">Maaş Bilgilerim</h3>
              </div>
              {canManagePayroll && (
                <button
                  onClick={() => setShowSalary(true)}
                  className="btn-secondary flex items-center gap-1 text-sm"
                >
                  <Edit size={14} />
                  {p.salaryConfig ? 'Düzenle' : 'Maaş Tanımla'}
                </button>
              )}
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
              <p className="text-gray-500 text-sm">Henüz maaş tanımı yok.</p>
            )}
            <a href="/payroll" className="text-sm text-brand-600 hover:underline mt-4 inline-block">
              Bordrolarımı görüntüle →
            </a>
          </div>

          <SalaryConfigModal
            open={showSalary}
            onClose={closeModals}
            personnelId={p.id}
            personnelName={`${p.firstName} ${p.lastName}`}
          />
          <DocumentUploadModal
            open={showDocs}
            onClose={closeModals}
            personnelId={p.id}
            personnelName={`${p.firstName} ${p.lastName}`}
          />
        </>
      )}

      {/* Şifre değiştirme */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="text-brand-600" />
          <h3 className="font-semibold">Şifre Değiştir</h3>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pwForm.newPassword !== pwForm.confirmPassword) {
              toast.error('Yeni şifreler eşleşmiyor');
              return;
            }
            if (pwForm.newPassword.length < 8) {
              toast.error('Yeni şifre en az 8 karakter olmalı');
              return;
            }
            changePwd.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Mevcut Şifre</label>
            <input
              type="password"
              required
              value={pwForm.oldPassword}
              onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Yeni Şifre (min 8 karakter)</label>
            <input
              type="password"
              required
              minLength={8}
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Yeni Şifre Tekrar</label>
            <input
              type="password"
              required
              minLength={8}
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              className="input"
            />
          </div>
          <p className="text-xs text-gray-500">
            ⚠️ Şifre değiştirdikten sonra tekrar giriş yapmanız istenir.
          </p>
          <button type="submit" disabled={changePwd.isPending} className="btn-primary">
            {changePwd.isPending ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
          </button>
        </form>
      </div>

      {/* 2FA */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="text-brand-600" />
          <h3 className="font-semibold">İki Aşamalı Doğrulama (2FA)</h3>
        </div>

        {setupData ? (
          // 2FA kurulum modu
          <div className="space-y-4">
            <div className="bg-brand-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-800 mb-2">📱 Adım 1: QR Kodu Tarayın</p>
              <p className="text-xs text-gray-600 mb-3">
                Google Authenticator, Microsoft Authenticator veya Authy gibi bir uygulamayla
                aşağıdaki QR kodu tarayın.
              </p>
              <div className="bg-white p-3 rounded inline-block">
                <img src={setupData.qrCode} alt="2FA QR" className="w-48 h-48" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                QR taranamıyor mu? Manuel kod:{' '}
                <code className="bg-white px-2 py-0.5 rounded font-mono text-xs">
                  {setupData.secret}
                </code>
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">
                🔢 Adım 2: Uygulamadaki 6 haneli kodu girin
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, ''))}
                  className="input font-mono text-center text-lg tracking-widest"
                  placeholder="000000"
                  autoFocus
                />
                <button
                  onClick={() => verify2FA.mutate()}
                  disabled={verifyToken.length !== 6 || verify2FA.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  Doğrula
                </button>
              </div>
              <button
                onClick={() => { setSetupData(null); setVerifyToken(''); }}
                className="text-sm text-gray-500 hover:underline mt-2"
              >
                İptal
              </button>
            </div>
          </div>
        ) : (
          // 2FA normal görünüm
          <div>
            <p className="text-sm text-gray-600 mb-4">
              2FA aktif olduğunda, her girişte şifrenize ek olarak Authenticator uygulamanızdan
              gelen 6 haneli kodu da girmeniz gerekir. Bu hesabınıza ek güvenlik katmanı ekler.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setup2FA.mutate()} className="btn-primary flex items-center gap-2">
                <ShieldCheck size={16} />
                2FA Kur / Yeniden Kur
              </button>
              <button
                onClick={() => {
                  if (confirm('2FA\'yı kapatmak istediğinize emin misiniz? Bu hesabınızın güvenliğini düşürür.')) {
                    disable2FA.mutate();
                  }
                }}
                className="btn-secondary flex items-center gap-2"
              >
                <ShieldOff size={16} />
                2FA'yı Kapat
              </button>
            </div>
          </div>
        )}
      </div>
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
