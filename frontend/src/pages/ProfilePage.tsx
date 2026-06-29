import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { User, Lock, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();

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

  // 2FA durumu için kendi personnel detay endpoint'inden alalım
  // (User'da twoFactorEnabled var ama doğrudan kullanıcı detayı endpointi yok)
  // Bu yüzden setupData null=henüz aktif değil, varsa kurulum yapılıyor demektir

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
        <p className="text-gray-600 text-sm">Hesap ayarları ve güvenlik</p>
      </div>

      {/* Hesap bilgileri */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
            <span className="text-brand-700 font-bold">{user?.email?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.email}</p>
            <p className="text-sm text-gray-500">Rol: {user?.role}</p>
          </div>
        </div>
      </div>

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
                2FA\'yı Kapat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
