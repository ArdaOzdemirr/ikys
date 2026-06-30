import 'package:dio/dio.dart';
import '../models/models.dart';
import 'api_client.dart';

class AuthService {
  static Future<AuthResult> login(String email, String password, {String? token2FA}) async {
    final res = await ApiClient.instance.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
      if (token2FA != null) 'token2FA': token2FA,
    });
    return AuthResult.fromJson(res.data);
  }

  static Future<void> logout() async {
    await ApiClient.instance.dio.post('/auth/logout');
  }
}

class AttendanceService {
  static Future<List<Attendance>> me(String startDate, String endDate) async {
    final res = await ApiClient.instance.dio.get('/attendance/me',
        queryParameters: {'startDate': startDate, 'endDate': endDate});
    return (res.data as List).map((e) => Attendance.fromJson(e)).toList();
  }

  static Future<void> checkIn({required String qrCode, double? latitude, double? longitude}) async {
    await ApiClient.instance.dio.post('/attendance/check-in', data: {
      'method': 'QR_CODE',
      'qrCode': qrCode,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    });
  }

  static Future<void> checkOut({double? latitude, double? longitude}) async {
    await ApiClient.instance.dio.post('/attendance/check-out', data: {
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
    });
  }
}

class LeaveService {
  static Future<List<LeaveRequest>> myRequests() async {
    final res = await ApiClient.instance.dio.get('/leave/requests/me');
    return (res.data as List).map((e) => LeaveRequest.fromJson(e)).toList();
  }

  static Future<List<LeaveBalance>> myBalance() async {
    final res = await ApiClient.instance.dio.get('/leave/balance/me');
    return (res.data as List).map((e) => LeaveBalance.fromJson(e)).toList();
  }

  static Future<List<LeaveCategory>> myCategories() async {
    final res = await ApiClient.instance.dio.get('/leave/categories/me');
    return (res.data as List).map((e) => LeaveCategory.fromJson(e)).toList();
  }

