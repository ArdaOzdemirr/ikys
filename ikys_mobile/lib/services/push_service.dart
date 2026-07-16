import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'api_client.dart';
import 'local_notifications.dart';
import '../router.dart';
import '../screens/notifications_screen.dart';
import '../screens/expenses_screen.dart';
import '../screens/shell_screen.dart';

/// FCM push: cihaz token'ını backend'e kaydeder, ön planda (foreground) gelen
/// push'u doğru kanalda (önem seviyesine göre) yerel bildirim olarak gösterir.
///
/// Arka plan/kapalı durumda OS, backend'in gönderdiği channelId ile bildirimi
/// otomatik gösterir (çok önemli → kırmızı + urgent sesi).
class PushService {
  static final FirebaseMessaging _fm = FirebaseMessaging.instance;
  static bool _ready = false;

  static Future<void> init() async {
    if (_ready) return;
    await _fm.requestPermission(alert: true, badge: true, sound: true);

    // Ön planda gelen mesajı yerel bildirim olarak göster (FCM foreground'da
    // otomatik göstermez). Ona dokununca da doğru ekrana gitsin.
    FirebaseMessaging.onMessage.listen(_onForeground);
    LocalNotifications.onTap = routeForType;

    // Uygulama arka plandayken bildirime dokunup öne getirilince
    FirebaseMessaging.onMessageOpenedApp.listen(_onNotificationTap);
    debugPrint('[Push] onMessageOpenedApp dinleyicisi kuruldu');

    // Uygulama tamamen kapalıyken bildirime dokunup açılınca (cold start).
    // runApp() henüz çağrılmadığı için rootNavigatorKey hazır olana kadar
    // (ilk frame render olana kadar) bekleyip öyle yönlendiriyoruz.
    final initial = await _fm.getInitialMessage();
    if (initial != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _onNotificationTap(initial));
    }

    // Token yenilenince tekrar kaydet
    _fm.onTokenRefresh.listen((_) => registerToken());

