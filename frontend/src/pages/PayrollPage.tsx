import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Download, FileText } from 'lucide-react';

const MONTHS = ['', 'Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

export default function PayrollPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['payrolls-me'],
    queryFn: () => api.get('/payroll/me'),
  });

  const download = (id: string, year: number, month: number) => {
    api.download(`/payroll/${id}/pdf`, `bordro-${year}-${month}.pdf`);
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Bordrolarım</h1>
      <p className="text-gray-600 text-sm">Aylık bordrolarınızı PDF olarak indirebilirsiniz</p>

      {isLoading ? (
        <div className="text-gray-500">Yükleniyor...</div>
      ) : data?.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="mx-auto text-gray-400 mb-2" size={32} />
          <p className="text-gray-600">Henüz bordronuz yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((p: any) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">{MONTHS[p.month]} {p.year}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {(+p.netSalary).toLocaleString('tr-TR')} ₺
                  </p>
                  <p className="text-xs text-gray-500">Net Ödeme</p>
                </div>
                <FileText className="text-brand-600" />
              </div>

              <div className="space-y-1 text-xs text-gray-600 border-t pt-3 mb-3">
                <div className="flex justify-between">
                  <span>Brüt:</span>
                  <span>{(+p.grossSalary).toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>SGK + Vergi:</span>
                  <span>-{((+p.sgkEmployee + +p.incomeTax + +p.stampTax)).toLocaleString('tr-TR')} ₺</span>
                </div>
                {+p.avansDeduction > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Avans Kesintisi:</span>
                    <span>-{(+p.avansDeduction).toLocaleString('tr-TR')} ₺</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => download(p.id, p.year, p.month)}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Download size={16} />
                PDF İndir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
