import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface Node {
  id: string;
  firstName: string;
  lastName: string;
  position?: { title: string };
  department?: { name: string };
  children: Node[];
}

export default function OrgChartPage() {
  const { data, isLoading } = useQuery<Node[]>({
    queryKey: ['org-chart'],
    queryFn: () => api.get('/personnel/org-chart'),
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Organizasyon Şeması</h1>
      <p className="text-gray-600 text-sm mb-6">Otomatik hiyerarşi görünümü</p>

      {isLoading ? (
        <div className="text-gray-500">Yükleniyor...</div>
      ) : (
        <div className="card">
          {data && data.length > 0 ? (
            <div className="space-y-4">
              {data.map((root) => <TreeNode key={root.id} node={root} level={0} />)}
            </div>
          ) : (
            <p className="text-gray-500">Organizasyon yapısı boş</p>
          )}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, level }: { node: Node; level: number }) {
  return (
    <div style={{ marginLeft: level * 24 }}>
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-brand-50 to-transparent rounded-lg border-l-4 border-brand-500">
        <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
          <span className="text-brand-700 font-bold text-sm">
            {node.firstName[0]}{node.lastName[0]}
          </span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">
            {node.firstName} {node.lastName}
          </p>
          <p className="text-xs text-gray-600">
            {node.position?.title || 'Pozisyonsuz'} · {node.department?.name || '-'}
          </p>
        </div>
        {node.children.length > 0 && (
          <span className="badge bg-blue-100 text-blue-800">{node.children.length} kişi</span>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((c) => <TreeNode key={c.id} node={c} level={level + 1} />)}
        </div>
      )}
    </div>
  );
}
