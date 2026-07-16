import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
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

Future<void> _startup() async {
  await initializeDateFormatting('tr_TR');
  Intl.defaultLocale = 'tr_TR';
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBgHandler);
  } catch (_) {
    // Firebase yapılandırması yoksa uygulama yine de açılsın
  }
  await ApiClient.instance.init();
  try {
    await LocalNotifications.init();
    await PushService.init();
  } catch (_) {
    // Firebase yapılandırması yoksa (ör. iOS'ta GoogleService-Info.plist
    // eksikse) push devre dışı kalsın, uygulama yine de açılsın
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Object? startupError;
  try {
    // Açılışta bir şey donarsa (ağ, secure storage vb.) uygulama sonsuza
    // kadar beyaz ekranda kalmasın; en geç 10 saniyede hataya düşsün.
    await _startup().timeout(const Duration(seconds: 10));
  } catch (e) {
    startupError = e;
  }
  runApp(startupError == null
      ? const IkysApp()
      : _StartupErrorApp(error: startupError));
}

/// Açılış sırasında beklenmeyen bir hata/zaman aşımı olursa beyaz ekran
/// yerine sebebini gösterir (ekran görüntüsüyle bize iletilebilsin diye).
class _StartupErrorApp extends StatelessWidget {
  final Object error;
  const _StartupErrorApp({required this.error});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Uygulama açılırken bir sorun oluştu',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 12),
                SelectableText('$error'),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
        locale: const Locale('tr', 'TR'),
        supportedLocales: const [Locale('tr', 'TR')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
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
