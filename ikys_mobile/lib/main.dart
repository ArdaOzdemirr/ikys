import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'services/api_client.dart';
import 'services/local_notifications.dart';
import 'services/push_service.dart';
import 'router.dart';

/// Arka plan/terminated push: OS, backend'in gönderdiği channelId ile bildirimi
/// kendisi gösterir; burada ekstra işleme gerek yok (no-op).
@pragma('vm:entry-point')
Future<void> _firebaseBgHandler(RemoteMessage message) async {}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBgHandler);
  } catch (_) {
    // Firebase yapılandırması yoksa uygulama yine de açılsın
  }
  await ApiClient.instance.init();
  await LocalNotifications.init();
  await PushService.init();
  runApp(const IkysApp());
}

class IkysApp extends StatefulWidget {
  const IkysApp({super.key});

  @override
  State<IkysApp> createState() => _IkysAppState();
}

class _IkysAppState extends State<IkysApp> {
  late final AuthProvider auth;
  late final GoRouter router;

  @override
  void initState() {
    super.initState();
    auth = AuthProvider();
    // API katmanı zorla çıkış yaparsa provider'ı temizle
    ApiClient.instance.onForceLogout = auth.forceLogout;
    auth.bootstrap();
    router = createRouter(auth);
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: auth,
      child: MaterialApp.router(
        title: 'İKYS',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorSchemeSeed: const Color(0xFF2563EB),
          scaffoldBackgroundColor: const Color(0xFFF3F4F6),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF2563EB),
            foregroundColor: Colors.white,
          ),
        ),
        routerConfig: router,
      ),
    );
  }
}
