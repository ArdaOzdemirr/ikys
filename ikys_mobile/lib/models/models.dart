// Backend cevaplarını karşılayan modeller.

class User {
  final String id;
  final String email;
  final String role; // EMPLOYEE | MANAGER | HR | ACCOUNTING | ADMIN

  User({required this.id, required this.email, required this.role});

  factory User.fromJson(Map<String, dynamic> j) =>
      User(id: j['id'], email: j['email'], role: j['role']);

  Map<String, dynamic> toJson() => {'id': id, 'email': email, 'role': role};
}

class AuthResult {
  final String? accessToken;
  final String? refreshToken;
  final User? user;
  final bool requires2FA;

  AuthResult({this.accessToken, this.refreshToken, this.user, this.requires2FA = false});

  factory AuthResult.fromJson(Map<String, dynamic> j) => AuthResult(
        accessToken: j['accessToken'],
        refreshToken: j['refreshToken'],
        user: j['user'] != null ? User.fromJson(j['user']) : null,
        requires2FA: j['requires2FA'] == true,
      );
}

class Holiday {
  final String id;
  final String name;
  final DateTime date;
  final bool recurring;
  final bool isOfficial;

  Holiday({
    required this.id,
    required this.name,
    required this.date,
    this.recurring = false,
    this.isOfficial = true,
  });

  factory Holiday.fromJson(Map<String, dynamic> j) => Holiday(
        id: j['id'],
        name: j['name'],
        date: DateTime.parse(j['date']),
        recurring: j['recurring'] ?? false,
        isOfficial: j['isOfficial'] ?? true,
      );
}

class Attendance {
  final String id;
  final DateTime date;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final int? workedMinutes;
  final int overtimeMin;
  final bool isLate;

  Attendance({
    required this.id,
    required this.date,
    this.checkIn,
    this.checkOut,
    this.workedMinutes,
    this.overtimeMin = 0,
    this.isLate = false,
  });

  factory Attendance.fromJson(Map<String, dynamic> j) => Attendance(
        id: j['id'],
        date: DateTime.parse(j['date']),
        checkIn: j['checkIn'] != null ? DateTime.parse(j['checkIn']).toLocal() : null,
        checkOut: j['checkOut'] != null ? DateTime.parse(j['checkOut']).toLocal() : null,
        workedMinutes: j['workedMinutes'],
        overtimeMin: j['overtimeMin'] ?? 0,
        isLate: j['isLate'] ?? false,
      );
}

class LeaveCategory {
  final String id;
  final String code;
  final String name;
  final bool isPaid;
  final bool affectsAnnualBalance;

  LeaveCategory({
    required this.id,
    required this.code,
    required this.name,
    this.isPaid = true,
    this.affectsAnnualBalance = false,
  });

  factory LeaveCategory.fromJson(Map<String, dynamic> j) => LeaveCategory(
        id: j['id'],
        code: j['code'],
        name: j['name'],
        isPaid: j['isPaid'] ?? true,
        affectsAnnualBalance: j['affectsAnnualBalance'] ?? false,
      );
}

class LeaveBalance {
  final String id;
  final String type;
  final int year;
  final double totalDays;
  final double usedDays;
  final double remainingDays;

  LeaveBalance({
    required this.id,
    required this.type,
    required this.year,
    required this.totalDays,
    required this.usedDays,
    required this.remainingDays,
  });

  factory LeaveBalance.fromJson(Map<String, dynamic> j) => LeaveBalance(
        id: j['id'],
        type: j['type'],
        year: j['year'],
        totalDays: (j['totalDays'] as num).toDouble(),
        usedDays: (j['usedDays'] as num).toDouble(),
        remainingDays: (j['remainingDays'] as num).toDouble(),
      );
}

class LeaveRequest {
  final String id;
  final String? type;
  final LeaveCategory? category;
  final DateTime startDate;
  final DateTime endDate;
  final double totalDays;
  final String? reason;
  final String status; // PENDING | APPROVED | REJECTED | CANCELLED
  final String? rejectionReason;
  final String? paymentType; // PAID | UNPAID
  final bool requiresPaymentDecision;

