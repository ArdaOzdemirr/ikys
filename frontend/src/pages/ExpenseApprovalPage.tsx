import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X, Receipt, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ExpenseApprovalPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAccounting = hasRole('ACCOUNTING', 'HR');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: pending } = useQuery({
    queryKey: ['expenses-pending'],
    queryFn: () => api.get('/payroll/expenses/pending'),
  });

  const { data: approvedUnpaid } = useQuery({
    queryKey: ['expenses-approved-unpaid'],
    queryFn: () => api.get('/payroll/expenses/approved-unpaid'),
    enabled: isAccounting,
  });

  const decide = useMutation({
    mutationFn: ({ id, approved, rejectionReason }: any) =>
      api.patch(`/payroll/expenses/${id}/approve`, { approved, rejectionReason }),
    onSuccess: () => {
      toast.success('İşlem tamamlandı');
      qc.invalidateQueries({ queryKey: ['expenses-pending'] });
      setRejectId(null);
      setReason('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  const pay = useMutation({
    mutationFn: (id: string) => api.patch(`/payroll/expenses/${id}/pay`),
    onSuccess: () => {
      toast.success('Ödeme işaretlendi');
      qc.invalidateQueries({ queryKey: ['expenses-approved-unpaid'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Hata'),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="text-brand-600" size={26} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Masraf Onayları</h1>
          <p className="text-gray-600 text-sm">{pending?.length ?? 0} bekleyen masraf talebi</p>
        </div>
      </div>

      {pending?.length === 0 ? (
        <div className="card text-center py-12">
          <Check className="mx-auto text-green-500 mb-2" size={32} />
          <p className="text-gray-600">Onay bekleyen masraf yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending?.map((e: any) => (
            <div key={e.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900">
                      {e.personnel.firstName} {e.personnel.lastName}
                    </p>
                    <span className="text-xs text-gray-500">({e.personnel.employeeNo})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2">
                    <span className="badge bg-blue-100 text-blue-800">{e.category}</span>
                    <span>{new Date(e.date).toLocaleDateString('tr-TR')}</span>
                    <span className="font-bold text-lg text-gray-900">
                      {(+e.amount).toLocaleString('tr-TR')} {e.currency}
                    </span>
                  </div>
                  {e.description && (
                    <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                      {e.description}
                    </p>
                  )}
                  {e.receiptUrl && (
                    <button
                      type="button"
                      onClick={() => api.openProtectedFile(e.receiptUrl).catch(() => toast.error('Dosya açılamadı'))}
                      className="text-xs text-brand-600 hover:underline mt-2 inline-block"
                    >
                      📎 Fiş/Faturayı Gör
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => decide.mutate({ id: e.id, approved: true })}
                    disabled={decide.isPending}
                    className="btn-primary flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check size={16} /> Onayla
                  </button>
                  <button
                    onClick={() => setRejectId(e.id)}
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

      {isAccounting && (
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Wallet className="text-brand-600" size={22} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ödemesi Bekleyenler (Muhasebe)</h2>
              <p className="text-gray-600 text-sm">{approvedUnpaid?.length ?? 0} onaylı, ödemesi bekleyen talep</p>
            </div>
          </div>
          {approvedUnpaid?.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-600">Ödemesi bekleyen talep yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedUnpaid?.map((e: any) => (
                <div key={e.id} className="card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900">
                          {e.personnel.firstName} {e.personnel.lastName}
                        </p>
                        <span className="text-xs text-gray-500">({e.personnel.employeeNo})</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <span className="badge bg-blue-100 text-blue-800">{e.category}</span>
                        <span className="font-bold text-lg text-gray-900">
                          {(+e.amount).toLocaleString('tr-TR')} {e.currency}
                        </span>
                      </div>
                      {e.receiptUrl && (
                        <button
                          type="button"
                          onClick={() => api.openProtectedFile(e.receiptUrl).catch(() => toast.error('Dosya açılamadı'))}
                          className="text-xs text-brand-600 hover:underline mt-1 inline-block"
                        >
                          📎 Fiş/Faturayı Gör
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => pay.mutate(e.id)}
                      disabled={pay.isPending}
                      className="btn-primary flex items-center gap-1 disabled:opacity-50"
                    >
                      <Wallet size={16} /> Öde
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Red modalı */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
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
    </div>
  );
}