  static Future<void> create({
    String? categoryId,
    String? type,
    required String startDate,
    required String endDate,
    String? reason,
  }) async {
    await ApiClient.instance.dio.post('/leave/requests', data: {
      if (categoryId != null) 'categoryId': categoryId,
      if (categoryId == null && type != null) 'type': type,
      'startDate': startDate,
      'endDate': endDate,
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
  }

  /// Yalnızca henüz onaylanmamış (PENDING) kendi talebini geri çeker.
  static Future<void> cancel(String id) async {
    await ApiClient.instance.dio.delete('/leave/requests/$id');
  }

  /// Onaylı (ve henüz başlamamış) bir izin için amir onayı gerektiren iptal talebi oluşturur.
  static Future<void> requestCancellation(String id) async {
    await ApiClient.instance.dio.post('/leave/requests/$id/request-cancellation');
  }

  static Future<void> remove(String id) async {
    await ApiClient.instance.dio.delete('/leave/requests/$id/remove');
  }
}

class NotificationService {
  static Future<List<NotificationItem>> list({bool unreadOnly = false}) async {
    final res = await ApiClient.instance.dio.get('/notifications',
        queryParameters: unreadOnly ? {'unread': 'true'} : null);
    return (res.data as List).map((e) => NotificationItem.fromJson(e)).toList();
  }

  static Future<int> unreadCount() async {
    final res = await ApiClient.instance.dio.get('/notifications/unread-count');
    return (res.data['count'] as num).toInt();
  }

  static Future<void> markRead(String id) async {
    await ApiClient.instance.dio.patch('/notifications/$id/read');
  }

  static Future<void> markAllRead() async {
    await ApiClient.instance.dio.patch('/notifications/read-all');
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.dio.delete('/notifications/$id');
  }

  static Future<int> broadcast(String title, String? body, {String priority = 'NORMAL'}) async {
    final res = await ApiClient.instance.dio.post('/notifications/broadcast', data: {
      'title': title,
      if (body != null && body.isNotEmpty) 'body': body,
      'priority': priority,
    });
    return (res.data['sent'] as num).toInt();
  }

  static Future<List<MessageRecipient>> recipients() async {
    final res = await ApiClient.instance.dio.get('/notifications/recipients');
    return (res.data as List).map((e) => MessageRecipient.fromJson(e)).toList();
  }

  static Future<int> sendMessage({
    required List<String> recipientIds,
    required String title,
    String? body,
    String priority = 'NORMAL',
  }) async {
    final res = await ApiClient.instance.dio.post('/notifications/message', data: {
      'recipientIds': recipientIds,
      'title': title,
      if (body != null && body.isNotEmpty) 'body': body,
      'priority': priority,
    });
    return (res.data['sent'] as num).toInt();
  }
}

class ApprovalService {
  /// Onay sırası şu an bu kullanıcıda olan izin talepleri
  static Future<List<PendingApproval>> pending() async {
    final res = await ApiClient.instance.dio.get('/leave/requests/pending');
    return (res.data as List).map((e) => PendingApproval.fromJson(e)).toList();
  }

  static Future<void> approve(String id, {String? paymentType}) async {
    await ApiClient.instance.dio.patch('/leave/requests/$id/approve', data: {
      'approved': true,
      if (paymentType != null) 'paymentType': paymentType,
    });
  }

  static Future<void> reject(String id, String reason) async {
    await ApiClient.instance.dio.patch('/leave/requests/$id/approve', data: {
      'approved': false,
      'rejectionReason': reason,
    });
  }

  /// Onayını bekleyen izin iptal talepleri (onaylı bir izni çalışan iptal etmek istedi).
  static Future<List<PendingApproval>> pendingCancellations() async {
    final res = await ApiClient.instance.dio.get('/leave/requests/pending-cancellations');
    return (res.data as List).map((e) => PendingApproval.fromJson(e)).toList();
  }

  static Future<void> decideCancellation(String id, bool approved, {String? rejectionReason}) async {
    await ApiClient.instance.dio.patch('/leave/requests/$id/cancellation-decision', data: {
      'approved': approved,
      if (rejectionReason != null && rejectionReason.isNotEmpty) 'rejectionReason': rejectionReason,
    });
  }
}

class LeaveListService {
  static Future<List<LeaveListItem>> list({String status = 'APPROVED', int? year}) async {
    final res = await ApiClient.instance.dio.get('/leave/list', queryParameters: {
      'status': status,
      if (year != null) 'year': year,
    });
    return (res.data as List).map((e) => LeaveListItem.fromJson(e)).toList();
  }
}

class PersonnelService {
  static Future<List<SimplePersonnel>> list({int limit = 200}) async {
    final res = await ApiClient.instance.dio
        .get('/personnel', queryParameters: {'limit': limit});
    final data = res.data['data'] as List? ?? [];
    return data.map((e) => SimplePersonnel.fromJson(e)).toList();
  }
}

class CategoryAdminService {
  static Future<List<AdminCategory>> list() async {
    final res = await ApiClient.instance.dio.get('/leave/categories');
    return (res.data as List).map((e) => AdminCategory.fromJson(e)).toList();
  }

  static Future<void> create({
    required String code,
    required String name,
    String? description,
    required bool isPaid,
    required bool affectsAnnualBalance,
    required bool defaultVisible,
  }) async {
    await ApiClient.instance.dio.post('/leave/categories', data: {
      'code': code,
      'name': name,
      if (description != null && description.isNotEmpty) 'description': description,
      'isPaid': isPaid,
      'affectsAnnualBalance': affectsAnnualBalance,
      'defaultVisible': defaultVisible,
    });
  }

  static Future<void> update(String id, Map<String, dynamic> data) async {
    await ApiClient.instance.dio.patch('/leave/categories/$id', data: data);
  }

  static Future<void> remove(String id) async {
    await ApiClient.instance.dio.delete('/leave/categories/$id');
  }

  static Future<List<CategoryVisibility>> visibility(String categoryId) async {
    final res = await ApiClient.instance.dio.get('/leave/categories/$categoryId/visibility');
    return (res.data as List).map((e) => CategoryVisibility.fromJson(e)).toList();
  }

  static Future<void> setVisibility(String categoryId, String personnelId, bool visible) async {
    await ApiClient.instance.dio.put('/leave/categories/$categoryId/visibility',
        data: {'personnelId': personnelId, 'visible': visible});
  }

  static Future<void> clearVisibility(String categoryId, String personnelId) async {
    await ApiClient.instance.dio.delete('/leave/categories/$categoryId/visibility/$personnelId');
  }
}

class ProfileService {
  static Future<MyProfile> me() async {
    final res = await ApiClient.instance.dio.get('/personnel/me');
    return MyProfile.fromJson(res.data);
  }

  static Future<void> updateContact({
    String? phone,
    String? address,
    String? emergencyContact,
  }) async {
    await ApiClient.instance.dio.patch('/personnel/me', data: {
      if (phone != null) 'phone': phone,
      if (address != null) 'address': address,
      if (emergencyContact != null) 'emergencyContact': emergencyContact,
    });
  }

  static Future<void> changePassword(String oldPassword, String newPassword) async {
    await ApiClient.instance.dio.post('/auth/change-password', data: {
      'oldPassword': oldPassword,
      'newPassword': newPassword,
    });
  }
}

class ExpenseService {
  static Future<List<ExpenseItem>> mine() async {
    final res = await ApiClient.instance.dio.get('/payroll/expenses/me');
    return (res.data as List).map((e) => ExpenseItem.fromJson(e)).toList();
  }

  static Future<List<ExpenseItem>> pending() async {
    final res = await ApiClient.instance.dio.get('/payroll/expenses/pending');
    return (res.data as List).map((e) => ExpenseItem.fromJson(e)).toList();
  }

  /// Muhasebe: onaylanmış, ödemesi bekleyen talepler.
  static Future<List<ExpenseItem>> approvedUnpaid() async {
    final res = await ApiClient.instance.dio.get('/payroll/expenses/approved-unpaid');
    return (res.data as List).map((e) => ExpenseItem.fromJson(e)).toList();
  }

  /// Fiş/fatura yükler, oluşan receiptUrl'i döner (create() çağrısına geçilir).
  static Future<String> uploadReceipt(String filePath, String fileName) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath, filename: fileName),
    });
    final res = await ApiClient.instance.dio.post('/payroll/expenses/upload-receipt', data: form);
    return res.data['receiptUrl'] as String;
  }

  static Future<void> create({
    required String category,
    required double amount,
    required String date,
    required String description,
    String? receiptUrl,
  }) async {
    await ApiClient.instance.dio.post('/payroll/expenses', data: {
      'category': category,
      'amount': amount,
      'date': date,
      'description': description,
      if (receiptUrl != null) 'receiptUrl': receiptUrl,
    });
  }

  static Future<void> approve(String id, bool approved, {String? reason}) async {
    await ApiClient.instance.dio.patch('/payroll/expenses/$id/approve', data: {
      'approved': approved,
      if (reason != null && reason.isNotEmpty) 'rejectionReason': reason,
    });
  }

  /// Muhasebe: onaylanmış talebi öder.
  static Future<void> pay(String id) async {
    await ApiClient.instance.dio.patch('/payroll/expenses/$id/pay');
  }
}

class PayrollService {
  static Future<List<PayrollRecord>> mine() async {
    final res = await ApiClient.instance.dio.get('/payroll/me');
    return (res.data as List).map((e) => PayrollRecord.fromJson(e)).toList();
  }
}
