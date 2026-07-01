import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Clock, MapPin, Smartphone, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function QrAttendancePage() {
  const { hasRole } = useAuth();
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Saat
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // QR kod - sabit, sadece bir kere çekilir
  const { data: qrData, refetch } = useQuery({
    queryKey: ['qr-code'],
    queryFn: () => api.get('/attendance/qr-code'),
    enabled: hasRole('ADMIN'),
  });

  useEffect(() => {
    if (qrData) {
      // QR kod görüntüsü oluştur (içeriği: code string'i, frontend bunu okuyup
      // /attendance/check-in endpoint'ine gönderecek)
      const payload = JSON.stringify({
        type: 'IKYS_ATTENDANCE',
        code: qrData.code,
        validUntil: qrData.validUntil,
      });
      QRCode.toDataURL(payload, {
        width: 500,
        margin: 2,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      }).then(setQrImage);
    }
  }, [qrData]);

  if (!hasRole('ADMIN')) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Bu sayfa sadece Admin için.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔐 QR Mesai Sistemi
          </h1>
          <p className="text-gray-600">
            Çalışanlar telefonlarıyla QR kodu okutarak mesaiye giriş yapabilir
          </p>
        </div>

        {/* Saat */}
        <div className="card mb-6 text-center bg-gradient-to-r from-brand-600 to-brand-700 text-white">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Clock size={28} />
            <h2 className="text-2xl font-semibold">
              {now.toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h2>
          </div>
          <p className="text-5xl font-mono font-bold">
            {now.toLocaleTimeString('tr-TR')}
          </p>
        </div>

        {/* QR + Talimatlar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR Kod */}
          <div className="card text-center">
            <h3 className="font-semibold mb-4 flex items-center justify-center gap-2">
              <Smartphone size={20} className="text-brand-600" />
              QR Kodu Tarayın
            </h3>
            {qrImage ? (
              <div>
                <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                  <img src={qrImage} alt="QR Kod" className="w-full max-w-xs mx-auto" />
                </div>
                <button
                  onClick={() => refetch()}
                  className="btn-secondary mt-3 text-sm flex items-center gap-1 mx-auto"
                >
                  <RefreshCw size={14} />
                  Manuel Yenile
                </button>
              </div>
            ) : (
              <div className="py-12 text-gray-500">QR yükleniyor...</div>
            )}
          </div>

          {/* Talimatlar */}
          <div className="card">
            <h3 className="font-semibold mb-4">Nasıl Kullanılır?</h3>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="bg-brand-100 text-brand-700 rounded-full w-7 h-7 flex items-center justify-center font-bold flex-shrink-0">
                  1
                </span>
                <p>Çalışan, telefondan İKYS uygulamasına giriş yapar</p>
              </li>
              <li className="flex gap-3">
                <span className="bg-brand-100 text-brand-700 rounded-full w-7 h-7 flex items-center justify-center font-bold flex-shrink-0">
                  2
                </span>
                <p>"Mesai" sayfasına gidip "QR ile Giriş" seçer</p>
              </li>
              <li className="flex gap-3">
                <span className="bg-brand-100 text-brand-700 rounded-full w-7 h-7 flex items-center justify-center font-bold flex-shrink-0">
                  3
                </span>
                <p>Kamera ile bu ekrandaki QR kodu okutur</p>
              </li>
              <li className="flex gap-3">
                <span className="bg-brand-100 text-brand-700 rounded-full w-7 h-7 flex items-center justify-center font-bold flex-shrink-0">
                  4
                </span>
                <p>Sistem giriş saatini ve lokasyonu otomatik kaydeder</p>
              </li>
            </ol>

            <div className="mt-5 pt-5 border-t space-y-2 text-xs text-gray-600">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 text-brand-600 flex-shrink-0" />
                <p>
                  <strong>Lokasyon Bazlı:</strong> Çalışanın GPS konumu kaydedilir,
                  ofiste olup olmadığı doğrulanır
                </p>
              </div>
              <div className="flex items-start gap-2">
                <RefreshCw size={14} className="mt-0.5 text-brand-600 flex-shrink-0" />
                <p>
                  <strong>Sabit QR:</strong> Bu şubeye ait QR kod değişmez,
                  yazdırıp asabilirsiniz
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          💡 Bu ekranı ofis girişinde bir tablete veya monitöre koyabilirsiniz
        </div>
      </div>
    </div>
  );
}
