import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Lock, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token2FA, setToken2FA] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password, requires2FA ? token2FA : undefined, rememberMe);
      if (res.requires2FA) {
        setRequires2FA(true);
        toast('2FA kodu girin', { icon: '🔐' });
      } else {
        toast.success('Giriş başarılı');
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">İKYS</h1>
          <p className="text-gray-600 mt-1">İnsan Kaynakları Yönetim Sistemi</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="ornek@firma.com"
                  disabled={requires2FA}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                  disabled={requires2FA}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-brand-600"
              />
              Beni hatırla
            </label>

            {requires2FA && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">2FA Kodu</label>
                <div className="relative">
                  <ShieldCheck size={18} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={token2FA}
                    onChange={(e) => setToken2FA(e.target.value)}
                    className="input pl-10"
                    placeholder="6 haneli kod"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Authenticator uygulamasından kodu girin
                </p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          🔒 Verileriniz KVKK uyumlu olarak işlenmektedir
        </p>
      </div>
    </div>
  );
}
