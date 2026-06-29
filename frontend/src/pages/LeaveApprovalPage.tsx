import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Check, X, ArrowUpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';

const catName = (r: any) => r.category?.name || r.type || 'İzin';

export default function LeaveApprovalPage() {
  const qc = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  // İlk yıl izinlerinde son onayda ücretli/ücretsiz seçimi
  const [payDecision, setPayDecision] = useState<any | null>(null);

  const { data: pending } = useQuery<any[]>({
    queryKey: ['leave-pending'],
    queryFn: () => api.get('/leave/requests/pending'),
  });

  const decide = useMutation({
    mutationFn: ({ id, approved, rejectionReason, paymentType }: any) =>
      api.patch(`/leave/requests/${id}/approve`, {
        approved,
        rejectionReason,
        paymentType,
      }),
    onSuccess: () => {
      toast.success('İşlem tamamlandı');
      qc.invalidateQueries({ queryKey: ['leave-pending'] });
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
      setRejectId(null);
      setReason('');
      setPayDecision(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  // Onayla butonu: son adım + ilk yıl ise önce ödeme tipini sor
  const onApprove = (r: any) => {
    if (r.isFinalStep && r.requiresPaymentDecision) {
      setPayDecision(r);
    } else {
      decide.mutate({ id: r.id, approved: true });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">İzin Onayları</h1>
      <p className="text-gray-600 text-sm">
        {pending?.length ?? 0} bekleyen talep · yalnızca onay sırası sizde olanlar listelenir
      </p>

      {pending?.length === 0 ? (
        <div className="card text-center py-12">
          <Check className="mx-auto text-green-500 mb-2" size={32} />
          <p className="text-gray-600">Onay bekleyen talep yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending?.map((r: any) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      {r.personnel.firstName} {r.personnel.lastName}{' '}
                      <span className="text-xs text-gray-500">
                        ({r.personnel.employeeNo})
                      </span>
                    </p>
                    {r.totalSteps > 1 && (
                      <span className="badge bg-brand-50 text-brand-700">
                        Onay adımı {r.stepOrder}/{r.totalSteps}
                      </span>
                    )}
                    {!r.isFinalStep && (
                      <span className="badge bg-gray-100 text-gray-600">
                        Onaylarsanız bir üst amire iletilir
                      </span>
                    )}
                    {r.requiresPaymentDecision && (
                      <span className="badge bg-amber-50 text-amber-700">
                        Ücretli/ücretsiz kararı gerekli
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>{catName(r)}</strong> · {r.totalDays} gün ·{' '}
                    {new Date(r.startDate).toLocaleDateString('tr-TR')} -{' '}
                    {new Date(r.endDate).toLocaleDateString('tr-TR')}
                  </p>
                  {r.reason && (
                    <p className="text-sm text-gray-500 mt-2">"{r.reason}"</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onApprove(r)}
                    className="btn-primary flex items-center gap-1"
                  >
                    {r.isFinalStep ? <Check size={16} /> : <ArrowUpCircle size={16} />}
                    {r.isFinalStep ? 'Onayla' : 'Onayla ve ilet'}
                  </button>
                  <button
                    onClick={() => setRejectId(r.id)}
                    className="btn-danger flex items-center gap-1"
                  >
                    <X size={16} /> Reddet
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Red gerekçesi */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-lg mb-3">Red Gerekçesi</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              rows={4}
              placeholder="Neden reddediliyor?"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() =>
                  decide.mutate({ id: rejectId, approved: false, rejectionReason: reason })
                }
                disabled={!reason.trim()}
                className="btn-danger flex-1 disabled:opacity-50"
              >
                Reddet
              </button>
              <button
                onClick={() => { setRejectId(null); setReason(''); }}
                className="btn-secondary"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İlk yıl: ücretli / ücretsiz kararı */}
      {payDecision && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-lg mb-1">Ödeme Tipi Kararı</h3>
            <p className="text-sm text-gray-600 mb-4">
              {payDecision.personnel.firstName} {payDecision.personnel.lastName} için yıllık izin
              bakiyesi yeterli değil (ilk yıl veya bakiye bitmiş olabilir). Bu izni ücretli mi
              ücretsiz mi onaylıyorsunuz? Ücretli onaylarsanız gerekirse gelecek yıl bakiyesinden
              düşülür.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  decide.mutate({ id: payDecision.id, approved: true, paymentType: 'PAID' })
                }
                className="btn-primary flex-1"
              >
                Ücretli onayla
              </button>
              <button
                onClick={() =>
                  decide.mutate({ id: payDecision.id, approved: true, paymentType: 'UNPAID' })
                }
                className="btn-secondary flex-1"
              >
                Ücretsiz onayla
              </button>
            </div>
            <button
              onClick={() => setPayDecision(null)}
              className="text-sm text-gray-500 mt-3 w-full text-center"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
