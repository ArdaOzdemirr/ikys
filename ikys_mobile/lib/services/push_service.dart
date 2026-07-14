import 'dart:io' show Platform;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'api_client.dart';
import 'local_notifications.dart';

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
    // otomatik göstermez).
    FirebaseMessaging.onMessage.listen(_onForeground);

    // Token yenilenince tekrar kaydet
    _fm.onTokenRefresh.listen((_) => registerToken());

    _ready = true;
  }

  /// Giriş yapıldıktan sonra çağrılır (auth gerektirir).
  static Future<void> registerToken() async {
    try {
      if (Platform.isIOS) {
        // iOS'ta FCM token'ı, APNs token'ı hazır olana kadar null dönebilir
        // (bilinen bir firebase_messaging zamanlama sorunu) — birkaç kez dene.
        String? apnsToken = await _fm.getAPNSToken();
        var retries = 0;
        while (apnsToken == null && retries < 6) {
          await Future.delayed(const Duration(seconds: 1));
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
        while (apnsToken == null && retries < 6) {
          await Future.delayed(const Duration(seconds: 1));
          apnsToken = await _fm.getAPNSToken();
          retries++;
          log.writeln('Deneme $retries: ${apnsToken ?? "null"}');
        }
        if (apnsToken == null) {
          log.writeln('SONUÇ: APNs token hiç alınamadı.');
          return log.toString();
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
    );
  }
}
