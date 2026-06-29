import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode } from 'react';

export default function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && !hasRole(...roles)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600">Erişim Engellendi</h2>
        <p className="text-gray-600 mt-2">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }
  return <>{children}</>;
}
