import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import { Briefcase, MapPin, Calendar, Building2, Send, CheckCircle } from 'lucide-react';

export default function PublicJobsPage() {
  const [selectedPosting, setSelectedPosting] = useState<any | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cvUrl: '',
    linkedinUrl: '',
    source: 'website',
  });

  const { data: postings, isLoading } = useQuery({
    queryKey: ['public-postings'],
    queryFn: () => api.get('/recruitment/postings', { active: 'true' }),
  });

  const apply = useMutation({
    mutationFn: () => {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        source: form.source,
      };
      if (form.phone) payload.phone = form.phone;
      if (form.cvUrl) payload.cvUrl = form.cvUrl;
      if (form.linkedinUrl) payload.linkedinUrl = form.linkedinUrl;
      if (selectedPosting) payload.jobPostingId = selectedPosting.id;

      return api.post('/recruitment/candidates', payload);
    },
    onSuccess: () => {
      setSuccess(true);
      setForm({
        firstName: '', lastName: '', email: '', phone: '',
        cvUrl: '', linkedinUrl: '', source: 'website',
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Başvuru gönderilemedi'),
  });

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Başvurunuz Alındı! 🎉
          </h2>
          <p className="text-gray-600 mb-6">
            Başvurunuz İK ekibimize ulaştı. En kısa sürede sizinle iletişime geçeceğiz.
          </p>
          <button
            onClick={() => { setSuccess(false); setSelectedPosting(null); }}
            className="btn-primary w-full"
          >
            Başka Bir İlana Başvur
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Kariyer Fırsatları</h1>
          <p className="text-gray-600">
            Açık pozisyonlarımıza göz atın ve hayalinizdeki işe başvurun
          </p>
        </div>

        {selectedPosting ? (
          // BAŞVURU FORMU
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setSelectedPosting(null)}
              className="text-brand-600 hover:underline mb-4 text-sm"
            >
              ← Tüm İlanlara Dön
            </button>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-2">{selectedPosting.title}</h2>
              {selectedPosting.location && (
                <p className="text-gray-600 mb-4 flex items-center gap-1">
                  <MapPin size={14} /> {selectedPosting.location}
                </p>
              )}
              <div className="prose prose-sm max-w-none mb-6">
                <p className="whitespace-pre-wrap text-sm">{selectedPosting.description}</p>
                {selectedPosting.requirements && (
                  <>
                    <h4 className="font-semibold mt-4">Aranan Nitelikler</h4>
                    <p className="whitespace-pre-wrap text-sm">{selectedPosting.requirements}</p>
                  </>
                )}
              </div>

              <hr className="my-6" />

              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Send size={18} className="text-brand-600" />
                Başvuru Formu
              </h3>

              <form
                onSubmit={(e) => { e.preventDefault(); apply.mutate(); }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Ad *</label>
                    <input
                      required
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Soyad *</label>
                    <input
                      required
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">E-posta *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Telefon</label>
                  <input
                    type="tel"
                    placeholder="+90 5xx xxx xx xx"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CV Linki (opsiyonel)</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={form.cvUrl}
                    onChange={(e) => setForm({ ...form, cvUrl: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">LinkedIn URL (opsiyonel)</label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    value={form.linkedinUrl}
                    onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bizi nereden duydunuz?</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="input"
                  >
                    <option value="website">Web sitesi</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="kariyer_net">Kariyer.net</option>
                    <option value="referans">Arkadaş tavsiyesi</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={apply.isPending}
                  className="btn-primary w-full mt-4 disabled:opacity-50"
                >
                  {apply.isPending ? 'Gönderiliyor...' : 'Başvuruyu Gönder'}
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Başvurarak KVKK kapsamında kişisel verilerinizin işlenmesini kabul etmiş olursunuz.
                </p>
              </form>
            </div>
          </div>
        ) : (
          // İLAN LİSTESİ
          <>
            {isLoading ? (
              <p className="text-center text-gray-500">İlanlar yükleniyor...</p>
            ) : !postings || postings.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-12 text-center">
                <Briefcase className="mx-auto mb-3 text-gray-400" size={48} />
                <h3 className="text-lg font-semibold text-gray-700">Şu an açık ilan yok</h3>
                <p className="text-gray-500 mt-1">Yeni fırsatları kaçırmamak için takipte kalın!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {postings.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPosting(p)}
                    className="bg-white rounded-xl shadow p-6 cursor-pointer hover:shadow-lg transition border-2 border-transparent hover:border-brand-300"
                  >
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{p.title}</h3>
                    {p.location && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                        <MapPin size={14} /> {p.location}
                      </p>
                    )}
                    {p.description && (
                      <p className="text-sm text-gray-600 line-clamp-3 mb-3">{p.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(p.publishedAt).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="text-brand-600 text-sm font-medium">
                        Başvur →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