  LeaveRequest({
    required this.id,
    this.type,
    this.category,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    this.reason,
    required this.status,
    this.rejectionReason,
    this.paymentType,
    this.requiresPaymentDecision = false,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> j) => LeaveRequest(
        id: j['id'],
        type: j['type'],
        category: j['category'] != null ? LeaveCategory.fromJson(j['category']) : null,
        startDate: DateTime.parse(j['startDate']),
        endDate: DateTime.parse(j['endDate']),
        totalDays: (j['totalDays'] as num).toDouble(),
        reason: j['reason'],
        status: j['status'],
        rejectionReason: j['rejectionReason'],
        paymentType: j['paymentType'],
        requiresPaymentDecision: j['requiresPaymentDecision'] ?? false,
      );
}

// ============ Bildirimler & Onaylar ============

class NotificationItem {
  final String id;
  final String type; // LEAVE_APPROVAL_PENDING | LEAVE_APPROVED | LEAVE_REJECTED | MESSAGE
  final String priority; // NORMAL | IMPORTANT | URGENT
  final String title;
  final String? body;
  final bool isRead;
  final DateTime createdAt;
  final String? senderId;
  final String? senderName;

  NotificationItem({
    required this.id,
    required this.type,
    this.priority = 'NORMAL',
    required this.title,
    this.body,
    this.isRead = false,
    required this.createdAt,
    this.senderId,
    this.senderName,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> j) {
    final s = j['sender'];
    return NotificationItem(
      id: j['id'],
      type: j['type'],
      priority: j['priority'] ?? 'NORMAL',
      title: j['title'],
      body: j['body'],
      isRead: j['isRead'] ?? false,
      createdAt: DateTime.parse(j['createdAt']).toLocal(),
      senderId: s != null ? s['id'] : null,
      senderName: s != null ? '${s['firstName']} ${s['lastName']}' : null,
    );
  }
}

class AttendanceOverviewRow {
  final String personnelId;
  final String firstName;
  final String lastName;
  final String employeeNo;
  final String? department;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final bool isLate;
  final int? workedMinutes;

  AttendanceOverviewRow({
    required this.personnelId,
    required this.firstName,
    required this.lastName,
    required this.employeeNo,
    this.department,
    this.checkIn,
    this.checkOut,
    this.isLate = false,
    this.workedMinutes,
  });

  String get fullName => '$firstName $lastName';

  factory AttendanceOverviewRow.fromJson(Map<String, dynamic> j) => AttendanceOverviewRow(
        personnelId: j['personnelId'],
        firstName: j['firstName'],
        lastName: j['lastName'],
        employeeNo: j['employeeNo'],
        department: j['department'],
        checkIn: j['checkIn'] != null ? DateTime.parse(j['checkIn']).toLocal() : null,
        checkOut: j['checkOut'] != null ? DateTime.parse(j['checkOut']).toLocal() : null,
        isLate: j['isLate'] ?? false,
        workedMinutes: j['workedMinutes'],
      );
}

class TakenLeave {
  final String id;
  final DateTime startDate;
  final DateTime endDate;
  final double totalDays;

  TakenLeave({
    required this.id,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
  });

  factory TakenLeave.fromJson(Map<String, dynamic> j) => TakenLeave(
        id: j['id'],
        startDate: DateTime.parse(j['startDate']),
        endDate: DateTime.parse(j['endDate']),
        totalDays: (j['totalDays'] as num).toDouble(),
      );
}

/// İK/Admin: bir personelin yıllık izin hakedişi/kullanımı ve aldığı izin günleri.
class LeaveBalanceRow {
  final String personnelId;
  final String firstName;
  final String lastName;
  final String employeeNo;
  final String? department;
  final DateTime hireDate;
  final double totalEntitled;
  final double used;
  final double remaining;
  final List<TakenLeave> takenLeaves;

