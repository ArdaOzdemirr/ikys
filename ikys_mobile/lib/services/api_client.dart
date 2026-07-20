import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import '../config.dart';
import 'storage.dart';

/// axios ApiClient'in Dart karşılığı.
/// - İsteklere access token ekler
/// - 401'de refresh token ile yeniler ve isteği tekrarlar
/// - Refresh başarısızsa onForceLogout callback'ini tetikler
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  late final Dio dio;
  void Function()? onForceLogout;

  // Aynı anda birden fazla istek 401 alırsa hepsi TEK bir refresh çağrısını
  // paylaşır. Backend'de refresh token'lar rotasyonlu (her kullanımda eskisi
  // silinip yenisi oluşturuluyor) — her istek kendi başına ayrı refresh
  // denerse, biri diğerinin az önce aldığı geçerli token'ı geçersiz kılıp
  // kullanıcıyı yanlışlıkla çıkışa yollar.
  bool _isRefreshing = false;
  final List<Completer<String?>> _refreshWaiters = [];

  Future<void> init() async {
    final override = await TokenStorage.instance.getApiBaseUrlOverride();
    dio = Dio(BaseOptions(
      baseUrl: override ?? apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
    ));

    dio.interceptors.add(QueuedInterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await TokenStorage.instance.getAccess();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        final isAuthError = e.response?.statusCode == 401;
        final alreadyRetried = e.requestOptions.extra['retried'] == true;

        if (isAuthError && !alreadyRetried) {
          final newToken = await _refreshToken();
          if (newToken != null) {
            final opts = e.requestOptions;
            opts.extra['retried'] = true;
            opts.headers['Authorization'] = 'Bearer $newToken';
            try {
              final clone = await dio.fetch(opts);
              return handler.resolve(clone);
            } catch (_) {
              return handler.next(e);
            }
          }
          return handler.next(e);
        }
        handler.next(e);
      },
    ));
  }

  /// Devam eden bir refresh varsa onun sonucunu bekler; yoksa yeni bir
  /// refresh başlatır. Sonuç (yeni access token ya da null) tüm bekleyen
  /// isteklerle paylaşılır.
  Future<String?> _refreshToken() {
    if (_isRefreshing) {
      final completer = Completer<String?>();
      _refreshWaiters.add(completer);
      return completer.future;
    }
    _isRefreshing = true;
    return _doRefresh().then((token) {
      for (final w in _refreshWaiters) {
        w.complete(token);
      }
      _refreshWaiters.clear();
      _isRefreshing = false;
      return token;
    });
  }

  Future<String?> _doRefresh() async {
    try {
      final refresh = await TokenStorage.instance.getRefresh();
      if (refresh == null) throw Exception('no refresh token');

      // Ayrı bir Dio ile refresh (interceptor döngüsüne girmesin)
      final res = await Dio(BaseOptions(baseUrl: apiBaseUrl))
          .post('/auth/refresh', data: {'refreshToken': refresh});

      final newAccess = res.data['accessToken'] as String;
      await TokenStorage.instance.setTokens(newAccess, res.data['refreshToken']);
      return newAccess;
    } catch (_) {
      await TokenStorage.instance.clear();
      onForceLogout?.call();
      return null;
    }
  }

  /// Backend'in döndürdüğü göreli, JWT korumalı dosya url'ini (örn.
  /// /api/v1/payroll/expenses/receipt/x) indirip cihazdaki varsayılan
  /// uygulamada açar. Doğrudan tarayıcıda açmak çalışmaz çünkü o istek
  /// Authorization header'ı taşımaz ve backend 401 döner.
  Future<void> openFileUrl(String relativeUrl) async {
    // dio.baseUrl zaten apiBaseUrl (örn. http://ip:3000/api/v1) olduğundan,
    // gelen url'in baştaki /api/v1 kısmını çıkarıp baseUrl'e göre relative isteriz.
    final path = relativeUrl.replaceFirst(RegExp(r'^/api/v1'), '');
    final res = await dio.get<List<int>>(
      path,
      options: Options(responseType: ResponseType.bytes),
    );
    final fileName = relativeUrl.split('/').last;
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/$fileName');
    await file.writeAsBytes(res.data!);
    await OpenFilex.open(file.path);
  }

  String get currentBaseUrl => dio.options.baseUrl;

  /// Sunucu ayarları ekranından çağrılır: yeni adresi kalıcı saklar ve
  /// uygulamayı yeniden başlatmaya gerek kalmadan hemen etkin eder.
  Future<void> setBaseUrl(String url) async {
    await TokenStorage.instance.setApiBaseUrlOverride(url);
    dio.options.baseUrl = url;
  }

  /// Varsayılana (config.dart) döner.
  Future<void> resetBaseUrl() async {
    await TokenStorage.instance.clearApiBaseUrlOverride();
    dio.options.baseUrl = apiBaseUrl;
  }

  /// Verilen adresin gerçekten erişilebilir olup olmadığını hızlıca kontrol eder.
  /// Sunucu adresi yanlışsa kullanıcı kaydetmeden önce uyarılabilsin diye.
  static Future<bool> testConnection(String url) async {
    try {
      final probe = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ));
      // Herhangi bir yanıt (404 dahil) sunucunun erişilebilir olduğunu gösterir.
      await probe.get(url);
      return true;
    } on DioException catch (e) {
      return e.response != null;
    } catch (_) {
      return false;
    }
  }

  static String errorMessage(Object e, [String fallback = 'Bir hata oluştu']) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        return m is List ? m.join(', ') : m.toString();
      }
    }
    return fallback;
  }
}