    _ready = true;
  }

  static void _onNotificationTap(RemoteMessage message) {
    debugPrint('[Push] bildirime dokunuldu, data=${message.data}');
    final type = message.data['type'] as String?;
    if (type != null && type.isNotEmpty) {
      routeForType(type);
    } else {
      debugPrint('[Push] data içinde "type" yok, yönlendirme yapılamıyor');
    }
  }

  /// Bildirim türüne göre doğru ekrana gider: mesajlarda "Bildirimler"
  /// (mesaj) sayfasına, izin onayı bekleyenlerde "Onaylar" sekmesine,
  /// izinle ilgili sonuç bildirimlerinde "İzin" sekmesine, masraf/avans
  /// onayı bekleyenlerde ve sonuçlarında "Masraflar" sayfasına.
  /// (push_service.dart dışından da çağrılır: bildirim listesindeki bir
  /// öğeye dokununca aynı yönlendirmeyi tetiklemek için.)
  static void routeForType(String type) {
    debugPrint('[Push] routeForType: $type');
    const approvalTypes = {'LEAVE_APPROVAL_PENDING', 'LEAVE_CANCEL_PENDING'};
    const leaveStatusTypes = {
      'LEAVE_APPROVED',
      'LEAVE_REJECTED',
      'LEAVE_CANCEL_APPROVED',
      'LEAVE_CANCEL_REJECTED',
    };
    const expenseStatusTypes = {
      'EXPENSE_APPROVED',
      'EXPENSE_REJECTED',
      'EXPENSE_PAID',
    };

    final nav = rootNavigatorKey.currentState;
    if (nav == null) {
      debugPrint('[Push] rootNavigatorKey.currentState null, yönlendirilemedi');
      return;
    }

    if (type == 'MESSAGE') {
      nav.push(MaterialPageRoute(builder: (_) => const NotificationsScreen()));
      return;
    }
    if (approvalTypes.contains(type)) {
      nav.popUntil((r) => r.isFirst);
      ShellScreen.requestedTab.value = 'approvals';
      return;
    }
    if (leaveStatusTypes.contains(type)) {
      nav.popUntil((r) => r.isFirst);
      ShellScreen.requestedTab.value = 'leave';
      return;
    }
    if (type == 'EXPENSE_PENDING') {
      nav.push(MaterialPageRoute(builder: (_) => const ExpensesScreen(initialTab: 'pending')));
      return;
    }
    if (expenseStatusTypes.contains(type)) {
      nav.push(MaterialPageRoute(builder: (_) => const ExpensesScreen(initialTab: 'mine')));
    }
  }

  /// Giriş yapıldıktan sonra çağrılır (auth gerektirir).
  static Future<void> registerToken() async {
    try {
      if (Platform.isIOS) {
        // iOS'ta FCM token'ı, APNs token'ı hazır olana kadar null dönebilir
        // (bilinen bir firebase_messaging zamanlama sorunu) — birkaç kez dene.
        String? apnsToken = await _fm.getAPNSToken();
        var retries = 0;
        while (apnsToken == null && retries < 10) {
          await Future.delayed(const Duration(seconds: 2));
          apnsToken = await _fm.getAPNSToken();
          retries++;
        }
      }

      final token = await _fm.getToken();
      if (token == null) return;
      await ApiClient.instance.dio.post('/notifications/device-token', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });
    } catch (_) {
      // giriş yoksa veya ağ hatası → sessiz geç
    }
  }

  /// Ekranda göstermek üzere, her adımı ayrıntılı raporlayan test fonksiyonu.
  static Future<String> debugRegisterToken() async {
    final log = StringBuffer();
    log.writeln('Platform: ${Platform.isIOS ? 'iOS' : 'Android'}');
    try {
      final settings = await _fm.getNotificationSettings();
      log.writeln('Bildirim izni: ${settings.authorizationStatus}');

      if (Platform.isIOS) {
        String? apnsToken = await _fm.getAPNSToken();
        log.writeln('İlk APNs token: ${apnsToken ?? "null"}');
        var retries = 0;
        while (apnsToken == null && retries < 10) {
          await Future.delayed(const Duration(seconds: 2));
          apnsToken = await _fm.getAPNSToken();
          retries++;
          log.writeln('Deneme $retries: ${apnsToken ?? "null"}');
        }
        if (apnsToken == null) {
          log.writeln('APNs token hâlâ null, yine de FCM token deneniyor...');
        }
      }

      final token = await _fm.getToken();
      if (token == null) {
        log.writeln('SONUÇ: FCM token null döndü.');
        return log.toString();
      }
      log.writeln('FCM token (ilk 25 hane): ${token.substring(0, 25)}...');

      final res = await ApiClient.instance.dio.post('/notifications/device-token', data: {
        'token': token,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });
      log.writeln('Backend cevabı: ${res.statusCode}');
      log.writeln('SONUÇ: Başarılı.');
    } catch (e) {
      log.writeln('HATA: $e');
    }
    return log.toString();
  }

  /// Çıkışta token'ı sunucudan sil (başkasına bildirim gitmesin).
  static Future<void> unregisterToken() async {
    try {
      final token = await _fm.getToken();
      if (token == null) return;
      await ApiClient.instance.dio
          .delete('/notifications/device-token', data: {'token': token});
    } catch (_) {}
  }

  static void _onForeground(RemoteMessage m) {
    final n = m.notification;
    if (n == null) return;
    final priority = (m.data['priority'] as String?) ?? 'NORMAL';
    LocalNotifications.show(
      id: m.messageId ?? DateTime.now().millisecondsSinceEpoch.toString(),
      title: n.title ?? 'Bildirim',
      body: n.body,
      priority: priority,
      payload: m.data['type'] as String?,
    );
  }
}
