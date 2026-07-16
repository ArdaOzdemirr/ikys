import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Önemli/Çok önemli bildirimleri telefonda heads-up (yukardan düşen) olarak,
/// çok önemlide kırmızı + farklı sesle gösterir.
///
/// Farklı ses için: android/app/src/main/res/raw/urgent.mp3 dosyasını ekle.
/// (Kanal bir kez oluşturulduğu için ses dosyasını sonradan eklersen uygulamayı
///  kaldırıp yeniden kur ki yeni ses geçerli olsun.)
class LocalNotifications {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  /// Ön planda gösterilen bildirime dokununca çağrılır (push_service.dart bağlar).
  static void Function(String payload)? onTap;

  static const AndroidNotificationChannel _urgentChannel =
      AndroidNotificationChannel(
    'ikys_urgent',
    'Çok Önemli',
    description: 'Çok önemli bildirimler (farklı ses + kırmızı)',
    importance: Importance.max,
    playSound: true,
    sound: RawResourceAndroidNotificationSound('urgent'),
    enableVibration: true,
    enableLights: true,
    ledColor: Color(0xFFDC2626),
  );

  static const AndroidNotificationChannel _importantChannel =
      AndroidNotificationChannel(
    'ikys_important',
    'Önemli',
    description: 'Önemli bildirimler',
    importance: Importance.high,
    playSound: true,
    enableVibration: true,
  );

  static const AndroidNotificationChannel _defaultChannel =
      AndroidNotificationChannel(
    'ikys_default',
    'Genel',
    description: 'Genel bildirimler',
    importance: Importance.defaultImportance,
    playSound: true,
    enableVibration: true,
  );

  static Future<void> init() async {
    if (_ready) return;
    const androidInit =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _plugin.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (details) {
        final payload = details.payload;
        if (payload != null) onTap?.call(payload);
      },
    );

    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_urgentChannel);
    await android?.createNotificationChannel(_importantChannel);
    await android?.createNotificationChannel(_defaultChannel);
    await android?.requestNotificationsPermission();
    _ready = true;
  }

  /// priority: NORMAL | IMPORTANT | URGENT
  /// (NORMAL → sade default kanal; FCM foreground'da çağrılabilir.)
  static Future<void> show({
    required String id,
    required String title,
    String? body,
    required String priority,
    String? payload,
  }) async {
    final urgent = priority == 'URGENT';
    final important = priority == 'IMPORTANT';
    final channelId = urgent
        ? 'ikys_urgent'
        : important
            ? 'ikys_important'
            : 'ikys_default';

    final androidDetails = AndroidNotificationDetails(
      channelId,
      urgent
          ? 'Çok Önemli'
          : important
              ? 'Önemli'
              : 'Genel',
      channelDescription: 'İKYS bildirimleri',
      importance: urgent
          ? Importance.max
          : important
              ? Importance.high
              : Importance.defaultImportance,
      priority: urgent
          ? Priority.max
          : important
              ? Priority.high
              : Priority.defaultPriority,
      color: urgent ? const Color(0xFFDC2626) : null,
      colorized: urgent,
      icon: '@mipmap/ic_launcher',
      sound: urgent ? const RawResourceAndroidNotificationSound('urgent') : null,
      playSound: true,
      enableVibration: true,
      ticker: urgent ? 'Çok önemli bildirim' : 'Bildirim',
      styleInformation:
          body != null ? BigTextStyleInformation(body) : null,
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _plugin.show(
      id.hashCode,
      title,
      body,
      NotificationDetails(android: androidDetails, iOS: iosDetails),
      payload: payload,
    );
  }
}
