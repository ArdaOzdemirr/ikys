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

  void init() {
    dio = Dio(BaseOptions(
      baseUrl: apiBaseUrl,
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
          try {
            final refresh = await TokenStorage.instance.getRefresh();
            if (refresh == null) throw Exception('no refresh token');

            // Ayrı bir Dio ile refresh (interceptor döngüsüne girmesin)
            final res = await Dio(BaseOptions(baseUrl: apiBaseUrl))
                .post('/auth/refresh', data: {'refreshToken': refresh});

            await TokenStorage.instance.setTokens(
              res.data['accessToken'],
              res.data['refreshToken'],
            );

            // Orijinal isteği yeni token'la tekrarla
            final opts = e.requestOptions;
            opts.extra['retried'] = true;
            opts.headers['Authorization'] = 'Bearer ${res.data['accessToken']}';
            final clone = await dio.fetch(opts);
            return handler.resolve(clone);
          } catch (_) {
            await TokenStorage.instance.clear();
            onForceLogout?.call();
            return handler.next(e);
          }
        }
        handler.next(e);
      },
    ));
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
