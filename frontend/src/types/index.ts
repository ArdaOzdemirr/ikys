export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ACCOUNTING' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  requires2FA?: boolean;
  userId?: string;
}

export interface Personnel {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  tcKimlikNo: string;
  phone?: string;
  status: 'ACTIVE' | 'RESIGNED' | 'SUSPENDED';
  contractType: string;
  hireDate: string;
  department?: { id: string; name: string };
  position?: { id: string; title: string };
  manager?: { id: string; firstName: string; lastName: string };
  user?: { email: string; role: Role };
}

export interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string;
  createdAt: string;
  personnel?: { firstName: string; lastName: string; employeeNo: string };
}

export interface LeaveBalance {
  id: string;
  type: string;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface Attendance {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  method: string;
  workedMinutes?: number;
  overtimeMin: number;
  isLate: boolean;
}

export interface Payroll {
  id: string;
  year: number;
  month: number;
  grossSalary: number;
  netSalary: number;
  sgkEmployee: number;
  incomeTax: number;
  stampTax: number;
  generatedAt: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: string;
  appliedAt: string;
  jobPosting?: { title: string };
}