  LeaveBalanceRow({
    required this.personnelId,
    required this.firstName,
    required this.lastName,
    required this.employeeNo,
    this.department,
    required this.hireDate,
    required this.totalEntitled,
    required this.used,
    required this.remaining,
    required this.takenLeaves,
  });

  String get fullName => '$firstName $lastName';

  factory LeaveBalanceRow.fromJson(Map<String, dynamic> j) => LeaveBalanceRow(
        personnelId: j['personnelId'],
        firstName: j['firstName'],
        lastName: j['lastName'],
        employeeNo: j['employeeNo'],
        department: j['department'],
        hireDate: DateTime.parse(j['hireDate']),
        totalEntitled: (j['totalEntitled'] as num).toDouble(),
        used: (j['used'] as num).toDouble(),
        remaining: (j['remaining'] as num).toDouble(),
        takenLeaves: (j['takenLeaves'] as List)
            .map((e) => TakenLeave.fromJson(e))
            .toList(),
      );
}

class MessageRecipient {
  final String id;
  final String firstName;
  final String lastName;
  final String? position;
  final String? department;

  MessageRecipient({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.position,
    this.department,
  });

  String get fullName => '$firstName $lastName';

  factory MessageRecipient.fromJson(Map<String, dynamic> j) => MessageRecipient(
        id: j['id'],
        firstName: j['firstName'],
        lastName: j['lastName'],
        position: j['position'],
        department: j['department'],
      );
}

/// Onay sırası şu an bu yöneticide olan izin talebi.
class PendingApproval {
  final String id;
  final String requesterName;
  final String employeeNo;
  final String leaveName;
  final DateTime startDate;
  final DateTime endDate;
  final double totalDays;
  final String? reason;
  final int stepOrder;
  final int totalSteps;
  final bool isFinalStep;
  final bool requiresPaymentDecision;

  PendingApproval({
    required this.id,
    required this.requesterName,
    required this.employeeNo,
    required this.leaveName,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    this.reason,
    this.stepOrder = 1,
    this.totalSteps = 1,
    this.isFinalStep = true,
    this.requiresPaymentDecision = false,
  });

  factory PendingApproval.fromJson(Map<String, dynamic> j) {
    final p = j['personnel'] ?? {};
    final cat = j['category'];
    final leaveName = cat != null ? cat['name'] : (j['type'] ?? 'İzin');
    return PendingApproval(
      id: j['id'],
      requesterName: '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim(),
      employeeNo: p['employeeNo'] ?? '',
      leaveName: leaveName,
      startDate: DateTime.parse(j['startDate']),
      endDate: DateTime.parse(j['endDate']),
      totalDays: (j['totalDays'] as num).toDouble(),
      reason: j['reason'],
      stepOrder: j['stepOrder'] ?? 1,
      totalSteps: j['totalSteps'] ?? 1,
      isFinalStep: j['isFinalStep'] ?? true,
      requiresPaymentDecision: j['requiresPaymentDecision'] ?? false,
    );
  }
}

// ============ İzin Listesi & Kategori Yönetimi (mobil) ============

const leaveTypeLabels = {
  'ANNUAL': 'Yıllık İzin',
  'HALF_DAY': 'Yarım Gün',
  'HOURLY': 'Saatlik',
  'EXCUSE': 'Mazeret',
  'SICK': 'Sağlık Raporu',
  'MATERNITY': 'Doğum İzni',
  'PATERNITY': 'Babalık İzni',
  'MARRIAGE': 'Evlilik İzni',
  'BEREAVEMENT': 'Vefat İzni',
  'UNPAID': 'Ücretsiz İzin',
};

class LeaveListItem {
  final String id;
  final String personnelId;
  final String personName;
  final String employeeNo;
  final String? department;
  final String leaveName;
  final DateTime startDate;
  final DateTime endDate;
  final double totalDays;
  final String status;
  final String? paymentType;

