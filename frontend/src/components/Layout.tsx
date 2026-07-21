import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
  LayoutDashboard, Users, GitBranch, Clock, Calendar, CheckSquare,
  Wallet, Receipt, Briefcase, Shield, LogOut, Building2, Network,
  UserCircle, FileSpreadsheet, FilePlus, QrCode, CalendarDays, Bell, ListChecks, Tags,
  Menu, X, ChevronsLeft, ChevronsRight,
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
  { to: '/attendance/overview', label: 'Personel Mesai Durumu', icon: Users, roles: ['ADMIN', 'HR'] },
  { to: '/attendance/qr', label: 'QR Mesai Ekranı', icon: QrCode, roles: ['HR'] },
  { to: '/leave', label: 'İzinlerim', icon: Calendar },
  { to: '/leave/approvals', label: 'İzin Onayları', icon: CheckSquare, roles: ['MANAGER', 'HR', 'ADMIN'] },
  { to: '/leave/list', label: 'İzin Listesi', icon: ListChecks, roles: ['MANAGER', 'HR', 'ACCOUNTING', 'ADMIN'] },
  { to: '/leave/balances', label: 'Personel İzin Bakiyeleri', icon: CalendarDays, roles: ['HR', 'ADMIN'] },
  { to: '/leave/categories', label: 'İzin Kategorileri', icon: Tags, roles: ['HR', 'ADMIN'] },
  { to: '/leave/holidays', label: 'Resmi Tatiller', icon: CalendarDays },
  { to: '/payroll', label: 'Bordrolarım', icon: Wallet },
  { to: '/payroll/management', label: 'Bordro Yönetimi', icon: FileSpreadsheet, roles: ['HR', 'ACCOUNTING'] },
  { to: '/expenses', label: 'Masraflarım', icon: Receipt },
  { to: '/expenses/approvals', label: 'Masraf Onayları', icon: CheckSquare, roles: ['HR', 'ACCOUNTING'] },
  { to: '/recruitment', label: 'İşe Alım', icon: Briefcase, roles: ['HR', 'ADMIN', 'MANAGER'] },
  { to: '/recruitment/postings', label: 'İş İlanları', icon: FilePlus, roles: ['HR', 'ADMIN'] },
  { to: '/notifications', label: 'Bildirimler', icon: Bell },
  { to: '/profile', label: 'Profilim', icon: UserCircle },
  { to: '/kvkk/logs', label: 'KVKK Logları', icon: Shield, roles: ['ADMIN'] },
];

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false); // masaüstü: daralt/genişlet
  const [mobileOpen, setMobileOpen] = useState(false); // mobil: aç/kapa (kayar panel)

  const { data: unread } = useQuery<{ count: number }>({
    queryKey: ['notif-unread'],
    queryFn: () => api.get('/notifications/unread-count'),
    refetchInterval: 30000, // 30 sn'de bir yokla
    refetchOnWindowFocus: true,
  });
  const unreadCount = unread?.count ?? 0;

  const visibleItems = navItems.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobilde sidebar açıkken arkaplanı karart, tıklayınca kapat */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: mobilde kayan panel (varsayılan gizli), masaüstünde daima görünür (daraltılabilir) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex flex-col
          shrink-0 transition-all duration-200 w-64
          lg:relative lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className={collapsed ? 'lg:hidden' : ''}>
            <div className="flex items-center gap-2">
              <Building2 className="text-brand-600 shrink-0" />
              <h1 className="text-lg font-bold text-gray-900">İKYS</h1>
            </div>
            <p className="text-xs text-gray-500 mt-1">İK Yönetim Sistemi</p>
          </div>
          {collapsed && <Building2 className="text-brand-600 hidden lg:block mx-auto" />}
          <button
            onClick={() => setMobileOpen(false)}
            className="text-gray-400 hover:text-gray-700 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  collapsed ? 'lg:justify-center' : ''
                } ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon size={18} className="shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className={`ml-auto badge bg-red-100 text-red-700 ${collapsed ? 'lg:hidden' : ''}`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Masaüstünde daralt/genişlet düğmesi */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center gap-2 px-3 py-2 mx-3 mb-1 rounded-lg text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
        >
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Daralt</>}
        </button>

        <div className="p-3 border-t border-gray-200">
          <div className={`flex items-center gap-3 px-3 py-2 mb-2 ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-brand-700 font-semibold text-sm">
                {user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title={collapsed ? 'Çıkış Yap' : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition ${
              collapsed ? 'lg:justify-center' : ''
            }`}
          >
            <LogOut size={16} className="shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobilde üst çubuk: hamburger + başlık (masaüstünde gizli) */}
        <div className="lg:hidden flex items-center gap-3 p-3 border-b border-gray-200 bg-white shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-gray-600">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-gray-900">İKYS</span>
          {unreadCount > 0 && (
            <span className="ml-auto badge bg-red-100 text-red-700">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
