import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
  LayoutDashboard, Users, GitBranch, Clock, Calendar, CheckSquare,
  Wallet, Receipt, Briefcase, Shield, LogOut, Building2, Network,
  UserCircle, FileSpreadsheet, FilePlus, QrCode, CalendarDays, Bell, ListChecks, Tags,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: any;
  roles?: string[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Anasayfa', icon: LayoutDashboard },
  { to: '/personnel', label: 'Personel', icon: Users, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { to: '/company-structure', label: 'Şirket Yapısı', icon: Network, roles: ['ADMIN', 'HR'] },
  { to: '/org-chart', label: 'Organizasyon', icon: GitBranch },
  { to: '/attendance', label: 'Mesai', icon: Clock },
  { to: '/attendance/qr', label: 'QR Mesai Ekranı', icon: QrCode, roles: ['ADMIN'] },
  { to: '/leave', label: 'İzinlerim', icon: Calendar },
  { to: '/leave/approvals', label: 'İzin Onayları', icon: CheckSquare, roles: ['MANAGER', 'HR', 'ADMIN'] },
  { to: '/leave/list', label: 'İzin Listesi', icon: ListChecks, roles: ['MANAGER', 'HR', 'ACCOUNTING', 'ADMIN'] },
  { to: '/leave/categories', label: 'İzin Kategorileri', icon: Tags, roles: ['HR', 'ADMIN'] },
  { to: '/leave/holidays', label: 'Resmi Tatiller', icon: CalendarDays, roles: ['ADMIN', 'HR'] },
  { to: '/payroll', label: 'Bordrolarım', icon: Wallet },
  { to: '/payroll/management', label: 'Bordro Yönetimi', icon: FileSpreadsheet, roles: ['HR', 'ADMIN', 'ACCOUNTING'] },
  { to: '/expenses', label: 'Masraflarım', icon: Receipt },
  { to: '/expenses/approvals', label: 'Masraf Onayları', icon: CheckSquare, roles: ['MANAGER', 'HR', 'ACCOUNTING', 'ADMIN'] },
  { to: '/recruitment', label: 'İşe Alım', icon: Briefcase, roles: ['HR', 'ADMIN', 'MANAGER'] },
  { to: '/recruitment/postings', label: 'İş İlanları', icon: FilePlus, roles: ['HR', 'ADMIN'] },
  { to: '/notifications', label: 'Bildirimler', icon: Bell },
  { to: '/profile', label: 'Profilim', icon: UserCircle },
  { to: '/kvkk/logs', label: 'KVKK Logları', icon: Shield, roles: ['ADMIN'] },
];

export default function Layout() {
  const { user, logout, hasRole } = useAuth();

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ['notif-unread'],
    queryFn: () => api.get('/notifications/unread-count'),
    refetchInterval: 30000, // 30 sn'de bir yokla
    refetchOnWindowFocus: true,
  });
  const unreadCount = unread?.count ?? 0;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 className="text-brand-600" />
            <h1 className="text-lg font-bold text-gray-900">İKYS</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">İK Yönetim Sistemi</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || hasRole(...item.roles))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
                {item.to === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto badge bg-red-100 text-red-700">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center">
              <span className="text-brand-700 font-semibold text-sm">
                {user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition"
          >
            <LogOut size={16} />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