  LeaveListItem({
    required this.id,
    required this.personnelId,
    required this.personName,
    required this.employeeNo,
    this.department,
    required this.leaveName,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.status,
    this.paymentType,
  });

  factory LeaveListItem.fromJson(Map<String, dynamic> j) {
    final p = j['personnel'] ?? {};
    final cat = j['category'];
    return LeaveListItem(
      id: j['id'],
      personnelId: j['personnelId'],
      personName: '${p['firstName'] ?? ''} ${p['lastName'] ?? ''}'.trim(),
      employeeNo: p['employeeNo'] ?? '',
      department: p['department']?['name'],
      leaveName: cat != null
          ? cat['name']
          : (j['type'] != null ? (leaveTypeLabels[j['type']] ?? j['type']) : 'İzin'),
      startDate: DateTime.parse(j['startDate']),
      endDate: DateTime.parse(j['endDate']),
      totalDays: (j['totalDays'] as num).toDouble(),
      status: j['status'],
      paymentType: j['paymentType'],
    );
  }
}

/// İzin Listesi'nde seçilebilecek personel (bkz. LeaveListService.personnel).
class LeavePersonnelRow {
  final String id;
  final String firstName;
  final String lastName;
  final String employeeNo;
  final String? department;

  LeavePersonnelRow({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.employeeNo,
    this.department,
  });

  String get fullName => '$firstName $lastName';

  factory LeavePersonnelRow.fromJson(Map<String, dynamic> j) => LeavePersonnelRow(
        id: j['id'],
        firstName: j['firstName'],
        lastName: j['lastName'],
        employeeNo: j['employeeNo'],
        department: j['department']?['name'],
      );
}

class AdminCategory {
  final String id;
  final String code;
  final String name;
  final String? description;
  final bool isPaid;
  final bool affectsAnnualBalance;
  final bool defaultVisible;
  final bool isActive;
  final bool isSystem;
  final int accessCount;

  AdminCategory({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    required this.isPaid,
    required this.affectsAnnualBalance,
    required this.defaultVisible,
    required this.isActive,
    required this.isSystem,
    this.accessCount = 0,
  });

  factory AdminCategory.fromJson(Map<String, dynamic> j) => AdminCategory(
        id: j['id'],
        code: j['code'],
        name: j['name'],
        description: j['description'],
        isPaid: j['isPaid'] ?? true,
        affectsAnnualBalance: j['affectsAnnualBalance'] ?? false,
        defaultVisible: j['defaultVisible'] ?? true,
        isActive: j['isActive'] ?? true,
        isSystem: j['isSystem'] ?? false,
        accessCount: j['_count']?['accesses'] ?? 0,
      );
}

class SimplePersonnel {
  final String id;
  final String firstName;
  final String lastName;
  final String employeeNo;

  SimplePersonnel({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.employeeNo,
  });

  String get fullName => '$firstName $lastName';

  factory SimplePersonnel.fromJson(Map<String, dynamic> j) => SimplePersonnel(
        id: j['id'],
        firstName: j['firstName'] ?? '',
        lastName: j['lastName'] ?? '',
        employeeNo: j['employeeNo'] ?? '',
      );
}

class CategoryVisibility {
  final String personnelId;
  final bool visible;

  CategoryVisibility({required this.personnelId, required this.visible});

  factory CategoryVisibility.fromJson(Map<String, dynamic> j) => CategoryVisibility(
        personnelId: j['personnelId'],
        visible: j['visible'] ?? true,
      );
}

// ============ Profil (kendi kaydım) ============
class MyProfile {
  final String firstName;
  final String lastName;
  final String email;
  final String role;
  final String employeeNo;
  final String? phone;
  final String? address;
  final String? emergencyContact;
  final String? department;
  final String? position;
  final String? managerName;
  final DateTime? hireDate;

  MyProfile({
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.role,
    required this.employeeNo,
    this.phone,
    this.address,
    this.emergencyContact,
    this.department,
    this.position,
    this.managerName,
    this.hireDate,
  });

