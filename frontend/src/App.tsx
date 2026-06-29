import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PersonnelListPage from './pages/PersonnelListPage';
import PersonnelDetailPage from './pages/PersonnelDetailPage';
import OrgChartPage from './pages/OrgChartPage';
import CompanyStructurePage from './pages/CompanyStructurePage';
import AttendancePage from './pages/AttendancePage';
import QrAttendancePage from './pages/QrAttendancePage';
import LeavePage from './pages/LeavePage';
import LeaveApprovalPage from './pages/LeaveApprovalPage';
import HolidaysPage from './pages/HolidaysPage';
import PayrollPage from './pages/PayrollPage';
import PayrollManagementPage from './pages/PayrollManagementPage';
import ExpensesPage from './pages/ExpensesPage';
import ExpenseApprovalPage from './pages/ExpenseApprovalPage';
import RecruitmentPage from './pages/RecruitmentPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import JobPostingsPage from './pages/JobPostingsPage';
import PublicJobsPage from './pages/PublicJobsPage';
import KvkkLogsPage from './pages/KvkkLogsPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import LeaveCategoriesPage from './pages/LeaveCategoriesPage';
import LeaveListPage from './pages/LeaveListPage';

export default function App() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/jobs" element={<PublicJobsPage />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/personnel" element={<PersonnelListPage />} />
        <Route path="/personnel/:id" element={<PersonnelDetailPage />} />
        <Route path="/company-structure" element={<CompanyStructurePage />} />
        <Route path="/org-chart" element={<OrgChartPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/attendance/qr" element={<QrAttendancePage />} />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/leave/approvals" element={<LeaveApprovalPage />} />
        <Route path="/leave/list" element={<LeaveListPage />} />
        <Route path="/leave/categories" element={<LeaveCategoriesPage />} />
        <Route path="/leave/holidays" element={<HolidaysPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/payroll/management" element={<PayrollManagementPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/expenses/approvals" element={<ExpenseApprovalPage />} />
        <Route path="/recruitment" element={<RecruitmentPage />} />
        <Route path="/recruitment/postings" element={<JobPostingsPage />} />
        <Route path="/recruitment/candidates/:id" element={<CandidateDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/kvkk/logs" element={<KvkkLogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}