  String get fullName => '$firstName $lastName';

  factory MyProfile.fromJson(Map<String, dynamic> j) {
    final u = j['user'] ?? {};
    final mgr = j['manager'];
    return MyProfile(
      firstName: j['firstName'] ?? '',
      lastName: j['lastName'] ?? '',
      email: u['email'] ?? '',
      role: u['role'] ?? '',
      employeeNo: j['employeeNo'] ?? '',
      phone: j['phone'],
      address: j['address'],
      emergencyContact: j['emergencyContact'],
      department: j['department']?['name'],
      position: j['position']?['title'],
      managerName: mgr != null ? '${mgr['firstName']} ${mgr['lastName']}' : null,
      hireDate: j['hireDate'] != null ? DateTime.tryParse(j['hireDate']) : null,
    );
  }
}

// ============ Masraf ============
double _toD(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);

class ExpenseItem {
  final String id;
  final String category;
  final double amount;
  final String currency;
  final DateTime date;
  final String description;
  final String status; // PENDING | APPROVED | REJECTED | PAID
  final String? personnelName;
  final String? receiptUrl;
  final String? appliedPayrollId;

  ExpenseItem({
    required this.id,
    required this.category,
    required this.amount,
    required this.currency,
    required this.date,
    required this.description,
    required this.status,
    this.personnelName,
    this.receiptUrl,
    this.appliedPayrollId,
  });

  factory ExpenseItem.fromJson(Map<String, dynamic> j) {
    final p = j['personnel'];
    return ExpenseItem(
      id: j['id'],
      category: j['category'] ?? '',
      amount: _toD(j['amount']),
      currency: j['currency'] ?? 'TRY',
      date: DateTime.parse(j['date']).toLocal(),
      description: j['description'] ?? '',
      status: j['status'] ?? 'PENDING',
      personnelName: p != null ? '${p['firstName']} ${p['lastName']}' : null,
      receiptUrl: j['receiptUrl'],
      appliedPayrollId: j['appliedPayrollId'],
    );
  }
}

// ============ Bordro ============
class PayrollRecord {
  final String id;
  final int year;
  final int month;
  final double grossSalary;
  final double agi;
  final double mealAllowance;
  final double transportAllowance;
  final double overtimePay;
  final double bonus;
  final double sgkEmployee;
  final double unemploymentIns;
  final double incomeTax;
  final double stampTax;
  final double bes;
  final double otherDeductions;
  final double avansDeduction;
  final double netSalary;

  PayrollRecord({
    required this.id,
    required this.year,
    required this.month,
    required this.grossSalary,
    required this.agi,
    required this.mealAllowance,
    required this.transportAllowance,
    required this.overtimePay,
    required this.bonus,
    required this.sgkEmployee,
    required this.unemploymentIns,
    required this.incomeTax,
    required this.stampTax,
    required this.bes,
    required this.otherDeductions,
    required this.avansDeduction,
    required this.netSalary,
  });

  double get totalDeductions =>
      sgkEmployee + unemploymentIns + incomeTax + stampTax + bes + otherDeductions + avansDeduction;

  factory PayrollRecord.fromJson(Map<String, dynamic> j) => PayrollRecord(
        id: j['id'],
        year: j['year'],
        month: j['month'],
        grossSalary: _toD(j['grossSalary']),
        agi: _toD(j['agi']),
        mealAllowance: _toD(j['mealAllowance']),
        transportAllowance: _toD(j['transportAllowance']),
        overtimePay: _toD(j['overtimePay']),
        bonus: _toD(j['bonus']),
        sgkEmployee: _toD(j['sgkEmployee']),
        unemploymentIns: _toD(j['unemploymentIns']),
        incomeTax: _toD(j['incomeTax']),
        stampTax: _toD(j['stampTax']),
        bes: _toD(j['bes']),
        otherDeductions: _toD(j['otherDeductions']),
        avansDeduction: _toD(j['avansDeduction']),
        netSalary: _toD(j['netSalary']),
      );
}
